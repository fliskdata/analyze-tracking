/**
 * @fileoverview Central export for all Swift extractor modules
 * @module analyze/swift/extractors
 */

const { extractEventName, processEventData } = require('./event-extractor');
const { extractProperties } = require('./property-extractor');

module.exports = {
  extractEventName,
  processEventData,
  extractProperties
};