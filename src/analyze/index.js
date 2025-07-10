/**
 * @fileoverview Directory analyzer for detecting analytics tracking across multiple programming languages
 * @module analyze-tracking/analyze
 */

const path = require('path');

const { parseCustomFunctionSignature } = require('./utils/customFunctionParser');
const { getAllFiles } = require('../utils/fileProcessor');
const { analyzeJsFile } = require('./javascript');
const { analyzeTsFiles } = require('./typescript');
const { analyzePythonFile } = require('./python');
const { analyzeRubyFile } = require('./ruby');
const { analyzeGoFile } = require('./go');

/**
 * Adds an event to the events collection, merging properties if event already exists
 * @param {Object} allEvents - Collection of all events
 * @param {Object} event - Event to add
 * @param {string} baseDir - Base directory for relative path calculation
 */
function addEventToCollection(allEvents, event, baseDir) {
  const relativeFilePath = path.relative(baseDir, event.filePath);
  
  const implementation = {
    path: relativeFilePath,
    line: event.line,
    function: event.functionName,
    destination: event.source
  };

  if (!allEvents[event.eventName]) {
    allEvents[event.eventName] = {
      implementations: [implementation],
      properties: event.properties,
    };
  } else {
    allEvents[event.eventName].implementations.push(implementation);
    allEvents[event.eventName].properties = {
      ...allEvents[event.eventName].properties,
      ...event.properties,
    };
  }
}

/**
 * Processes all files that are not TypeScript files
 * @param {Array<string>} files - Array of file paths
 * @param {Object} allEvents - Collection to add events to
 * @param {string} baseDir - Base directory for relative paths
 * @param {Array} customFunctionSignatures - Custom function signatures to detect
 */
async function processFiles(files, allEvents, baseDir, customFunctionSignatures) {
  // Analyze all files in parallel for faster execution
  const analysisPromises = files.map(async (file) => {
    let events = [];

    const isJsFile = /\.(jsx?)$/.test(file);
    const isPythonFile = /\.(py)$/.test(file);
    const isRubyFile = /\.(rb)$/.test(file);
    const isGoFile = /\.(go)$/.test(file);

    if (isJsFile) {
      events = analyzeJsFile(file, customFunctionSignatures);
    } else if (isPythonFile) {
      events = await analyzePythonFile(file, customFunctionSignatures);
    } else if (isRubyFile) {
      events = await analyzeRubyFile(file, customFunctionSignatures);
    } else if (isGoFile) {
      events = await analyzeGoFile(file, customFunctionSignatures);
    }

    return events;
  });

  const results = await Promise.all(analysisPromises);

  for (const events of results) {
    if (!events) continue;
    events.forEach(event => addEventToCollection(allEvents, event, baseDir));
  }
}

async function analyzeDirectory(dirPath, customFunctions) {
  const allEvents = {};

  const customFunctionSignatures = (customFunctions?.length > 0) 
    ? customFunctions.map(parseCustomFunctionSignature) 
    : null;

  const files = getAllFiles(dirPath);
  
  // Separate TypeScript files from others for optimized processing
  const tsFiles = [];
  const otherFiles = [];
  
  for (const file of files) {
    const isTsFile = /\.(tsx?)$/.test(file);
    if (isTsFile) {
      tsFiles.push(file);
    } else {
      otherFiles.push(file);
    }
  }

  // First process non-TypeScript files
  await processFiles(otherFiles, allEvents, dirPath, customFunctionSignatures);

  // Process TypeScript files with optimized batch processing
  if (tsFiles.length > 0) {
    const tsEvents = analyzeTsFiles(tsFiles, customFunctionSignatures);
    tsEvents.forEach(event => addEventToCollection(allEvents, event, dirPath));
  }

  return allEvents;
}

module.exports = { analyzeDirectory };
