// Stub implementation for the test – matches the custom signature under test
const trackUserEvent = (..._args: any[]): void => {
  /* no-op */
};

// Direct string literal event name
trackUserEvent('ViewedEligibilityResults');

// Event name referenced via constant map
const TELEMETRY_EVENTS = {
  VIEWED_POST_SHIP_DASHBOARD: 'ViewedPostShipDashboard' as const,
};

trackUserEvent(TELEMETRY_EVENTS.VIEWED_POST_SHIP_DASHBOARD);
