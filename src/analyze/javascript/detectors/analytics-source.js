/**
 * @fileoverview Analytics source detection module
 * @module analyze/javascript/detectors/analytics-source
 */

const { ANALYTICS_PROVIDERS, NODE_TYPES } = require('../constants');

/**
 * Detects the analytics provider from a CallExpression node
 * @param {Object} node - AST CallExpression node
 * @param {string} [customFunction] - Custom function name to detect
 * @returns {string} The detected analytics source or 'unknown'
 */
function detectAnalyticsSource(node, customFunction) {
  if (!node.callee) {
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
 * @param {Object} node - AST CallExpression node
 * @param {string} customFunction - Custom function name
 * @returns {boolean}
 */
function isCustomFunction(node, customFunction) {
  if (!customFunction) return false;

  // Support dot-separated names like "CustomModule.track"
  const parts = customFunction.split('.');

  // Simple identifier (no dot)
  if (parts.length === 1) {
    return node.callee.type === NODE_TYPES.IDENTIFIER && node.callee.name === customFunction;
  }

  // For dot-separated names, the callee should be a MemberExpression chain.
  if (node.callee.type !== NODE_TYPES.MEMBER_EXPRESSION) {
    return false;
  }

  return matchesMemberChain(node.callee, parts);
}

/**
 * Recursively verifies that a MemberExpression chain matches the expected parts.
 * Example: parts ["CustomModule", "track"] should match `CustomModule.track()`.
 * @param {Object} memberExpr - AST MemberExpression node
 * @param {string[]} parts - Expected name segments (left -> right)
 * @returns {boolean}
 */
function matchesMemberChain(memberExpr, parts) {
  let currentNode = memberExpr;
  let idx = parts.length - 1; // start from the rightmost property

  while (currentNode && idx >= 0) {
    const expectedPart = parts[idx];

    // property should match current expectedPart
    if (currentNode.type === NODE_TYPES.MEMBER_EXPRESSION) {
      // Ensure property is Identifier and matches
      if (
        currentNode.property.type !== NODE_TYPES.IDENTIFIER ||
        currentNode.property.name !== expectedPart
      ) {
        return false;
      }

      // Move to the object of the MemberExpression
      currentNode = currentNode.object;
      idx -= 1;
    } else if (currentNode.type === NODE_TYPES.IDENTIFIER) {
      // We reached the leftmost Identifier; it should match the first part
      return idx === 0 && currentNode.name === expectedPart;
    } else {
      // Unexpected node type (e.g., ThisExpression, CallExpression, etc.)
      return false;
    }
  }

  return false;
}

/**
 * Detects function-based analytics providers
 * @param {Object} node - AST CallExpression node
 * @returns {string} Provider name or 'unknown'
 */
function detectFunctionBasedProvider(node) {
  if (node.callee.type !== NODE_TYPES.IDENTIFIER) {
    return 'unknown';
  }

  const functionName = node.callee.name;
  
  for (const provider of Object.values(ANALYTICS_PROVIDERS)) {
    if (provider.type === 'function' && provider.functionName === functionName) {
      return provider.name;
    }
  }

  return 'unknown';
}

/**
 * Detects member expression-based analytics providers
 * @param {Object} node - AST CallExpression node
 * @returns {string} Provider name or 'unknown'
 */
function detectMemberBasedProvider(node) {
  if (node.callee.type !== NODE_TYPES.MEMBER_EXPRESSION) {
    return 'unknown';
  }

  const methodName = node.callee.property.name;
  let objectName = node.callee.object.name;

  // Handle nested member expressions like window.DD_RUM.addAction
  if (!objectName && node.callee.object.type === NODE_TYPES.MEMBER_EXPRESSION) {
    // For window.DD_RUM.addAction, we want to check if it matches DD_RUM.addAction pattern
    const nestedObjectName = node.callee.object.property.name;
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
 * @param {string} objectName - Object name from AST
 * @param {string} methodName - Method name from AST
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
