import { useEffect } from 'react';

// Stub implementation to satisfy tests without bundler
function trackUserEvent(eventName, props) {
  // no-op
}

function PrePaymentDashboard() {
  useEffect(() => {
    trackUserEvent('ViewedEligibilityResults');
  }, []);

  return null;
}

export default PrePaymentDashboard;
