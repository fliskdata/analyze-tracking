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

    // Single visitor pass covering all custom configs
    const visitor = new TrackingVisitor(code, filePath, customFunctionSignatures || []);
    const events = await visitor.analyze(ast);

    // Deduplicate events
    const unique = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!unique.has(key)) unique.set(key, evt);
    }

    return Array.from(unique.values());

  } catch (fileError) {
    console.error(`Error reading or processing file ${filePath}:`, fileError.message);
    return [];
  }
}

module.exports = { analyzeRubyFile };
