/**
 * @fileoverview Constants and configurations for Swift analytics tracking providers
 * @module analyze/swift/constants
 */

/**
 * Analytics provider configurations for Swift
 * @typedef {Object} SwiftProviderConfig
 * @property {string} name - Provider display name
 * @property {string} objectName - Object name in Swift
 * @property {string} methodName - Method name for tracking
 * @property {string} type - Type of detection (method|function|struct)
 * @property {Array<string>} [objectNames] - Alternative object names
 */

/**
 * Supported analytics providers and their detection patterns for Swift
 * @type {Object.<string, SwiftProviderConfig>}
 */
const ANALYTICS_PROVIDERS = {
  SEGMENT: {
    name: 'segment',
    objectName: 'Analytics',
    methodName: 'track',
    type: 'method',
    chainMethods: ['shared()']
  },
  MIXPANEL: {
    name: 'mixpanel',
    objectName: 'Mixpanel',
    methodName: 'track',
    type: 'method',
    chainMethods: ['mainInstance()']
  },
  AMPLITUDE: {
    name: 'amplitude',
    objectName: 'amplitude',
    methodName: 'track',
    type: 'method'
  },
  RUDDERSTACK: {
    name: 'rudderstack',
    objectName: 'RSClient',
    methodName: 'track',
    type: 'method',
    chainMethods: ['sharedInstance()']
  },
  MPARTICLE: {
    name: 'mparticle',
    objectName: 'MParticle',
    methodName: 'logEvent',
    type: 'method',
    chainMethods: ['sharedInstance()']
  },
  POSTHOG: {
    name: 'posthog',
    objectName: 'PostHogSDK',
    methodName: 'capture',
    type: 'method',
    property: 'shared'
  },
  PENDO: {
    name: 'pendo',
    objectName: 'PendoManager',
    methodName: 'track',
    type: 'method',
    chainMethods: ['shared()']
  },
  HEAP: {
    name: 'heap',
    objectName: 'Heap',
    methodName: 'track',
    type: 'method',
    property: 'shared'
  },
  SNOWPLOW: {
    name: 'snowplow',
    objectName: 'tracker',
    methodName: 'track',
    type: 'method',
    structName: 'Structured'
  },
  FIREBASE: {
    name: 'firebase',
    objectName: 'Analytics',
    methodName: 'logEvent',
    type: 'method'
  }
};

/**
 * Swift type mappings to schema types
 * @type {Object.<string, string>}
 */
const SWIFT_TYPE_MAPPINGS = {
  'String': 'string',
  'Int': 'number',
  'Double': 'number',
  'Float': 'number',
  'Bool': 'boolean',
  'NSNumber': 'number',
  'NSString': 'string',
  'Array': 'array',
  'Dictionary': 'object',
  'Any': 'any'
};

/**
 * Swift literal value type detection patterns
 * @type {Object.<string, string>}
 */
const LITERAL_TYPE_PATTERNS = {
  'string': /^".*"$/,
  'number': /^-?\d+(\.\d+)?$/,
  'boolean': /^(true|false)$/,
  'null': /^nil$/
};

/**
 * Maximum recursion depth for Swift AST traversal
 * @type {number}
 */
const MAX_RECURSION_DEPTH = 50;

module.exports = {
  ANALYTICS_PROVIDERS,
  SWIFT_TYPE_MAPPINGS,
  LITERAL_TYPE_PATTERNS,
  MAX_RECURSION_DEPTH
};