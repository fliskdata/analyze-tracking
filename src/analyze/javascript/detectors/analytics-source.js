/**
 * @fileoverview Analytics source detection module
 * @module analyze/javascript/detectors/analytics-source
 */

const { ANALYTICS_PROVIDERS, NODE_TYPES } = require('../constants');

/**
 * Detects the analytics provider from a CallExpression node
 * @param {Object} node - AST CallExpression node
 * @param {string|Object} [customFunctionOrConfig] - Custom function name string or custom config object
 * @returns {string} The detected analytics source or 'unknown'
 */
function detectAnalyticsSource(node, customFunctionOrConfig) {
  if (!node.callee) {
    return 'unknown';
  }

  // Check for custom function first
  // Support both old string format and new config object format
  const customConfig = typeof customFunctionOrConfig === 'object' ? customFunctionOrConfig : null;
  const customFunction = typeof customFunctionOrConfig === 'string' ? customFunctionOrConfig : (customConfig?.functionName);

  if (customConfig?.isMethodAsEvent) {
    // Method-as-event pattern: match any method on the specified object
    if (isMethodAsEventFunction(node, customConfig)) {
      return 'custom';
    }
  } else if (customFunction && isCustomFunction(node, customFunction)) {
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
 * Checks if the node matches a method-as-event custom function pattern
 * @param {Object} node - AST CallExpression node
 * @param {Object} customConfig - Custom function configuration with isMethodAsEvent: true
 * @returns {boolean}
 */
function isMethodAsEventFunction(node, customConfig) {
  if (!customConfig?.isMethodAsEvent || !customConfig?.objectName) {
    return false;
  }

  // Must be a MemberExpression: objectName.methodName(...)
  if (node.callee.type !== NODE_TYPES.MEMBER_EXPRESSION) {
    return false;
  }

  // The object part must match the configured objectName
  const objectNode = node.callee.object;
  if (objectNode.type !== NODE_TYPES.IDENTIFIER) {
    return false;
  }

  return objectNode.name === customConfig.objectName;
}

/**
 * Checks if the node is a custom function call
 * @param {Object} node - AST CallExpression node
 * @param {string} customFunction - Custom function name
 * @returns {boolean}
 */
function isCustomFunction(node, customFunction) {
  if (!customFunction) return false;

  // Support dot-separated names like "CustomModule.track" and chained calls like "getTrackingService().track"
  // Normalize each segment by stripping trailing parentheses
  const parts = customFunction.split('.').map(p => p.replace(/\(\s*\)$/, ''));

  // Simple identifier (no dot)
  if (parts.length === 1) {
    return node.callee.type === NODE_TYPES.IDENTIFIER && node.callee.name === parts[0];
  }

  // For dot-separated names, the callee should be a MemberExpression chain,
  // but we also allow CallExpression in the chain (e.g., getService().track)
  const callee = node.callee;
  if (callee.type !== NODE_TYPES.MEMBER_EXPRESSION && callee.type !== NODE_TYPES.CALL_EXPRESSION) {
    return false;
  }

  return matchesMemberChain(callee, parts);
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

    if (currentNode.type === NODE_TYPES.MEMBER_EXPRESSION) {
      // Ensure property is Identifier and matches the expected part
      if (
        currentNode.property.type !== NODE_TYPES.IDENTIFIER ||
        currentNode.property.name !== expectedPart
      ) {
        return false;
      }

      // Move to the object (which could itself be a MemberExpression, Identifier, or CallExpression)
      currentNode = currentNode.object;
      idx -= 1;
      continue;
    }

    // If we encounter a CallExpression in the chain (e.g., getService().track),
    // step into its callee without consuming an expected part.
    if (currentNode.type === NODE_TYPES.CALL_EXPRESSION) {
      currentNode = currentNode.callee;
      continue;
    }

    if (currentNode.type === NODE_TYPES.IDENTIFIER) {
      return idx === 0 && currentNode.name === expectedPart;
    }

    // Unexpected node type (e.g., ThisExpression, Literal, etc.)
    return false;
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
