/**
 * @fileoverview Analytics source detection module
 * @module analyze/typescript/detectors/analytics-source
 */

const ts = require('typescript');
const { ANALYTICS_PROVIDERS } = require('../constants');

/**
 * Detects the analytics provider from a CallExpression node
 * @param {Object} node - TypeScript CallExpression node
 * @param {string} [customFunction] - Custom function name to detect
 * @returns {string} The detected analytics source or 'unknown'
 */
function detectAnalyticsSource(node, customFunction) {
  if (!node.expression) {
    return 'unknown';
  }

  // Check for custom function first
  if (customFunction && isCustomFunction(node, customFunction)) {
    return 'custom';
  }

  // Check for function-based providers (e.g., gtag)
  const functionSource = detectFunctionBasedProvider(node);
  if (functionSource !== 'unknown') {
    return functionSource;
  }

  // Check for member-based providers (e.g., analytics.track)
  const memberSource = detectMemberBasedProvider(node);
  if (memberSource !== 'unknown') {
    return memberSource;
  }

  return 'unknown';
}

/**
 * Checks if the node is a custom function call
 * @param {Object} node - TypeScript CallExpression node
 * @param {string} customFunction - Custom function name
 * @returns {boolean}
 */
function isCustomFunction(node, customFunction) {
  const canBeCustomFunction = ts.isIdentifier(node.expression) ||
    ts.isPropertyAccessExpression(node.expression) ||
    ts.isCallExpression(node.expression) || // For chained calls like getTracker().track()
    ts.isElementAccessExpression(node.expression) || // For array/object access like trackers['analytics'].track()
    (node.expression?.expression && 
     ts.isPropertyAccessExpression(node.expression.expression) && 
     node.expression.expression.expression && 
     ts.isThisExpression(node.expression.expression.expression)); // For class methods like this.analytics.track()

  return canBeCustomFunction && node.expression.getText() === customFunction;
}

/**
 * Detects function-based analytics providers
 * @param {Object} node - TypeScript CallExpression node
 * @returns {string} Provider name or 'unknown'
 */
function detectFunctionBasedProvider(node) {
  if (!ts.isIdentifier(node.expression)) {
    return 'unknown';
  }

  const functionName = node.expression.escapedText;

  for (const provider of Object.values(ANALYTICS_PROVIDERS)) {
    if (provider.type === 'function' && provider.functionName === functionName) {
      return provider.name;
    }
  }

  return 'unknown';
}

/**
 * Detects member expression-based analytics providers
 * @param {Object} node - TypeScript CallExpression node
 * @returns {string} Provider name or 'unknown'
 */
function detectMemberBasedProvider(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return 'unknown';
  }

  const methodName = node.expression.name?.escapedText;
  let objectName = node.expression.expression?.escapedText;

  // Handle nested member expressions like window.DD_RUM.addAction
  if (!objectName && ts.isPropertyAccessExpression(node.expression.expression)) {
    // For window.DD_RUM.addAction, we want to check if it matches DD_RUM.addAction pattern
    const nestedObjectName = node.expression.expression.name?.escapedText;
    if (nestedObjectName) {
      objectName = nestedObjectName;
    }
  }

  if (!objectName || !methodName) {
    return 'unknown';
  }

  for (const provider of Object.values(ANALYTICS_PROVIDERS)) {
    if (provider.type === 'member' && matchesMemberProvider(provider, objectName, methodName)) {
      return provider.name;
    }
  }

  return 'unknown';
}

/**
 * Checks if object and method names match a provider configuration
 * @param {Object} provider - Provider configuration
 * @param {string} objectName - Object name from TypeScript AST
 * @param {string} methodName - Method name from TypeScript AST
 * @returns {boolean}
 */
function matchesMemberProvider(provider, objectName, methodName) {
  if (provider.methodName !== methodName) {
    return false;
  }

  // Handle providers with multiple possible object names (e.g., mParticle/mparticle)
  if (provider.objectNames) {
    return provider.objectNames.includes(objectName);
  }

  return provider.objectName === objectName;
}

module.exports = {
  detectAnalyticsSource
};
