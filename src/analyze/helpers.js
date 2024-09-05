const ts = require('typescript');

function detectSourceJs(node, customFunction) {
  if (!node.callee) return 'unknown';

  if (node.callee.type === 'Identifier' && node.callee.name === 'gtag') {
    return 'googleanalytics';
  }

  if (node.callee.type === 'MemberExpression') {
    const objectName = node.callee.object.name;
    const methodName = node.callee.property.name;

    if (objectName === 'analytics' && methodName === 'track') return 'segment';
    if (objectName === 'mixpanel' && methodName === 'track') return 'mixpanel';
    if (objectName === 'amplitude' && methodName === 'logEvent') return 'amplitude';
    if (objectName === 'rudderanalytics' && methodName === 'track') return 'rudderstack';
    if (objectName === 'mParticle' && methodName === 'logEvent') return 'mparticle';
    if (objectName === 'posthog' && methodName === 'capture') return 'posthog';
    if (objectName === 'pendo' && methodName === 'track') return 'pendo';
    if (objectName === 'heap' && methodName === 'track') return 'heap';
  }

  if (node.callee.type === 'Identifier' && node.callee.name === 'snowplow') {
    return 'snowplow';
  }

  if (node.callee.type === 'Identifier' && node.callee.name === customFunction) {
    return 'custom';
  }

  return 'unknown';
}

function detectSourceTs(node, customFunction) {
  if (!node.expression) return 'unknown';

  if (ts.isIdentifier(node.expression) && node.expression.escapedText === 'gtag') {
    return 'googleanalytics';
  }
  
  if (ts.isPropertyAccessExpression(node.expression)) {
    const objectName = node.expression.expression.escapedText;
    const methodName = node.expression.name.escapedText;

    if (objectName === 'analytics' && methodName === 'track') return 'segment';
    if (objectName === 'mixpanel' && methodName === 'track') return 'mixpanel';
    if (objectName === 'amplitude' && methodName === 'logEvent') return 'amplitude';
    if (objectName === 'rudderanalytics' && methodName === 'track') return 'rudderstack';
    if (objectName === 'mParticle' && methodName === 'logEvent') return 'mparticle';
    if (objectName === 'posthog' && methodName === 'capture') return 'posthog';
    if (objectName === 'pendo' && methodName === 'track') return 'pendo';
    if (objectName === 'heap' && methodName === 'track') return 'heap';
  }
  
  if (ts.isIdentifier(node.expression) && node.expression.escapedText === 'snowplow') {
    return 'snowplow';
  }

  if (ts.isIdentifier(node.expression) && node.expression.escapedText === customFunction) {
    return 'custom';
  }

  return 'unknown';
}

function findWrappingFunctionTs(node) {
  let current = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) || ts.isMethodDeclaration(current) || ts.isArrowFunction(current)) {
      return current.name ? current.name.escapedText : 'anonymous';
    }
    current = current.parent;
  }
  return 'global';
}

function findWrappingFunctionJs(node, ancestors) {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];

    // Handle direct variable assignments (e.g., const myFunc = () => {})
    if (current.type === 'VariableDeclarator' && current.init === node) {
      return current.id.name;
    }

    // Handle arrow functions or function expressions assigned to variables
    if (current.type === 'VariableDeclarator' && (current.init.type === 'ArrowFunctionExpression' || current.init.type === 'FunctionExpression')) {
      return current.id.name;
    }

    // Handle named function declarations
    if (current.type === 'FunctionDeclaration') {
      return current.id ? current.id.name : 'anonymous';
    }

    // Handle exported variable/function (e.g., export const myFunc = () => {})
    if (current.type === 'ExportNamedDeclaration' && current.declaration) {
      const declaration = current.declaration.declarations ? current.declaration.declarations[0] : null;
      if (declaration && (declaration.init.type === 'ArrowFunctionExpression' || declaration.init.type === 'FunctionExpression')) {
        return declaration.id.name;
      }
    }

    // Handle methods within object literals
    if (current.type === 'Property' && current.value === node) {
      return current.key.name || current.key.value;
    }
  }
  return 'global';
}

function extractJsProperties(node) {
  const properties = {};

  node.properties.forEach((prop) => {
    const key = prop.key?.name || prop.key?.value;
    if (key) {
      let valueType = typeof prop.value.value;
      if (prop.value.type === 'ObjectExpression') {
        properties[key] = {
          type: 'object',
          properties: extractJsProperties(prop.value),
        };
      } else {
        if (valueType === 'undefined') {
          valueType = 'any';
        } else if (valueType === 'object') {
          valueType = 'any';
        }
        properties[key] = { type: valueType };
      }
    }
  });

  return properties;
}

function extractTsProperties(checker, node) {
  const properties = {};

  for (const prop of node.properties) {
    const key = !!prop.name ? prop.name.text : (!!prop.key ? (prop.key.text || prop.key.value) : undefined);
    if (!key) continue;
    let valueType = 'any';

    if (ts.isShorthandPropertyAssignment(prop)) {
      const symbol = checker.getSymbolAtLocation(prop.name);
      if (symbol) {
        valueType = getTypeOfNode(checker, symbol.valueDeclaration);
        properties[key] = { type: valueType };
      }
    } else if (prop.initializer) {
      if (ts.isObjectLiteralExpression(prop.initializer)) {
        properties[key] = {
          type: 'object',
          properties: extractTsProperties(checker, prop.initializer),
        };
      } else if (ts.isArrayLiteralExpression(prop.initializer)) {
        properties[key] = {
          type: 'array',
          items: {
            type: getTypeOfNode(checker, prop.initializer.elements[0]) || 'any',
          },
        };
      } else {
        // Handle hard-coded values
        switch (prop.initializer.kind) {
          case ts.SyntaxKind.StringLiteral:
            valueType = 'string';
            break;
          case ts.SyntaxKind.NumericLiteral:
            valueType = 'number';
            break;
          case ts.SyntaxKind.TrueKeyword:
          case ts.SyntaxKind.FalseKeyword:
            valueType = 'boolean';
            break;
          case ts.SyntaxKind.ArrayLiteralExpression:
            valueType = 'array';
            break;
          case ts.SyntaxKind.ObjectLiteralExpression:
            valueType = 'object';
            break;
          default:
            valueType = 'any';
        }

        if (valueType === 'any') {
          valueType = getTypeOfNode(checker, prop.initializer) || 'any';
        }

        properties[key] = { type: valueType };
      }
    } else if (prop.type) {
      valueType = checker.typeToString(checker.getTypeFromTypeNode(prop.type)) || 'any';
      properties[key] = { type: valueType };
    }
  }

  return properties;
}

function getTypeOfNode(checker, node) {
  const type = checker.getTypeAtLocation(node);
  return checker.typeToString(type);
}

module.exports = {
  detectSourceJs,
  detectSourceTs,
  findWrappingFunctionTs,
  findWrappingFunctionJs,
  extractJsProperties,
  extractTsProperties,
  getTypeOfNode,
};
