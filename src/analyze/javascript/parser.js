/**
 * @fileoverview AST parsing and walking module
 * @module analyze/javascript/parser
 */

const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const walk = require('acorn-walk');
const { extend } = require('acorn-jsx-walk');
const { PARSER_OPTIONS, NODE_TYPES } = require('./constants');
const { detectAnalyticsSource } = require('./detectors');
const { extractEventData, processEventData } = require('./extractors');
const { findWrappingFunction } = require('./utils/function-finder');

// Extend walker to support JSX
extend(walk.base);

// Configure parser with JSX support
const parser = acorn.Parser.extend(jsx());

/**
 * Error thrown when file cannot be read
 */
class FileReadError extends Error {
  constructor(filePath, originalError) {
    super(`Failed to read file: ${filePath}`);
    this.name = 'FileReadError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when file cannot be parsed
 */
class ParseError extends Error {
  constructor(filePath, originalError) {
    super(`Failed to parse file: ${filePath}`);
    this.name = 'ParseError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

/**
 * Parses a JavaScript file and returns its AST
 * @param {string} filePath - Path to the JavaScript file
 * @returns {Object} Parsed AST
 * @throws {FileReadError} If file cannot be read
 * @throws {ParseError} If file cannot be parsed
 */
function parseFile(filePath) {
  let code;
  
  try {
    code = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new FileReadError(filePath, error);
  }

  try {
    return parser.parse(code, PARSER_OPTIONS);
  } catch (error) {
    throw new ParseError(filePath, error);
  }
}

/**
 * Walks the AST and finds analytics tracking calls
 * @param {Object} ast - Parsed AST
 * @param {string} filePath - Path to the file being analyzed
 * @param {Object} [customConfig] - Custom function configuration object
 * @returns {Array<Object>} Array of found events
 */
function findTrackingEvents(ast, filePath, customConfig) {
  const events = [];

  walk.ancestor(ast, {
    [NODE_TYPES.CALL_EXPRESSION]: (node, ancestors) => {
      try {
        const event = extractTrackingEvent(node, ancestors, filePath, customConfig);
        if (event) {
          events.push(event);
        }
      } catch (error) {
        console.error(`Error processing node in ${filePath}:`, error.message);
      }
    }
  });

  return events;
}

/**
 * Extracts tracking event from a CallExpression node
 * @param {Object} node - CallExpression node
 * @param {Array<Object>} ancestors - Ancestor nodes
 * @param {string} filePath - File path
 * @param {Object} [customConfig] - Custom function configuration object
 * @returns {Object|null} Extracted event or null
 */
function extractTrackingEvent(node, ancestors, filePath, customConfig) {
  // Detect the analytics source
  const source = detectAnalyticsSource(node, customConfig?.functionName);
  if (source === 'unknown') {
    return null;
  }

  // Extract event data based on the source
  const eventData = extractEventData(node, source, customConfig);

  // Get location and context information
  const line = node.loc.start.line;
  const functionName = findWrappingFunction(node, ancestors);

  // Process the event data into final format
  return processEventData(eventData, source, filePath, line, functionName, customConfig);
}

module.exports = {
  parseFile,
  findTrackingEvents,
  FileReadError,
  ParseError
};
