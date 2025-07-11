/**
 * @fileoverview Directory analyzer for detecting analytics tracking across multiple programming languages
 * @module analyze-tracking/analyze
 */

const path = require('path');
const { execSync } = require('child_process');

const { parseCustomFunctionSignature } = require('./utils/customFunctionParser');
const { getAllFiles } = require('../utils/fileProcessor');
const { analyzeJsFile } = require('./javascript');
const { analyzeTsFiles } = require('./typescript');
const { analyzePythonFile } = require('./python');
const { analyzeRubyFile, prebuildConstantMaps } = require('./ruby');
const { analyzeGoFile } = require('./go');

/**
 * Analyzes a single file for analytics tracking calls
 * 
 * Note: typescript files are handled separately by analyzeTsFiles, which is a batch processor
 * 
 * @param {string} file - Path to the file to analyze
 * @param {Array<string>} customFunctionSignatures - Custom function signatures to detect
 * @returns {Promise<Array<Object>>} Array of events found in the file
 */
async function analyzeFile(file, customFunctionSignatures) {
  if (/\.jsx?$/.test(file)) return analyzeJsFile(file, customFunctionSignatures)
  if (/\.py$/.test(file))   return analyzePythonFile(file, customFunctionSignatures)
  if (/\.rb$/.test(file))   return analyzeRubyFile(file, customFunctionSignatures)
  if (/\.go$/.test(file))   return analyzeGoFile(file, customFunctionSignatures)
  return []
}

/**
 * Adds an event to the events collection, merging properties if event already exists
 * 
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
 * Processes all files that are not TypeScript files in parallel
 * 
 * Checks the system's file descriptor limit and uses 80% of it to avoid running out of file descriptors
 * Creates a promise pool and launches one analysis for each file in parallel
 * When a slot frees up, the next file is launched
 * Waits for the remaining work to complete
 * 
 * @param {Array<string>} files - Array of file paths
 * @param {Object} allEvents - Collection to add events to
 * @param {string} baseDir - Base directory for relative paths
 * @param {Array} customFunctionSignatures - Custom function signatures to detect
 */
async function processFiles(files, allEvents, baseDir, customFunctionSignatures) {
  // Default concurrency limit
  let concurrencyLimit = 64;

  // Detect soft file descriptor limit from the system using `ulimit -n` (POSIX shells)
  try {
    const stdout = execSync('sh -c "ulimit -n"', { encoding: 'utf8' }).trim();
    if (stdout !== 'unlimited') {
      const limit = parseInt(stdout, 10);
      if (!Number.isNaN(limit) && limit > 0) {
        // Use 80% of the limit to keep head-room for other descriptors
        concurrencyLimit = Math.max(4, Math.floor(limit * 0.8));
      }
    }
  } catch (_) {}

  let next = 0;                   // index of the next file to start
  const inFlight = new Set();     // promises currently running

  // helper: launch one analysis and wire bookkeeping
  const launch = (file) => {
    const p = analyzeFile(file, customFunctionSignatures)
      .then((events) => {
        if (events) events.forEach(e => addEventToCollection(allEvents, e, baseDir))
      })
      .finally(() => inFlight.delete(p));
    inFlight.add(p);
  }

  // prime the pool
  while (next < Math.min(concurrencyLimit, files.length)) {
    launch(files[next++]);
  }

  // whenever a slot frees up, start the next file
  while (next < files.length) {
    await Promise.race(inFlight); // wait for one to finish
    launch(files[next++]);        // and immediately fill the slot
  }

  // wait for the remaining work
  await Promise.all(inFlight);
}

/**
 * Analyze a directory recursively for analytics tracking calls
 * 
 * This function scans all supported files in a directory tree and identifies analytics tracking calls,
 * handling different file types appropriately.
 * 
 * @param {string} dirPath - Path to the directory to analyze
 * @param {Array<string>} [customFunctions=null] - Array of custom tracking function signatures to detect
 * @returns {Promise<Object>} Object mapping event names to their tracking implementations
 */
async function analyzeDirectory(dirPath, customFunctions) {
  const allEvents = {};

  const customFunctionSignatures = (customFunctions?.length > 0) 
    ? customFunctions.map(parseCustomFunctionSignature) 
    : null;

  const files = getAllFiles(dirPath);
  
  // Separate TypeScript files from others for optimized processing
  const tsFiles = [];
  const nonTsFiles = [];
  const rubyFiles = [];
  
  for (const file of files) {
    const isTsFile = /\.(tsx?)$/.test(file);
    if (isTsFile) {
      tsFiles.push(file);
    } else {
      nonTsFiles.push(file);
      if (/\.rb$/.test(file)) {
        rubyFiles.push(file);
      }
    }
  }

  // Prebuild constant maps for all Ruby directories to ensure constant resolution across files
  if (rubyFiles.length > 0) {
    await prebuildConstantMaps(rubyFiles);
  }

  // First process non-TypeScript files
  await processFiles(nonTsFiles, allEvents, dirPath, customFunctionSignatures);

  // Process TypeScript files with optimized batch processing
  if (tsFiles.length > 0) {
    const tsEvents = analyzeTsFiles(tsFiles, customFunctionSignatures);
    tsEvents.forEach(event => addEventToCollection(allEvents, event, dirPath));
  }

  return allEvents;
}

module.exports = { analyzeDirectory };
