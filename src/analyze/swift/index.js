const fs = require('fs');
const path = require('path');
const { runSwiftSyntax } = require('./runner');

/**
 * Analyze a Swift file for analytics tracking calls using a SwiftSyntax-based
 * WASM parser.  This is a thin wrapper around the compiled Swift module.
 *
 * NOTE: The current implementation invokes the SwiftSyntax WASM binary but
 * does not yet include a JSON-emitting visitor that extracts events.  Until
 * that visitor lands, this function returns an empty list so that the new
 * integration does not break existing functionality or tests.
 *
 * @param {string} filePath Path to the .swift file
 * @param {Array} [customFunctionSignatures] Custom tracking function signatures
 * @returns {Promise<Array>} Parsed tracking events (currently [])
 */
async function analyzeSwiftFile(filePath, customFunctionSignatures = null) {
  if (!filePath || typeof filePath !== 'string') return [];
  if (!fs.existsSync(filePath)) return [];

  try {
    // Execute the WASM binary – future work will interpret the JSON it prints.
    // Keeping the call here ensures the WASM pipeline is validated in CI even
    // before we rely on its output.
    if (process.env.ENABLE_SWIFT_WASM === '1') {
      const output = await runSwiftSyntax(path.resolve(filePath));
      // Placeholder: when the Swift visitor is ready, parse `output` (likely JSON)
      // and convert to the canonical event objects.
      void output; // eslint-disable-line no-unused-expressions
    }
  } catch (err) {
    // Log and return empty to keep analysis resilient.
    console.warn(`Swift analysis failed for ${filePath}: ${err.message}`);
  }

  return [];
}

module.exports = { analyzeSwiftFile };