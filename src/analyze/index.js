const { analyzeJsFile } = require('./analyzeJsFile');
const { analyzeTsFile } = require('./analyzeTsFile');
const { getAllFiles } = require('../fileProcessor');
const ts = require('typescript');
const path = require('path');

function analyzeDirectory(dirPath, repository) {
  const files = getAllFiles(dirPath);
  const allEvents = {};

  const tsFiles = files.filter(file => file.endsWith('.ts'));
  const program = ts.createProgram(tsFiles, {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
  });

  files.forEach((file) => {
    const isTsFile = file.endsWith('.ts');
    const events = isTsFile ? analyzeTsFile(file, program) : analyzeJsFile(file);

    events.forEach((event) => {
      const relativeFilePath = path.relative(dirPath, event.filePath); // Calculate relative path

      if (!allEvents[event.eventName]) {
        allEvents[event.eventName] = {
          sources: [{
            repository: repository,
            path: relativeFilePath,
            line: event.line,
            function: event.functionName
          }],
          destinations: [event.source],
          properties: event.properties,
        };
      } else {
        allEvents[event.eventName].sources.push({
          repository: repository,
          path: relativeFilePath,
          line: event.line,
          function: event.functionName
        });

        if (!allEvents[event.eventName].destinations.includes(event.source)) {
          allEvents[event.eventName].destinations.push(event.source);
        }

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
