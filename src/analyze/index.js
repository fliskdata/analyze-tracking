const { analyzeJsFile } = require('./analyzeJsFile');
const { analyzeTsFile } = require('./analyzeTsFile');
const { getAllFiles } = require('../fileProcessor');
const ts = require('typescript');
const path = require('path');

function analyzeDirectory(dirPath) {
  const files = getAllFiles(dirPath);
  const allEvents = {};

  const tsFiles = files.filter(file => /\.(tsx?)$/.test(file));
  const program = ts.createProgram(tsFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
  });

  files.forEach((file) => {
    const isTsFile = /\.(tsx?)$/.test(file);
    const events = isTsFile ? analyzeTsFile(file, program) : analyzeJsFile(file);

    events.forEach((event) => {
      const relativeFilePath = path.relative(dirPath, event.filePath); // Calculate relative path

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
  });

  return allEvents;
}

module.exports = { analyzeDirectory };
