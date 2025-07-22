/**
 * @fileoverview Swift analytics tracking analyzer - main entry point
 * @module analyze/swift
 */

const { parseFile } = require('./parser');

/**
 * Analyzes a Swift file for analytics tracking calls
 * @param {string} filePath - Path to the Swift file to analyze
 * @param {Array} customFunctionSignatures - Optional custom function signatures to detect
 * @returns {Promise<Array<Object>>} Array of tracking events found in the file
 */
async function analyzeSwiftFile(filePath, customFunctionSignatures = null) {
  try {
    // Parse the file and extract tracking events
    const events = parseFile(filePath, customFunctionSignatures || []);

    // Filter out suspicious events and deduplicate
    const filtered = events.filter(evt => {
      // Filter out events with suspicious names that look like parsing errors
      if (evt.eventName === 'String' || 
          evt.eventName.startsWith('eventName:') ||
          evt.eventName.includes('Structured(')) {
        return false;
      }
      
      return true;
    });

    // Deduplicate events (by source | eventName | line | functionName)
    const unique = new Map();
    for (const evt of filtered) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!unique.has(key)) unique.set(key, evt);
    }

    return Array.from(unique.values());

  } catch (error) {
    console.error(`Error analyzing Swift file ${filePath}:`, error.message);
    return [];
  }
}

module.exports = {
  analyzeSwiftFile
};