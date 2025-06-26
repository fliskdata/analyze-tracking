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
  const events = [];

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

    // -------- Built-in providers pass --------
    const builtInEvents = findTrackingEvents(sourceFile, checker, filePath, null);
    events.push(...builtInEvents);

    // -------- Custom function passes --------
    if (Array.isArray(customFunctionSignatures) && customFunctionSignatures.length > 0) {
      for (const customConfig of customFunctionSignatures) {
        if (!customConfig) continue;
        const customEvents = findTrackingEvents(sourceFile, checker, filePath, customConfig);
        events.push(...customEvents);
      }
    }

    // Deduplicate events (source|eventName|line|functionName)
    const uniqueEvents = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!uniqueEvents.has(key)) {
        uniqueEvents.set(key, evt);
      }
    }

    return Array.from(uniqueEvents.values());

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
