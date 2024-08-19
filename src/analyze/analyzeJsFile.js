const fs = require('fs');
const acorn = require('acorn');
const walk = require('acorn-walk');
const { detectSourceJs, findWrappingFunctionJs, extractJsProperties } = require('./helpers');

function analyzeJsFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const events = [];

  walk.ancestor(ast, {
    CallExpression(node, ancestors) {
      const source = detectSourceJs(node);
      if (source === 'unknown') return;

      let eventName = null;
      let propertiesNode = null;

      if (source === 'googleanalytics' && node.arguments.length >= 3) {
        eventName = node.arguments[1]?.value || null;
        propertiesNode = node.arguments[2];
      } else if (source === 'snowplow' && node.arguments.length >= 2) {
        const actionProperty = node.arguments[1].properties.find(prop => prop.key.name === 'action');
        eventName = actionProperty ? actionProperty.value.value : null;
        propertiesNode = node.arguments[1];
      } else if (node.arguments.length >= 2) {
        eventName = node.arguments[0]?.value || null;
        propertiesNode = node.arguments[1];
      }

      const line = node.loc.start.line;
      const functionName = findWrappingFunctionJs(ancestors[ancestors.length - 2]);

      if (eventName && propertiesNode && propertiesNode.type === 'ObjectExpression') {
        const properties = extractJsProperties(propertiesNode);

        events.push({
          eventName,
          source,
          properties,
          filePath,
          line,
          functionName
        });
      }
    },
  });

  return events;
}

module.exports = { analyzeJsFile };
