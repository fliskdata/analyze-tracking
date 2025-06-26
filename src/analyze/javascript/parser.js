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

// ---------------------------------------------
// Helper – custom function matcher
// ---------------------------------------------

/**
 * Determines whether a CallExpression node matches the provided custom function name.
 * Supports both simple identifiers (e.g. myTrack) and dot-separated members (e.g. Custom.track).
 * The logic mirrors isCustomFunction from detectors/analytics-source.js but is kept local to avoid
 * circular dependencies.
 * @param {Object} node  – CallExpression AST node
 * @param {string} fnName – Custom function name (could include dots)
 * @returns {boolean}
 */
function nodeMatchesCustomFunction(node, fnName) {
  if (!fnName || !node.callee) return false;

  const parts = fnName.split('.');

  // Simple identifier case
  if (parts.length === 1) {
    return node.callee.type === NODE_TYPES.IDENTIFIER && node.callee.name === fnName;
  }

  // Member expression chain case
  if (node.callee.type !== NODE_TYPES.MEMBER_EXPRESSION) {
    return false;
  }

  // Walk the chain from the right-most property to the leftmost object
  let currentNode = node.callee;
  let idx = parts.length - 1;

  while (currentNode && idx >= 0) {
    const expected = parts[idx];

    if (currentNode.type === NODE_TYPES.MEMBER_EXPRESSION) {
      if (
        currentNode.property.type !== NODE_TYPES.IDENTIFIER ||
        currentNode.property.name !== expected
      ) {
        return false;
      }
      currentNode = currentNode.object;
      idx -= 1;
    } else if (currentNode.type === NODE_TYPES.IDENTIFIER) {
      return idx === 0 && currentNode.name === expected;
    } else {
      return false;
    }
  }

  return false;
}

// -----------------------------------------------------------------------------
// Utility – collect constants defined as plain objects or Object.freeze({...})
// -----------------------------------------------------------------------------
function collectConstantStringMap(ast) {
  const map = {};

  walk.simple(ast, {
    VariableDeclaration(node) {
      // Only consider const declarations
      if (node.kind !== 'const') return;
      node.declarations.forEach(decl => {
        if (decl.id.type !== NODE_TYPES.IDENTIFIER || !decl.init) return;
        const name = decl.id.name;
        let objLiteral = null;

        if (decl.init.type === NODE_TYPES.OBJECT_EXPRESSION) {
          objLiteral = decl.init;
        } else if (decl.init.type === NODE_TYPES.CALL_EXPRESSION) {
          // Check for Object.freeze({...})
          const callee = decl.init.callee;
          if (
            callee &&
            callee.type === NODE_TYPES.MEMBER_EXPRESSION &&
            callee.object.type === NODE_TYPES.IDENTIFIER &&
            callee.object.name === 'Object' &&
            callee.property.type === NODE_TYPES.IDENTIFIER &&
            callee.property.name === 'freeze' &&
            decl.init.arguments.length > 0 &&
            decl.init.arguments[0].type === NODE_TYPES.OBJECT_EXPRESSION
          ) {
            objLiteral = decl.init.arguments[0];
          }
        }

        if (objLiteral) {
          map[name] = {};
          objLiteral.properties.forEach(prop => {
            if (!prop.key || !prop.value) return;
            const keyName = prop.key.name || prop.key.value;
            if (prop.value.type === NODE_TYPES.LITERAL && typeof prop.value.value === 'string') {
              map[name][keyName] = prop.value.value;
            }
          });
        }
      });
    }
  });

  return map;
}

/**
 * Walk the AST once and find tracking events for built-in providers plus any number of custom
 * function configurations. This avoids the previous O(n * customConfigs) behaviour.
 *
 * @param {Object}  ast                      – Parsed AST of the source file
 * @param {string}  filePath                 – Absolute/relative path to the source file
 * @param {Object[]} [customConfigs=[]]      – Array of parsed custom function configurations
 * @returns {Array<Object>}                  – List of extracted tracking events
 */
function findTrackingEvents(ast, filePath, customConfigs = []) {
  const events = [];

  // Collect constant mappings once per file
  const constantMap = collectConstantStringMap(ast);

  walk.ancestor(ast, {
    [NODE_TYPES.CALL_EXPRESSION]: (node, ancestors) => {
      try {
        let matchedCustomConfig = null;

        // Attempt to match any custom function first to avoid mis-classifying built-in providers
        if (Array.isArray(customConfigs) && customConfigs.length > 0) {
          for (const cfg of customConfigs) {
            if (cfg && nodeMatchesCustomFunction(node, cfg.functionName)) {
              matchedCustomConfig = cfg;
              break;
            }
          }
        }

        if (matchedCustomConfig) {
          const event = extractTrackingEvent(node, ancestors, filePath, constantMap, matchedCustomConfig);
          if (event) events.push(event);
        } else {
          const event = extractTrackingEvent(node, ancestors, filePath, constantMap, null);
          if (event) events.push(event);
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
 * @param {Object} constantMap - Constant string map
 * @param {Object} [customConfig] - Custom function configuration object
 * @returns {Object|null} Extracted event or null
 */
function extractTrackingEvent(node, ancestors, filePath, constantMap, customConfig) {
  const source = detectAnalyticsSource(node, customConfig?.functionName);
  if (source === 'unknown') {
    return null;
  }
  const eventData = extractEventData(node, source, constantMap, customConfig);
  const line = node.loc.start.line;
  const functionName = findWrappingFunction(node, ancestors);
  return processEventData(eventData, source, filePath, line, functionName, customConfig);
}

module.exports = {
  parseFile,
  findTrackingEvents,
  FileReadError,
  ParseError
};
