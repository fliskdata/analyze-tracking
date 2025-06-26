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
  const events = [];

  try {
    // Parse the file into an AST once
    const ast = parseFile(filePath);

    // -------- Built-in providers pass --------
    const builtInEvents = findTrackingEvents(ast, filePath, null);
    events.push(...builtInEvents);

    // -------- Custom function passes --------
    if (Array.isArray(customFunctionSignatures) && customFunctionSignatures.length > 0) {
      for (const customConfig of customFunctionSignatures) {
        if (!customConfig) continue;
        const customEvents = findTrackingEvents(ast, filePath, customConfig);
        events.push(...customEvents);
      }
    }

    // Deduplicate events (by source | eventName | line | functionName)
    const uniqueEvents = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!uniqueEvents.has(key)) {
        uniqueEvents.set(key, evt);
      }
    }

    return Array.from(uniqueEvents.values());

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
