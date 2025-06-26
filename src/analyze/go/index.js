/**
 * @fileoverview Go analytics tracking analyzer - main entry point
 * @module analyze/go
 */

const fs = require('fs');
const { extractGoAST } = require('./goAstParser');
const { buildTypeContext } = require('./typeContext');
const { deduplicateEvents } = require('./eventDeduplicator');
const { extractEventsFromBody } = require('./astTraversal');

/**
 * Analyze a Go file and extract tracking events
 * @param {string} filePath - Path to the Go file to analyze
 * @param {string|null} customFunctionSignatures - Signature of custom tracking function to detect (optional)
 * @returns {Promise<Array>} Array of tracking events found in the file
 * @throws {Error} If the file cannot be read or parsed
 */
async function analyzeGoFile(filePath, customFunctionSignatures = null) {
  try {
    // Read the Go file
    const source = fs.readFileSync(filePath, 'utf8');

    // Parse the Go file using goAstParser (once)
    const ast = extractGoAST(source);

    // First pass: build type information for functions and variables
    const typeContext = buildTypeContext(ast);

    const collectEventsForConfig = (customConfig) => {
      const events = [];
      let currentFunction = 'global';
      for (const node of ast) {
        if (node.tag === 'func') {
          currentFunction = node.name;
          if (node.body) {
            extractEventsFromBody(
              node.body,
              events,
              filePath,
              currentFunction,
              customConfig,
              typeContext,
              currentFunction
            );
          }
        }
      }
      return events;
    };

    let events = [];

    // Built-in providers pass (null custom config)
    events.push(...collectEventsForConfig(null));

    // Custom configs passes
    if (Array.isArray(customFunctionSignatures) && customFunctionSignatures.length > 0) {
      for (const customConfig of customFunctionSignatures) {
        if (!customConfig) continue;
        events.push(...collectEventsForConfig(customConfig));
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
