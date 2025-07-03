/**
 * @fileoverview Directory analyzer for detecting analytics tracking across multiple programming languages
 * @module analyze-tracking/analyze
 */

const path = require('path');
const ts = require('typescript');
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
  const tsFiles = files.filter(file => /\.(tsx?)$/.test(file));

  // Attempt to reuse project tsconfig.json compiler options for proper module resolution (e.g., path aliases)
  let tsCompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    jsx: ts.JsxEmit.Preserve,
    allowJs: true,
    noEmit: true,
  };

  const tsConfigPath = ts.findConfigFile(dirPath, ts.sys.fileExists, 'tsconfig.json');
  if (tsConfigPath) {
    const readResult = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
    if (!readResult.error && readResult.config) {
      const parsedConfig = ts.parseJsonConfigFileContent(readResult.config, ts.sys, path.dirname(tsConfigPath));
      if (!parsedConfig.errors || parsedConfig.errors.length === 0) {
        tsCompilerOptions = { ...tsCompilerOptions, ...parsedConfig.options };
      }
    }
  }

  const tsProgram = ts.createProgram(tsFiles, tsCompilerOptions);

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
      events = analyzeTsFile(file, tsProgram, customFunctionSignatures);
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
