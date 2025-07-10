/**
 * @fileoverview TypeScript AST parsing and walking module
 * @module analyze/typescript/parser
 */

const ts = require('typescript');
const { detectAnalyticsSource } = require('./detectors');
const { extractEventData, processEventData } = require('./extractors');
const { findWrappingFunction } = require('./utils/function-finder');
const path = require('path');

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
 * Default TypeScript compiler options for analysis
 */
const DEFAULT_COMPILER_OPTIONS = {
  target: ts.ScriptTarget.Latest,
  module: ts.ModuleKind.CommonJS,
  allowJs: true,
  checkJs: false,
  noEmit: true,
  jsx: ts.JsxEmit.Preserve,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  allowSyntheticDefaultImports: true,
  esModuleInterop: true,
  skipLibCheck: true
};

/**
 * Maximum number of files to include in TypeScript program for performance
 */
const MAX_FILES_THRESHOLD = 10000;

/**
 * Attempts to parse tsconfig.json and extract compiler options and file names
 * @param {string} configPath - Path to tsconfig.json
 * @returns {Object|null} Parsed config with options and fileNames, or null if failed
 */
function parseTsConfig(configPath) {
  try {
    const readResult = ts.readConfigFile(configPath, ts.sys.readFile);
    if (readResult.error || !readResult.config) {
      return null;
    }

    const parseResult = ts.parseJsonConfigFileContent(
      readResult.config,
      ts.sys,
      path.dirname(configPath)
    );

    if (parseResult.errors && parseResult.errors.length > 0) {
      return null;
    }

    return {
      options: parseResult.options,
      fileNames: parseResult.fileNames
    };
  } catch (error) {
    console.warn(`Failed to parse tsconfig.json at ${configPath}. Error: ${error.message}`);
    return null;
  }
}

/**
 * Determines the appropriate files to include in the TypeScript program
 * @param {string} filePath - Target file path
 * @param {string|null} configPath - Path to tsconfig.json if found
 * @returns {Object} Configuration with compilerOptions and rootNames
 */
function getProgramConfiguration(filePath, configPath) {
  let compilerOptions = { ...DEFAULT_COMPILER_OPTIONS };
  let rootNames = [filePath];

  if (!configPath) {
    return { compilerOptions, rootNames };
  }

  const config = parseTsConfig(configPath);
  if (!config) {
    console.warn(`Failed to parse tsconfig.json at ${configPath}. Analyzing ${filePath} in isolation.`);
    return { compilerOptions, rootNames };
  }

  // Inherit compiler options from tsconfig
  compilerOptions = { ...compilerOptions, ...config.options };

  // Determine file inclusion strategy based on project size
  const projectFileCount = config.fileNames.length;

  if (projectFileCount > 0 && projectFileCount <= MAX_FILES_THRESHOLD) {
    // Small to medium project: include all files for better type checking
    rootNames = [...config.fileNames];
    if (!rootNames.includes(filePath)) {
      rootNames.push(filePath);
    }
  } else if (projectFileCount > MAX_FILES_THRESHOLD) {
    // Large project: only include the target file to avoid performance issues
    console.warn(
      `Large TypeScript project detected (${projectFileCount} files). ` +
      `Analyzing ${filePath} in isolation for performance.`
    );
    rootNames = [filePath];
  }

  return { compilerOptions, rootNames };
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
    // Find the nearest tsconfig.json
    const searchPath = path.dirname(filePath);
    const configPath = ts.findConfigFile(searchPath, ts.sys.fileExists, 'tsconfig.json');

    // Get program configuration
    const { compilerOptions, rootNames } = getProgramConfiguration(filePath, configPath);

    // Create and return the TypeScript program
    return ts.createProgram(rootNames, compilerOptions);
  } catch (error) {
    throw new ProgramError(filePath, error);
  }
}

/**
 * Walks the TypeScript AST and finds analytics tracking calls
 * @param {Object} sourceFile - TypeScript source file
 * @param {Object} checker - TypeScript type checker
 * @param {string} filePath - Path to the file being analyzed
 * @param {Array<Object>} [customConfigs] - Array of custom function configurations
 * @returns {Array<Object>} Array of found events
 */
function findTrackingEvents(sourceFile, checker, filePath, customConfigs = []) {
  const events = [];

  /**
   * Tests if a CallExpression matches a custom function name
   * @param {Object} callNode - The call expression node
   * @param {string} functionName - Function name to match
   * @returns {boolean} True if matches
   */
  function matchesCustomFunction(callNode, functionName) {
    if (!functionName || !callNode.expression) {
      return false;
    }
    
    try {
      return callNode.expression.getText() === functionName;
    } catch {
      return false;
    }
  }

  /**
   * Recursively visits AST nodes to find tracking calls
   * @param {Object} node - Current AST node
   */
  function visit(node) {
    try {
      if (ts.isCallExpression(node)) {
        let matchedCustomConfig = null;

        // Check for custom function matches
        if (Array.isArray(customConfigs) && customConfigs.length > 0) {
          for (const config of customConfigs) {
            if (config && matchesCustomFunction(node, config.functionName)) {
              matchedCustomConfig = config;
              break;
            }
          }
        }

        const event = extractTrackingEvent(
          node,
          sourceFile,
          checker,
          filePath,
          matchedCustomConfig
        );
        
        if (event) {
          events.push(event);
        }
      }

      ts.forEachChild(node, visit);
    } catch (error) {
      console.error(`Error processing node in ${filePath}:`, error.message);
    }
  }

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
  SourceFileError,
  DEFAULT_COMPILER_OPTIONS
};
