/**
 * @fileoverview TypeScript analytics tracking analyzer - main entry point
 * @module analyze/typescript
 */

const { getProgram, findTrackingEvents, ProgramError, SourceFileError } = require('./parser');
const { parseCustomFunctionSignature } = require('../utils/customFunctionParser');

/**
 * Analyzes a TypeScript file for analytics tracking calls
 * @param {string} filePath - Path to the TypeScript file to analyze
 * @param {Object} [program] - Optional existing TypeScript program to reuse
 * @param {string} [customFunctionSignature] - Optional custom function signature to detect
 * @returns {Array<Object>} Array of tracking events found in the file
 */
function analyzeTsFile(filePath, program = null, customFunctionSignature = null) {
  const events = [];
  const customConfig = customFunctionSignature ? parseCustomFunctionSignature(customFunctionSignature) : null;

  try {
    // Get or create TypeScript program
    const tsProgram = getProgram(filePath, program);
    
    // Get source file from program
    const sourceFile = tsProgram.getSourceFile(filePath);
    if (!sourceFile) {
      throw new SourceFileError(filePath);
    }

    // Get type checker
    const checker = tsProgram.getTypeChecker();

    // Find and extract tracking events
    const foundEvents = findTrackingEvents(sourceFile, checker, filePath, customConfig);
    events.push(...foundEvents);

  } catch (error) {
    if (error instanceof ProgramError) {
      console.error(`Error creating TypeScript program for ${filePath}: ${error.originalError?.message || error.message}`);
    } else if (error instanceof SourceFileError) {
      console.error(`Error: Unable to get source file for ${filePath}`);
    } else {
      console.error(`Error analyzing TypeScript file ${filePath}: ${error.message}`);
    }
  }

  return events;
}

module.exports = { analyzeTsFile };
