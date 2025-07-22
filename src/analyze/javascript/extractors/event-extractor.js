/**
 * @fileoverview Event extraction logic for different analytics providers
 * @module analyze/javascript/extractors/event-extractor
 */

const { NODE_TYPES } = require('../constants');
const { extractProperties } = require('./property-extractor');

/**
 * Event data structure
 * @typedef {Object} EventData
 * @property {string|null} eventName - The event name
 * @property {Object|null} propertiesNode - AST node containing event properties
 */

/**
 * Provider-specific extraction strategies
 */
const EXTRACTION_STRATEGIES = {
  googleanalytics: extractGoogleAnalyticsEvent,
  snowplow: extractSnowplowEvent,
  mparticle: extractMparticleEvent,
  gtm: extractGTMEvent,
  custom: extractCustomEvent,
  default: extractDefaultEvent
};

/**
 * Extracts event information from a CallExpression node
 * @param {Object} node - AST CallExpression node
 * @param {string} source - Analytics provider source
 * @param {Object} constantMap - Collected constant map
 * @param {Object} customConfig - Parsed custom function configuration
 * @returns {EventData} Extracted event data
 */
function extractEventData(node, source, constantMap = {}, customConfig) {
  const strategy = EXTRACTION_STRATEGIES[source] || EXTRACTION_STRATEGIES.default;
  if (source === 'custom') {
    return strategy(node, constantMap, customConfig);
  }
  return strategy(node, constantMap);
}

/**
 * Extracts Google Analytics event data
 * @param {Object} node - CallExpression node
 * @param {Object} constantMap - Collected constant map
 * @returns {EventData}
 */
function extractGoogleAnalyticsEvent(node, constantMap) {
  if (!node.arguments || node.arguments.length < 3) {
    return { eventName: null, propertiesNode: null };
  }

  // gtag('event', 'event_name', { properties })
  const eventName = getStringValue(node.arguments[1], constantMap);
  const propertiesNode = node.arguments[2];

  return { eventName, propertiesNode };
}

/**
 * Extracts Snowplow event data
 * @param {Object} node - CallExpression node
 * @param {Object} constantMap - Collected constant map
 * @returns {EventData}
 */
function extractSnowplowEvent(node, constantMap) {
  if (!node.arguments || node.arguments.length === 0) {
    return { eventName: null, propertiesNode: null };
  }

  // tracker.track(buildStructEvent({ action: 'event_name', ... }))
  const firstArg = node.arguments[0];
  
  if (firstArg.type === NODE_TYPES.CALL_EXPRESSION && 
      firstArg.arguments.length > 0) {
    const structEventArg = firstArg.arguments[0];
    
    if (structEventArg.type === NODE_TYPES.OBJECT_EXPRESSION) {
      const actionProperty = findPropertyByKey(structEventArg, 'action');
      const eventName = actionProperty ? getStringValue(actionProperty.value, constantMap) : null;
      
      return { eventName, propertiesNode: structEventArg };
    }
  }

  return { eventName: null, propertiesNode: null };
}

/**
 * Extracts mParticle event data
 * @param {Object} node - CallExpression node
 * @param {Object} constantMap - Collected constant map
 * @returns {EventData}
 */
function extractMparticleEvent(node, constantMap) {
  if (!node.arguments || node.arguments.length < 3) {
    return { eventName: null, propertiesNode: null };
  }

  // mParticle.logEvent('event_name', mParticle.EventType.Navigation, { properties })
  const eventName = getStringValue(node.arguments[0], constantMap);
  const propertiesNode = node.arguments[2];

  return { eventName, propertiesNode };
}

/**
 * Extracts Google Tag Manager event data
 * @param {Object} node - CallExpression node
 * @param {Object} constantMap - Collected constant map
 * @returns {EventData}
 */
function extractGTMEvent(node, constantMap) {
  if (!node.arguments || node.arguments.length === 0) {
    return { eventName: null, propertiesNode: null };
  }

  // dataLayer.push({ event: 'event_name', property1: 'value1', property2: 'value2' })
  const firstArg = node.arguments[0];
  
  if (firstArg.type !== NODE_TYPES.OBJECT_EXPRESSION) {
    return { eventName: null, propertiesNode: null };
  }

  // Find the 'event' property
  const eventProperty = findPropertyByKey(firstArg, 'event');
  if (!eventProperty) {
    return { eventName: null, propertiesNode: null };
  }

  const eventName = getStringValue(eventProperty.value, constantMap);
  
  // Create a modified properties node without the 'event' property
  const modifiedPropertiesNode = {
    ...firstArg,
    properties: firstArg.properties.filter(prop => 
      prop.key && (prop.key.name !== 'event' && prop.key.value !== 'event')
    )
  };

  return { eventName, propertiesNode: modifiedPropertiesNode };
}

/**
 * Default event extraction for standard providers
 * @param {Object} node - CallExpression node
 * @param {Object} constantMap - Collected constant map
 * @returns {EventData}
 */
