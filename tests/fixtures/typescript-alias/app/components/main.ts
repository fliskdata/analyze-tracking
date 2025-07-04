// Test file that imports constants via path alias and triggers tracking
import { TELEMETRY_EVENTS } from 'lib/constants';

// Mock of a tracking library (simple function)
const mixpanel: any = {
  track: (..._args: any[]) => {}
};

// Event that should be detected via constant reference
mixpanel.track(TELEMETRY_EVENTS.VIEWED_PAGE, {
  foo: 'bar'
});
