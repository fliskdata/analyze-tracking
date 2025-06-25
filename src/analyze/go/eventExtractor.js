/**
 * @fileoverview Event extraction logic for Go analytics tracking
 * @module analyze/go/eventExtractor
 */

const { ANALYTICS_SOURCES } = require('./constants');
const { extractStringValue, findStructLiteral, findStructField, extractSnowplowValue } = require('./utils');

/**
 * Extract event name from a tracking call based on the source
 * @param {Object} callNode - AST node representing a function call or struct literal
 * @param {string} source - Analytics source (e.g., 'segment', 'amplitude')
 * @param {Object|null} customConfig - Parsed custom function configuration
 * @returns {string|null} Event name or null if not found
 */
function extractEventName(callNode, source, customConfig = null) {
  if (!callNode.args || callNode.args.length === 0) {
    // For struct literals, we need to check fields instead of args
    if (!callNode.fields || callNode.fields.length === 0) {
      return null;
    }
  }
  
  switch (source) {
    case ANALYTICS_SOURCES.MIXPANEL:
      return extractMixpanelEventName(callNode);
      
    case ANALYTICS_SOURCES.SEGMENT:
    case ANALYTICS_SOURCES.POSTHOG:
      return extractSegmentPosthogEventName(callNode);
      
    case ANALYTICS_SOURCES.AMPLITUDE:
      return extractAmplitudeEventName(callNode);
      
    case ANALYTICS_SOURCES.SNOWPLOW:
      return extractSnowplowEventName(callNode);
      
    case ANALYTICS_SOURCES.CUSTOM:
      return extractCustomEventName(callNode, customConfig);
  }
  
  return null;
}

/**
 * Extract Mixpanel event name
 * Pattern: mp.Track(ctx, []*mixpanel.Event{mp.NewEvent("event_name", "", props)})
 * @param {Object} callNode - AST node for Mixpanel tracking call
 * @returns {string|null} Event name or null if not found
 */
function extractMixpanelEventName(callNode) {
  if (callNode.args && callNode.args.length > 1) {
    const arrayArg = callNode.args[1];
    if (arrayArg.tag === 'expr' && arrayArg.body) {
      const arrayLit = arrayArg.body.find(item => item.tag === 'arraylit');
      if (arrayLit && arrayLit.items && arrayLit.items.length > 0) {
        // Each item is an array of tokens that needs to be parsed
        const firstItem = arrayLit.items[0];
        if (Array.isArray(firstItem)) {
          // Look for pattern: mp.NewEvent("event_name", ...)
          for (let i = 0; i < firstItem.length - 4; i++) {
            if (firstItem[i].tag === 'ident' && firstItem[i].value === 'mp' &&
                firstItem[i+1].tag === 'sigil' && firstItem[i+1].value === '.' &&
                firstItem[i+2].tag === 'ident' && firstItem[i+2].value === 'NewEvent' &&
                firstItem[i+3].tag === 'sigil' && firstItem[i+3].value === '(') {
              // Found mp.NewEvent( - next token should be the event name
              if (firstItem[i+4] && firstItem[i+4].tag === 'string') {
                return firstItem[i+4].value.slice(1, -1); // Remove quotes
              }
            }
          }
        }
      }
    }
  }
  return null;
}

/**
 * Extract Segment/PostHog event name
 * Pattern: analytics.Track{Event: "event_name", ...} or posthog.Capture{Event: "event_name", ...}
 * @param {Object} callNode - AST node for Segment/PostHog struct literal
 * @returns {string|null} Event name or null if not found
 */
function extractSegmentPosthogEventName(callNode) {
  if (callNode.fields) {
    const eventField = findStructField(callNode, 'Event');
    if (eventField) {
      return extractStringValue(eventField.value);
    }
  }
  return null;
}

/**
 * Extract Amplitude event name
 * Pattern: amplitude.Event{EventType: "event_name", ...} or client.Track(amplitude.Event{EventType: "event_name", ...})
 * @param {Object} callNode - AST node for Amplitude tracking call
 * @returns {string|null} Event name or null if not found
 */
function extractAmplitudeEventName(callNode) {
  // For struct literals: amplitude.Event{EventType: "event_name", ...}
  if (callNode.tag === 'structlit' && callNode.fields) {
    const eventTypeField = findStructField(callNode, 'EventType');
    if (eventTypeField) {
      return extractStringValue(eventTypeField.value);
    }
  }
  // For function calls: client.Track(amplitude.Event{EventType: "event_name", ...})
  else if (callNode.args && callNode.args.length > 0) {
    const eventStruct = findStructLiteral(callNode.args[0]);
    if (eventStruct && eventStruct.fields) {
      const eventTypeField = findStructField(eventStruct, 'EventType');
      if (eventTypeField) {
        return extractStringValue(eventTypeField.value);
      }
    }
  }
  return null;
}

/**
 * Extract Snowplow event name
 * Pattern: tracker.TrackStructEvent(sp.StructuredEvent{Action: sphelp.NewString("event_name"), ...})
 * @param {Object} callNode - AST node for Snowplow tracking call
 * @returns {string|null} Event name or null if not found
 */
function extractSnowplowEventName(callNode) {
  if (callNode.args && callNode.args.length > 0) {
    const structEvent = findStructLiteral(callNode.args[0]);
    if (structEvent && structEvent.fields) {
      const actionField = findStructField(structEvent, 'Action');
      if (actionField) {
        // Snowplow uses sphelp.NewString("value")
        return extractSnowplowValue(actionField.value);
      }
    }
  }
  return null;
}

/**
 * Extract custom event name
 * Pattern: customFunction("event_name", props)
 * @param {Object} callNode - AST node for custom tracking function call
 * @param {Object|null} customConfig - Custom configuration object
 * @returns {string|null} Event name or null if not found
 */
function extractCustomEventName(callNode, customConfig) {
  if (!callNode.args || callNode.args.length === 0) return null;
  const args = callNode.args;
  const eventIdx = customConfig?.eventIndex ?? 0;
  const argNode = args[eventIdx];
  return extractStringValue(argNode);
}

module.exports = {
  extractEventName
};
