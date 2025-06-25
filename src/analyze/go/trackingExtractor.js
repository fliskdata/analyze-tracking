/**
 * @fileoverview Tracking event extraction from Go function calls
 * @module analyze/go/trackingExtractor
 */

const { ANALYTICS_SOURCES } = require('./constants');
const { detectSource } = require('./trackingDetector');
const { extractEventName } = require('./eventExtractor');
const { extractProperties } = require('./propertyExtractor');

/**
 * Extract tracking event information from a node
 * @param {Object} callNode - AST node representing a function call or struct literal
 * @param {string} filePath - Path to the file being analyzed
 * @param {string} functionName - Name of the function containing this tracking call
 * @param {Object|null} customConfig - Parsed custom function configuration (or null)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 * @returns {Object|null} Tracking event object with eventName, source, properties, etc., or null if not a tracking call
 */
function extractTrackingEvent(callNode, filePath, functionName, customConfig, typeContext, currentFunction) {
  const source = detectSource(callNode, customConfig ? customConfig.functionName : null);
  if (!source) return null;
  
  const eventName = extractEventName(callNode, source, customConfig);
  if (!eventName) return null;
  
  const properties = extractProperties(callNode, source, typeContext, currentFunction, customConfig);
  
  // Get line number based on source type
  let line = 0;
  if (source === ANALYTICS_SOURCES.SEGMENT || source === ANALYTICS_SOURCES.POSTHOG) {
    // For Segment and PostHog, we need to get the line number from the struct.struct object
    if (callNode.tag === 'structlit' && callNode.struct && callNode.struct.struct) {
      line = callNode.struct.struct.line || 0;
    }
  } else {
    // For other sources, use the line number from the AST node
    line = callNode.line || 0;
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

module.exports = {
  extractTrackingEvent
};
