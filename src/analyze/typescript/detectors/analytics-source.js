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
  if (!customFunction || !node || !node.expression) return false;

  // Normalize signature parts by stripping trailing parentheses from each part
  const parts = customFunction.split('.').map(p => p.replace(/\(\s*\)$/, ''));

  return matchesExpressionChain(node.expression, parts);
}

/**
 * Recursively verify that a CallExpression/PropertyAccessExpression chain matches the expected parts.
 * Supports patterns like getTracker().track, this.props.customTrackFunction6, tracker.track
 */
function matchesExpressionChain(expr, parts) {
  let current = expr;
  let idx = parts.length - 1;

  while (current && idx >= 0) {
    const expected = parts[idx];

    if (ts.isPropertyAccessExpression(current)) {
      const name = current.name?.escapedText;
      if (name !== expected) return false;
      current = current.expression;
      idx -= 1;
      continue;
    }

    if (ts.isCallExpression(current)) {
      // Step into the callee (e.g., getTracker() -> getTracker)
      current = current.expression;
      continue;
    }

    if (ts.isIdentifier(current)) {
      return idx === 0 && current.escapedText === expected;
    }

    // Handle `this` without relying on ts.isThisExpression for compatibility across TS versions
    if (current.kind === ts.SyntaxKind.ThisKeyword || current.kind === ts.SyntaxKind.ThisExpression) {
      return idx === 0 && expected === 'this';
    }

    // Unsupported expression kind for our matcher
    return false;
  }

  return false;
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
