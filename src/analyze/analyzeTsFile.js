const ts = require('typescript');
const { detectSourceTs, findWrappingFunctionTs, extractTsProperties } = require('./helpers');

function analyzeTsFile(filePath, program, customFunction) {
  const sourceFile = program.getSourceFile(filePath);
  const checker = program.getTypeChecker();
  const events = [];

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const source = detectSourceTs(node, customFunction);
      if (source === 'unknown') return;

      let eventName = null;
      let propertiesNode = null;

      if (source === 'googleanalytics' && node.arguments.length >= 3) {
        eventName = node.arguments[1]?.text || null;
        propertiesNode = node.arguments[2];
      } else if (source === 'snowplow' && node.arguments.length >= 2) {
        const actionProperty = node.arguments[1].properties.find(prop => prop.name.escapedText === 'action');
        eventName = actionProperty ? actionProperty.initializer.text : null;
        propertiesNode = node.arguments[1];
      } else if (node.arguments.length >= 2) {
        eventName = node.arguments[0]?.text || null;
        propertiesNode = node.arguments[1];
      }

      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
      const functionName = findWrappingFunctionTs(node);

      if (eventName && propertiesNode && ts.isObjectLiteralExpression(propertiesNode)) {
        const properties = extractTsProperties(checker, propertiesNode);
        events.push({
          eventName,
          source,
          properties,
          filePath,
          line,
          functionName
        });
      }
    }
    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceFile, visit);

  return events;
}

module.exports = { analyzeTsFile };
