/**
 * @fileoverview Constants and configurations for analytics tracking providers
 * @module analyze/typescript/constants
 */

/**
 * Analytics provider configurations
 * @typedef {Object} ProviderConfig
 * @property {string} name - Provider display name
 * @property {string} objectName - Object name in JavaScript
 * @property {string} methodName - Method name for tracking
 * @property {string} type - Type of detection (member|function)
 */

/**
 * Supported analytics providers and their detection patterns
 * @type {Object.<string, ProviderConfig>}
 */
const ANALYTICS_PROVIDERS = {
  SEGMENT: {
    name: 'segment',
    objectName: 'analytics',
    methodName: 'track',
    type: 'member'
  },
  MIXPANEL: {
    name: 'mixpanel',
    objectName: 'mixpanel',
    methodName: 'track',
    type: 'member'
  },
  AMPLITUDE: {
    name: 'amplitude',
    objectName: 'amplitude',
    methodName: 'track',
    type: 'member'
  },
  RUDDERSTACK: {
    name: 'rudderstack',
    objectName: 'rudderanalytics',
    methodName: 'track',
    type: 'member'
  },
  MPARTICLE: {
    name: 'mparticle',
    objectNames: ['mParticle', 'mparticle'],
    methodName: 'logEvent',
    type: 'member'
  },
  POSTHOG: {
    name: 'posthog',
    objectName: 'posthog',
    methodName: 'capture',
    type: 'member'
  },
  PENDO: {
    name: 'pendo',
    objectName: 'pendo',
    methodName: 'track',
    type: 'member'
  },
  HEAP: {
    name: 'heap',
    objectName: 'heap',
    methodName: 'track',
    type: 'member'
  },
  SNOWPLOW: {
    name: 'snowplow',
    objectName: 'tracker',
    methodName: 'track',
    type: 'member'
  },
  GOOGLE_ANALYTICS: {
    name: 'googleanalytics',
    functionName: 'gtag',
    type: 'function'
  },
  DATADOG_RUM: {
    name: 'datadog',
    objectNames: ['datadogRum', 'DD_RUM'],
    methodName: 'addAction',
    type: 'member'
  },
  GOOGLE_TAG_MANAGER: {
    name: 'gtm',
    objectNames: ['dataLayer'],
    methodName: 'push',
    type: 'member'
  }
};

/**
 * TypeScript syntax kinds for node types we care about
 * @enum {number}
 */
const TS_NODE_KINDS = {
  CALL_EXPRESSION: 'CallExpression',
  PROPERTY_ACCESS: 'PropertyAccessExpression',
  IDENTIFIER: 'Identifier',
  OBJECT_LITERAL: 'ObjectLiteralExpression',
  ARRAY_LITERAL: 'ArrayLiteralExpression',
  STRING_LITERAL: 'StringLiteral',
  NUMERIC_LITERAL: 'NumericLiteral',
  TRUE_KEYWORD: 'TrueKeyword',
  FALSE_KEYWORD: 'FalseKeyword',
  NULL_KEYWORD: 'NullKeyword',
  UNDEFINED_KEYWORD: 'UndefinedKeyword',
  FUNCTION_DECLARATION: 'FunctionDeclaration',
  METHOD_DECLARATION: 'MethodDeclaration',
  ARROW_FUNCTION: 'ArrowFunction',
  VARIABLE_DECLARATION: 'VariableDeclaration',
  PROPERTY_ASSIGNMENT: 'PropertyAssignment',
  SHORTHAND_PROPERTY: 'ShorthandPropertyAssignment',
  PARAMETER: 'Parameter'
};

module.exports = {
  ANALYTICS_PROVIDERS,
  TS_NODE_KINDS
};
