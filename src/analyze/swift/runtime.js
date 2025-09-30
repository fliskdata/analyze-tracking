/**
 * Swift runtime bridge for @flisk/swift-ast
 * - Provides lazy ESM/CJS loading
 * - Serializes WASI-backed calls to avoid double-start errors
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL: pathToFileUrl } = require('url');

let __swiftAst = null;
async function getSwiftAst() {
  if (__swiftAst) return __swiftAst;
  try {
    // Try CJS require first (when package exposes CJS entry)
    // eslint-disable-next-line global-require
    __swiftAst = require('@flisk/swift-ast');
    return __swiftAst;
  } catch (e) {
    // Fallback to ESM dynamic import
    try {
      const m = await import('@flisk/swift-ast');
      __swiftAst = m;
      return __swiftAst;
    } catch (_) {
      // Final fallback: local workspace copy of swift-ast (for dev)
      const localDist = path.resolve('/Users/sameenkarim/flisk/dev/swift-ast/dist/index.js');
      if (fs.existsSync(localDist)) {
        const m2 = await import(pathToFileUrl(localDist).href);
        __swiftAst = m2;
        return __swiftAst;
      }
      throw e;
    }
  }
}

// Serialize WASI-backed swift-ast operations
let __swiftLock = Promise.resolve();
function withSwift(callback) {
  const p = __swiftLock.then(callback, callback);
  __swiftLock = p.then(() => {}, () => {});
  return p;
}

module.exports = { getSwiftAst, withSwift };