function extractDefaultEvent(node, constantMap) {
  if (!node.arguments || node.arguments.length < 2) {
    return { eventName: null, propertiesNode: null };
  }

  // provider.track('event_name', { properties })
  const eventName = getStringValue(node.arguments[0], constantMap);
  const propertiesNode = node.arguments[1];

  return { eventName, propertiesNode };
}

/**
 * Extracts Custom function event data according to signature
 * @param {Object} node - CallExpression node
 * @param {Object} constantMap - Collected constant map
 * @param {Object} customConfig - Parsed custom function configuration
 * @returns {EventData & {extraArgs:Object}} event data plus extra args map
 */
function extractCustomEvent(node, constantMap, customConfig) {
  const args = node.arguments || [];

  const eventArg = args[customConfig?.eventIndex ?? 0];
  const propertiesArg = args[customConfig?.propertiesIndex ?? 1];

  const eventName = getStringValue(eventArg, constantMap);

  const extraArgs = {};
  if (customConfig && customConfig.extraParams) {
    customConfig.extraParams.forEach(extra => {
      extraArgs[extra.name] = args[extra.idx];
    });
  }

  return { eventName, propertiesNode: propertiesArg, extraArgs };
}

/**
 * Processes extracted event data into final event object
 * @param {EventData} eventData - Raw event data
 * @param {string} source - Analytics source
 * @param {string} filePath - File path
 * @param {number} line - Line number
 * @param {string} functionName - Containing function name
 * @param {Object} customConfig - Parsed custom function configuration
 * @returns {Object|null} Processed event object or null
 */
function processEventData(eventData, source, filePath, line, functionName, customConfig) {
  const { eventName, propertiesNode } = eventData;

  // Must at least have an event name – properties are optional.
  if (!eventName) {
    return null;
  }

  // Default to empty properties when none are supplied.
  let properties = {};

  // Only attempt extraction when we have a literal object expression.
  if (propertiesNode && propertiesNode.type === NODE_TYPES.OBJECT_EXPRESSION) {
    properties = extractProperties(propertiesNode);
  }

  // Handle custom extra params
  if (source === 'custom' && customConfig && eventData.extraArgs) {
    for (const [paramName, argNode] of Object.entries(eventData.extraArgs)) {
      if (argNode && argNode.type === NODE_TYPES.OBJECT_EXPRESSION) {
        // Extract detailed properties from object expression
        properties[paramName] = {
          type: 'object',
          properties: extractProperties(argNode)
        };
      } else {
        // For non-object arguments, use simple type inference
        properties[paramName] = {
          type: inferNodeValueType(argNode)
        };
      }
    }
  }

  // Special handling for Snowplow: remove 'action' from properties
  if (source === 'snowplow' && properties.action) {
    delete properties.action;
  }

  return {
    eventName,
    source,
    properties,
    filePath,
    line,
    functionName
  };
}

/**
 * Gets string value from an AST node
 * @param {Object} node - AST node
 * @param {Object} constantMap - Collected constant map
 * @returns {string|null} String value or null
 */
function getStringValue(node, constantMap = {}) {
  if (!node) return null;
  if (node.type === NODE_TYPES.LITERAL && typeof node.value === 'string') {
    return node.value;
  }
  if (node.type === NODE_TYPES.MEMBER_EXPRESSION) {
    return resolveMemberExpressionToString(node, constantMap);
  }
  return null;
}

/**
 * Finds a property by key in an ObjectExpression
 * @param {Object} objectNode - ObjectExpression node
 * @param {string} key - Property key to find
 * @returns {Object|null} Property node or null
 */
function findPropertyByKey(objectNode, key) {
  if (!objectNode.properties) return null;
  
  return objectNode.properties.find(prop => 
    prop.key && (prop.key.name === key || prop.key.value === key)
  );
}

/**
 * Infers the type of a value from an AST node (simple heuristic)
 * @param {Object} node - AST node
 * @returns {string} inferred type
 */
function inferNodeValueType(node) {
  if (!node) return 'any';
  switch (node.type) {
    case NODE_TYPES.LITERAL:
      return typeof node.value;
    case NODE_TYPES.OBJECT_EXPRESSION:
      return 'object';
    case NODE_TYPES.ARRAY_EXPRESSION:
      return 'array';
    default:
      return 'any';
  }
}

// Helper to resolve MemberExpression (CONST.KEY) to string using collected constant map
function resolveMemberExpressionToString(node, constantMap) {
  if (!node || node.type !== NODE_TYPES.MEMBER_EXPRESSION) return null;
  if (node.computed) return null; // Only support dot notation

  const object = node.object;
  const property = node.property;

  if (object.type !== NODE_TYPES.IDENTIFIER) return null;
  if (property.type !== NODE_TYPES.IDENTIFIER) return null;

  const objName = object.name;
  const propName = property.name;

  if (constantMap && constantMap[objName] && typeof constantMap[objName][propName] === 'string') {
    return constantMap[objName][propName];
  }
  return null;
}

module.exports = {
  extractEventData,
  processEventData
};
