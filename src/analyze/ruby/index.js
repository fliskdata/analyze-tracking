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
    
    // Parse the Ruby code into an AST
    let ast;
    try {
      ast = await parse(code);
    } catch (parseError) {
      console.error(`Error parsing file ${filePath}:`, parseError.message);
      return []; // Return empty events array if parsing fails
    }

    // temporary: only support one custom function signature for now, will add support for multiple in the future
    const customConfig = !!customFunctionSignatures?.length ? customFunctionSignatures[0] : null;

    // Create a visitor and analyze the AST
    const visitor = new TrackingVisitor(code, filePath, customConfig);
    const events = await visitor.analyze(ast);

    return events;

  } catch (fileError) {
    console.error(`Error reading or processing file ${filePath}:`, fileError.message);
    return [];
  }
}

module.exports = { analyzeRubyFile };
