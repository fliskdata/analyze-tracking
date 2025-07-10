function trackUserEvent() {
  // stub implementation for tests
}

// Direct string literal event name
trackUserEvent('ViewedEligibilityResults');

// Event name referenced via constant map
const TELEMETRY_EVENTS = {
  VIEWED_POST_SHIP_DASHBOARD: 'ViewedPostShipDashboard',
};

trackUserEvent(TELEMETRY_EVENTS.VIEWED_POST_SHIP_DASHBOARD);
