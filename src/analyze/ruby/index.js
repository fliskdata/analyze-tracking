/**
 * @fileoverview Ruby analytics tracking analyzer - main entry point
 * @module analyze/ruby
 */

const fs = require('fs');
const TrackingVisitor = require('./visitor');

// Lazy-loaded parse function from Ruby Prism
let parse = null;

/**
 * Analyzes a Ruby file for analytics tracking calls
 * @param {string} filePath - Path to the Ruby file to analyze
 * @param {string} customFunction - Optional custom tracking function name
 * @returns {Promise<Array>} Array of tracking events found in the file
 * @throws {Error} If the file cannot be read or parsed
 */
async function analyzeRubyFile(filePath, customFunctionSignatures = null) {
  // Lazy load the Ruby Prism parser
  if (!parse) {
    const { loadPrism } = await import('@ruby/prism');
    parse = await loadPrism();
  }

  try {
    // Read the file content
    const code = fs.readFileSync(filePath, 'utf8');

    // Parse the Ruby code into an AST once
    let ast;
    try {
      ast = await parse(code);
    } catch (parseError) {
      console.error(`Error parsing file ${filePath}:`, parseError.message);
      return [];
    }

    const events = [];

    // -------- Built-in providers pass --------
    let visitor = new TrackingVisitor(code, filePath, null);
    const builtInEvents = await visitor.analyze(ast);
    events.push(...builtInEvents);

    // -------- Custom config passes --------
    if (Array.isArray(customFunctionSignatures) && customFunctionSignatures.length > 0) {
      for (const customConfig of customFunctionSignatures) {
        if (!customConfig) continue;
        const customVisitor = new TrackingVisitor(code, filePath, customConfig);
        const customEvents = await customVisitor.analyze(ast);
        events.push(...customEvents);
      }
    }

    // Deduplicate events
    const uniqueEvents = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!uniqueEvents.has(key)) {
        uniqueEvents.set(key, evt);
      }
    }

    return Array.from(uniqueEvents.values());

  } catch (fileError) {
    console.error(`Error reading or processing file ${filePath}:`, fileError.message);
    return [];
  }
}

module.exports = { analyzeRubyFile };
