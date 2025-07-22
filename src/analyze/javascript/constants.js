/**
 * @fileoverview Constants and configurations for analytics tracking providers
 * @module analyze/javascript/constants
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
 * Parser options for Acorn
 * @type {Object}
 */
const PARSER_OPTIONS = {
  ecmaVersion: 'latest',
  sourceType: 'module',
  locations: true
};

/**
 * AST node types
 * @enum {string}
 */
const NODE_TYPES = {
  CALL_EXPRESSION: 'CallExpression',
  MEMBER_EXPRESSION: 'MemberExpression',
  IDENTIFIER: 'Identifier',
  OBJECT_EXPRESSION: 'ObjectExpression',
  ARRAY_EXPRESSION: 'ArrayExpression',
  LITERAL: 'Literal',
  ARROW_FUNCTION: 'ArrowFunctionExpression',
  FUNCTION_EXPRESSION: 'FunctionExpression',
  FUNCTION_DECLARATION: 'FunctionDeclaration',
  METHOD_DEFINITION: 'MethodDefinition',
  VARIABLE_DECLARATOR: 'VariableDeclarator',
  EXPORT_NAMED: 'ExportNamedDeclaration',
  PROPERTY: 'Property'
};

module.exports = {
  ANALYTICS_PROVIDERS,
  PARSER_OPTIONS,
  NODE_TYPES
};
