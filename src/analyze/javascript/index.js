/**
 * @fileoverview JavaScript analytics tracking analyzer - main entry point
 * @module analyze/javascript
 */

const { parseFile, findTrackingEvents, FileReadError, ParseError } = require('./parser');

/**
 * Analyzes a JavaScript file for analytics tracking calls
 * @param {string} filePath - Path to the JavaScript file to analyze
 * @param {string} [customFunction] - Optional custom function name to detect
 * @returns {Array<Object>} Array of tracking events found in the file
 */
function analyzeJsFile(filePath, customFunctionSignatures = null) {
  try {
    // Parse the file into an AST once
    const ast = parseFile(filePath);

    // Single pass extraction covering built-in + all custom configs
    const events = findTrackingEvents(ast, filePath, customFunctionSignatures || []);

    // Deduplicate events (by source | eventName | line | functionName)
    const unique = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!unique.has(key)) unique.set(key, evt);
    }

    return Array.from(unique.values());

  } catch (error) {
    if (error instanceof FileReadError) {
      console.error(`Error reading file ${filePath}: ${error.originalError.message}`);
    } else if (error instanceof ParseError) {
      console.error(`Error parsing file ${filePath}: ${error.originalError.message}`);
    } else {
      console.error(`Unexpected error analyzing ${filePath}: ${error.message}`);
    }
  }

  return [];
}

module.exports = { analyzeJsFile };
