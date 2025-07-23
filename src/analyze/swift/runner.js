const { readFile } = require('fs/promises');
const path = require('path');
let WASI;

// Lazy-load WASI because the built-in module only exists on Node >= 13.
// This allows the rest of the package (and the test suite) to run on older
// versions where Swift analysis is not needed.  We fall back to a noop stub
// that immediately throws when used.
try {
  // Use indirect `require` to avoid webpack / bundlers statically analysing it.
  WASI = eval("require")('wasi').WASI; // eslint-disable-line no-eval
} catch (_) {
  WASI = class {
    constructor() { throw new Error('WASI unsupported in this Node version'); }
  };
}

/**
 * Executes the pre-compiled SwiftSyntax WebAssembly binary and returns its stdout.
 *
 * The WASM module must live next to this runner as `SwiftSyntaxWasm.wasm`.
 * It is expected to behave like a CLI: first arg is a path to the Swift file
 * whose AST / JSON it should print to STDOUT.
 *
 * @param {string} filePath Absolute or relative path to the .swift source file.
 * @param {Object} [options]
 * @param {string} [options.wasmPath]  Override the default path to the WASM binary.
 * @returns {Promise<string>} Captured stdout produced by the WASM program.
 */
async function runSwiftSyntax(filePath, options = {}) {
  const wasmPath = options.wasmPath || path.join(__dirname, 'SwiftSyntaxWasm.wasm');

  // Make sure we can locate the WASM file early for better error reporting.
  try {
    await readFile(wasmPath);
  } catch (err) {
    throw new Error(`SwiftSyntax WASM binary not found at ${wasmPath}. ` +
      'Ensure you have built it via the Swift WASI toolchain or downloaded the prebuilt artefact.');
  }

  // WASI instance configured to expose the current working directory so that
  // the module can open the target Swift file.
  const wasi = new WASI({
    args: ['SwiftSyntaxWasm.wasm', filePath],
    env: process.env,
    preopens: { '/': process.cwd() }
  });

  const wasmBytes = await readFile(wasmPath);
  const module = await WebAssembly.compile(wasmBytes);
  const instance = await WebAssembly.instantiate(module, wasi.getImportObject());

  // Capture stdout by monkey-patching process.stdout.write for the duration of
  // the WASI execution. This avoids spawning a separate process or temp files.
  let stdout = '';
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk, encoding, callback) => {
    stdout += chunk instanceof Buffer ? chunk.toString('utf8') : chunk;
    if (typeof encoding === 'function') {
      encoding(); // encoding is actually the callback here
    } else if (typeof callback === 'function') {
      callback();
    }
    return true;
  };

  try {
    wasi.start(instance);
  } finally {
    process.stdout.write = originalWrite; // always restore
  }

  return stdout;
}

module.exports = { runSwiftSyntax };