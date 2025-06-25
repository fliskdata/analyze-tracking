/**
 * @fileoverview TypeScript AST parsing and walking module
 * @module analyze/typescript/parser
 */

const ts = require('typescript');
const { detectAnalyticsSource } = require('./detectors');
const { extractEventData, processEventData } = require('./extractors');
const { findWrappingFunction } = require('./utils/function-finder');

/**
 * Error thrown when TypeScript program cannot be created
 */
class ProgramError extends Error {
  constructor(filePath, originalError) {
    super(`Failed to create TypeScript program for: ${filePath}`);
    this.name = 'ProgramError';
    this.filePath = filePath;
    this.originalError = originalError;
  }
}

/**
 * Error thrown when source file cannot be retrieved
 */
class SourceFileError extends Error {
  constructor(filePath) {
    super(`Failed to get source file: ${filePath}`);
    this.name = 'SourceFileError';
    this.filePath = filePath;
  }
}

/**
 * Gets or creates a TypeScript program for analysis
 * @param {string} filePath - Path to the TypeScript file
 * @param {Object} [existingProgram] - Existing TypeScript program to reuse
 * @returns {Object} TypeScript program
 * @throws {ProgramError} If program cannot be created
 */
function getProgram(filePath, existingProgram) {
  if (existingProgram) {
    return existingProgram;
  }

  try {
    // Create a minimal program for single file analysis
    const options = {
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.CommonJS,
      allowJs: true,
      checkJs: false,
      noEmit: true
    };

    const program = ts.createProgram([filePath], options);
    return program;
  } catch (error) {
    throw new ProgramError(filePath, error);
  }
}

/**
 * Walks the TypeScript AST and finds analytics tracking calls
 * @param {Object} sourceFile - TypeScript source file
 * @param {Object} checker - TypeScript type checker
 * @param {string} filePath - Path to the file being analyzed
 * @param {Object} [customConfig] - Custom function configuration
 * @returns {Array<Object>} Array of found events
 */
function findTrackingEvents(sourceFile, checker, filePath, customConfig) {
  const events = [];

  /**
   * Visitor function for AST traversal
   * @param {Object} node - Current AST node
   */
  function visit(node) {
    try {
      if (ts.isCallExpression(node)) {
        const event = extractTrackingEvent(node, sourceFile, checker, filePath, customConfig);
        if (event) {
          events.push(event);
        }
      }
      // Continue traversing the AST
      ts.forEachChild(node, visit);
    } catch (error) {
      console.error(`Error processing node in ${filePath}:`, error.message);
    }
  }

  // Start traversal from the root
  ts.forEachChild(sourceFile, visit);

  return events;
}

/**
 * Extracts tracking event from a CallExpression node
 * @param {Object} node - CallExpression node
 * @param {Object} sourceFile - TypeScript source file
 * @param {Object} checker - TypeScript type checker
 * @param {string} filePath - File path
 * @param {Object} [customConfig] - Custom function configuration
 * @returns {Object|null} Extracted event or null
 */
function extractTrackingEvent(node, sourceFile, checker, filePath, customConfig) {
  // Detect the analytics source
  const source = detectAnalyticsSource(node, customConfig?.functionName);
  if (source === 'unknown') {
    return null;
  }

  // Extract event data based on the source
  const eventData = extractEventData(node, source, checker, sourceFile, customConfig);

  // Get location and context information
  const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const functionName = findWrappingFunction(node);

  // Process the event data into final format
  return processEventData(eventData, source, filePath, line, functionName, checker, sourceFile, customConfig);
}

module.exports = {
  getProgram,
  findTrackingEvents,
  ProgramError,
  SourceFileError
};
