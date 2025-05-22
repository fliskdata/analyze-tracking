const path = require('path');
const ts = require('typescript');
const { getAllFiles } = require('../fileProcessor');
const { analyzeJsFile } = require('./analyzeJsFile');
const { analyzeTsFile } = require('./analyzeTsFile');
const { analyzePythonFile } = require('./analyzePythonFile');
const { analyzeRubyFile } = require('./analyzeRubyFile');

async function analyzeDirectory(dirPath, customFunction) {
  const allEvents = {};

  const files = getAllFiles(dirPath);
  const tsFiles = files.filter(file => /\.(tsx?)$/.test(file));
  const tsProgram = ts.createProgram(tsFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
  });

  for (const file of files) {
    let events = [];

    const isJsFile = /\.(jsx?)$/.test(file);
    const isTsFile = /\.(tsx?)$/.test(file);
    const isPythonFile = /\.(py)$/.test(file);
    const isRubyFile = /\.(rb)$/.test(file);

    if (isJsFile) {
      events = analyzeJsFile(file, customFunction);
    } else if (isTsFile) {
      events = analyzeTsFile(file, tsProgram, customFunction);
    } else if (isPythonFile) {
      events = await analyzePythonFile(file, customFunction);
    } else if (isRubyFile) {
      events = await analyzeRubyFile(file);
    } else {
      console.info(`Skipping file ${file} because it is not a supported file type`);
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
