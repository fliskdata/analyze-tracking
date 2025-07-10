/**
 * @fileoverview TypeScript analytics tracking analyzer - main entry point
 * @module analyze/typescript
 */

const { getProgram, findTrackingEvents, ProgramError, SourceFileError, DEFAULT_COMPILER_OPTIONS } = require('./parser');
const ts = require('typescript');
const path = require('path');

/**
 * Creates a standalone TypeScript program for a single file
 * This is used as a fallback when the main program can't resolve the file
 * @param {string} filePath - Path to the TypeScript file
 * @returns {Object} TypeScript program
 */
function createStandaloneProgram(filePath) {
  const compilerOptions = {
    ...DEFAULT_COMPILER_OPTIONS,
    // We intentionally allow module resolution here so that imported constants
    // (e.g. event name strings defined in a sibling file) can be followed by the
    // TypeScript compiler.
    isolatedModules: true
  };
  
  return ts.createProgram([filePath], compilerOptions);
}

/**
 * Deduplicates events based on source, eventName, line, and functionName
 * @param {Array<Object>} events - Array of events to deduplicate
 * @returns {Array<Object>} Deduplicated events
 */
function deduplicateEvents(events) {
  const uniqueEvents = new Map();
  
  for (const event of events) {
    const key = `${event.source}|${event.eventName}|${event.line}|${event.functionName}`;
    if (!uniqueEvents.has(key)) {
      uniqueEvents.set(key, event);
    }
  }
  
  return Array.from(uniqueEvents.values());
}

/**
 * Attempts to analyze a file using a standalone program as fallback
 * @param {string} filePath - Path to the TypeScript file
 * @param {Array} customFunctionSignatures - Custom function signatures to detect
 * @returns {Array<Object>} Array of events or empty array if failed
 */
function tryStandaloneAnalysis(filePath, customFunctionSignatures) {
  try {
    console.warn(`Unable to resolve ${filePath} in main program. Attempting standalone analysis.`);
    
    const standaloneProgram = createStandaloneProgram(filePath);
    const sourceFile = standaloneProgram.getSourceFile(filePath);
    
    if (!sourceFile) {
      console.warn(`Standalone analysis failed: could not get source file for ${filePath}`);
      return [];
    }
    
    const checker = standaloneProgram.getTypeChecker();
    const events = findTrackingEvents(sourceFile, checker, filePath, customFunctionSignatures || []);
    
    return deduplicateEvents(events);
  } catch (standaloneError) {
    console.warn(`Standalone analysis failed for ${filePath}: ${standaloneError.message}`);
    return [];
  }
}

/**
 * Gets or creates a cached TypeScript program for efficient reuse
 * @param {string} filePath - Path to the TypeScript file
 * @param {Map} programCache - Map of tsconfig paths to programs
 * @returns {Object} TypeScript program
 */
function getCachedTsProgram(filePath, programCache) {
  // Locate nearest tsconfig.json (may be undefined)
  const searchPath = path.dirname(filePath);
  const configPath = ts.findConfigFile(searchPath, ts.sys.fileExists, 'tsconfig.json');

  // We only cache when a tsconfig.json exists because the resulting program
  // represents an entire project.  If no config is present we build a
  // stand-alone program that should not be reused for other files – otherwise
  // later files would be missing from the program (which is precisely what
  // caused the regression we are fixing).
  const shouldCache = Boolean(configPath);
  const cacheKey = configPath; // undefined when shouldCache is false

  if (shouldCache && programCache.has(cacheKey)) {
    return programCache.get(cacheKey);
  }

  const program = getProgram(filePath, null);

  if (shouldCache) {
    programCache.set(cacheKey, program);
  }

  return program;
}

/**
 * Analyzes a TypeScript file for analytics tracking calls
 * @param {string} filePath - Path to the TypeScript file to analyze
 * @param {Object} [program] - Optional existing TypeScript program to reuse
 * @param {Array} [customFunctionSignatures] - Optional custom function signatures to detect
 * @returns {Array<Object>} Array of tracking events found in the file
 */
function analyzeTsFile(filePath, program = null, customFunctionSignatures = null) {
  try {
    // Get or create TypeScript program
    const tsProgram = getProgram(filePath, program);

    // Get source file from program
    const sourceFile = tsProgram.getSourceFile(filePath);
    if (!sourceFile) {
      // Try standalone analysis as fallback
      return tryStandaloneAnalysis(filePath, customFunctionSignatures);
    }

    // Get type checker and find tracking events
    const checker = tsProgram.getTypeChecker();
    const events = findTrackingEvents(sourceFile, checker, filePath, customFunctionSignatures || []);

    return deduplicateEvents(events);

  } catch (error) {
    if (error instanceof ProgramError) {
      console.error(`Error creating TypeScript program for ${filePath}: ${error.originalError?.message || error.message}`);
    } else if (error instanceof SourceFileError) {
      console.error(`Error: Unable to get source file for ${filePath}`);
    } else {
      console.error(`Error analyzing TypeScript file ${filePath}: ${error.message}`);
    }

    return [];
  }
}

/**
 * Analyzes multiple TypeScript files with program reuse for better performance
 * @param {Array<string>} tsFiles - Array of TypeScript file paths
 * @param {Array} customFunctionSignatures - Custom function signatures to detect
 * @returns {Array<Object>} Array of all tracking events found across all files
 */
function analyzeTsFiles(tsFiles, customFunctionSignatures) {
  const allEvents = [];
  const tsProgramCache = new Map(); // tsconfig path -> program
  
  for (const file of tsFiles) {
    try {
      // Use cached program or create new one
      const program = getCachedTsProgram(file, tsProgramCache);
      const events = analyzeTsFile(file, program, customFunctionSignatures);
      
      allEvents.push(...events);
    } catch (error) {
      console.warn(`Error processing TypeScript file ${file}: ${error.message}`);
    }
  }
  
  return allEvents;
}

module.exports = { 
  analyzeTsFile,
  analyzeTsFiles
};
