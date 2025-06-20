/**
 * @fileoverview Analytics source detection for Ruby tracking calls
 * @module analyze/ruby/detectors
 */

/**
 * Detects the analytics source from a Ruby AST CallNode
 * @param {Object} node - The AST CallNode to analyze
 * @param {string} customFunction - Optional custom function name to detect
 * @returns {string|null} - The detected source or null
 */
function detectSource(node, customFunction = null) {
  if (!node) return null;

  // Check for analytics libraries
  if (node.receiver) {
    const objectName = node.receiver.name;
    const methodName = node.name;

    // Segment and Rudderstack (both use similar format)
    // Analytics.track (Segment) or analytics.track (Rudderstack)
    if ((objectName === 'Analytics' || objectName === 'analytics') && methodName === 'track') {
      // Try to determine if it's Rudderstack based on context
      // For now, we'll treat lowercase 'analytics' as Rudderstack
      return objectName === 'analytics' ? 'rudderstack' : 'segment';
    }
    
    // Mixpanel (Ruby SDK uses Mixpanel::Tracker instance)
    if (methodName === 'track' && objectName === 'tracker') return 'mixpanel';
    
    // PostHog
    if (objectName === 'posthog' && methodName === 'capture') return 'posthog';
  }
  
  // Snowplow (typically tracker.track_struct_event)
  if (node.name === 'track_struct_event') return 'snowplow';
  
  // Custom tracking function
  if (customFunction) {
    // Handle simple function names (e.g., 'customTrackFunction')
    if (node.name === customFunction) return 'custom';
    
    // Handle module-scoped function names (e.g., 'CustomModule.track')
    if (customFunction.includes('.')) {
      const [moduleName, methodName] = customFunction.split('.');
      if (node.receiver && node.receiver.name === moduleName && node.name === methodName) {
        return 'custom';
      }
    }
  }

  return null;
}

module.exports = {
  detectSource
};
