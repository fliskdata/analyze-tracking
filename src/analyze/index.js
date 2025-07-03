/**
 * @fileoverview Directory analyzer for detecting analytics tracking across multiple programming languages
 * @module analyze-tracking/analyze
 */

const path = require('path');

const { parseCustomFunctionSignature } = require('./utils/customFunctionParser');
const { getAllFiles } = require('../utils/fileProcessor');
const { analyzeJsFile } = require('./javascript');
const { analyzeTsFile } = require('./typescript');
const { analyzePythonFile } = require('./python');
const { analyzeRubyFile } = require('./ruby');
const { analyzeGoFile } = require('./go');

async function analyzeDirectory(dirPath, customFunctions) {
  const allEvents = {};

  const customFunctionSignatures = (customFunctions && customFunctions?.length > 0) ? customFunctions.map(parseCustomFunctionSignature) : null;

  const files = getAllFiles(dirPath);

  for (const file of files) {
    let events = [];

    const isJsFile = /\.(jsx?)$/.test(file);
    const isTsFile = /\.(tsx?)$/.test(file);
    const isPythonFile = /\.(py)$/.test(file);
    const isRubyFile = /\.(rb)$/.test(file);
    const isGoFile = /\.(go)$/.test(file);

    if (isJsFile) {
      events = analyzeJsFile(file, customFunctionSignatures);
    } else if (isTsFile) {
      // Pass null program so analyzeTsFile will create a per-file program using the file's nearest tsconfig.json
      events = analyzeTsFile(file, null, customFunctionSignatures);
    } else if (isPythonFile) {
      events = await analyzePythonFile(file, customFunctionSignatures);
    } else if (isRubyFile) {
      events = await analyzeRubyFile(file, customFunctionSignatures);
    } else if (isGoFile) {
      events = await analyzeGoFile(file, customFunctionSignatures);
    } else {
      continue;
    }

    events.forEach((event) => {
      const relativeFilePath = path.relative(dirPath, event.filePath);

      if (!allEvents[event.eventName]) {
        allEvents[event.eventName] = {
          implementations: [{
            path: relativeFilePath,
            line: event.line,
            function: event.functionName,
            destination: event.source
          }],
          properties: event.properties,
        };
      } else {
        allEvents[event.eventName].implementations.push({
          path: relativeFilePath,
          line: event.line,
          function: event.functionName,
          destination: event.source
        });

        allEvents[event.eventName].properties = {
          ...allEvents[event.eventName].properties,
          ...event.properties,
        };
      }
    });
  }

  return allEvents;
}

module.exports = { analyzeDirectory };
