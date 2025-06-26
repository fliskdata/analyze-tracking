/**
 * @fileoverview TypeScript analytics tracking analyzer - main entry point
 * @module analyze/typescript
 */

const { getProgram, findTrackingEvents, ProgramError, SourceFileError } = require('./parser');

/**
 * Analyzes a TypeScript file for analytics tracking calls
 * @param {string} filePath - Path to the TypeScript file to analyze
 * @param {Object} [program] - Optional existing TypeScript program to reuse
 * @param {string} [customFunctionSignature] - Optional custom function signature to detect
 * @returns {Array<Object>} Array of tracking events found in the file
 */
function analyzeTsFile(filePath, program = null, customFunctionSignatures = null) {
  try {
    // Get or create TypeScript program (only once)
    const tsProgram = getProgram(filePath, program);

    // Get source file from program
    const sourceFile = tsProgram.getSourceFile(filePath);
    if (!sourceFile) {
      throw new SourceFileError(filePath);
    }

    // Get type checker
    const checker = tsProgram.getTypeChecker();

    // Single-pass collection covering built-in + all custom configs
    const events = findTrackingEvents(sourceFile, checker, filePath, customFunctionSignatures || []);

    // Deduplicate events
    const unique = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!unique.has(key)) unique.set(key, evt);
    }

    return Array.from(unique.values());

  } catch (error) {
    if (error instanceof ProgramError) {
      console.error(`Error creating TypeScript program for ${filePath}: ${error.originalError?.message || error.message}`);
    } else if (error instanceof SourceFileError) {
      console.error(`Error: Unable to get source file for ${filePath}`);
    } else {
      console.error(`Error analyzing TypeScript file ${filePath}: ${error.message}`);
    }
  }

  return [];
}

module.exports = { analyzeTsFile };
