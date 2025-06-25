/**
 * @fileoverview Go analytics tracking analyzer - main entry point
 * @module analyze/go
 */

const fs = require('fs');
const { extractGoAST } = require('./goAstParser');
const { buildTypeContext } = require('./typeContext');
const { deduplicateEvents } = require('./eventDeduplicator');
const { extractEventsFromBody } = require('./astTraversal');
const { processGoFile } = require('./utils');
const { parseCustomFunctionSignature } = require('../utils/customFunctionParser');

/**
 * Analyze a Go file and extract tracking events
 * @param {string} filePath - Path to the Go file to analyze
 * @param {string|null} customFunctionSignature - Signature of custom tracking function to detect (optional)
 * @returns {Promise<Array>} Array of tracking events found in the file
 * @throws {Error} If the file cannot be read or parsed
 */
async function analyzeGoFile(filePath, customFunctionSignature) {
  try {
    const customConfig = customFunctionSignature ? parseCustomFunctionSignature(customFunctionSignature) : null;

    // Read the Go file
    const source = fs.readFileSync(filePath, 'utf8');
    
    // Parse the Go file using goAstParser
    const ast = extractGoAST(source);
    
    // First pass: build type information for functions and variables
    const typeContext = buildTypeContext(ast);
    
    // Extract tracking events from the AST
    const events = [];
    let currentFunction = 'global';
    
    // Walk through the AST
    for (const node of ast) {
      if (node.tag === 'func') {
        currentFunction = node.name;
        // Process the function body
        if (node.body) {
          extractEventsFromBody(node.body, events, filePath, currentFunction, customConfig, typeContext, currentFunction);
        }
      }
    }
    
    // Deduplicate events based on eventName, source, and function
    const uniqueEvents = deduplicateEvents(events);
    
    return uniqueEvents;
  } catch (error) {
    console.error(`Error analyzing Go file ${filePath}:`, error.message);
    return [];
  }
}

module.exports = { analyzeGoFile };
