const ts = require('typescript');
const { detectSourceTs, findWrappingFunctionTs, extractTsProperties } = require('./helpers');

function analyzeTsFile(filePath, program, customFunction) {
  let events = [];
  try {
    const sourceFile = program.getSourceFile(filePath);
    if (!sourceFile) {
      console.error(`Error: Unable to get source file for ${filePath}`);
      return events;
    }

    const checker = program.getTypeChecker();

    function visit(node) {
      try {
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
            try {
              const properties = extractTsProperties(checker, propertiesNode);
              events.push({
                eventName,
                source,
                properties,
                filePath,
                line,
                functionName
              });
            } catch (propertyError) {
              console.error(`Error extracting properties in ${filePath} at line ${line}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      } catch (nodeError) {
        console.error(`Error processing node in ${filePath}`);
      }
    }

    ts.forEachChild(sourceFile, visit);
  } catch (fileError) {
    console.error(`Error analyzing TypeScript file ${filePath}`);
  }

  return events;
}

module.exports = { analyzeTsFile };
