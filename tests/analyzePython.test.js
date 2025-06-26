const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const { analyzePythonFile } = require('../src/analyze/python');
const { parseCustomFunctionSignature } = require('../src/analyze/utils/customFunctionParser');

test.describe('analyzePythonFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'python', 'main.py');
  
  test('should correctly analyze Python file with multiple tracking providers', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzePythonFile(testFilePath, customFunctionSignatures);
    
    // Sort events by eventName for consistent ordering
    events.sort((a, b) => a.eventName.localeCompare(b.eventName));
    
    assert.strictEqual(events.length, 8);
    
    // Test Segment event
    const segmentEvent = events.find(e => e.eventName === 'User Signed Up');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    assert.strictEqual(segmentEvent.functionName, 'segment_track');
    assert.strictEqual(segmentEvent.line, 80);
    assert.deepStrictEqual(segmentEvent.properties, {
      user_id: { type: 'string' },
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'string' }
    });
    
    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.eventName === 'Purchase Completed');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.source, 'mixpanel');
    assert.strictEqual(mixpanelEvent.functionName, 'mixpanel_track');
    assert.strictEqual(mixpanelEvent.line, 90);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      distinct_id: { type: 'string' },
      plan: { type: 'string' },
      price: { type: 'number' },
      items: { type: 'array', items: { type: 'string' } }
    });
    
    // Test Amplitude event
    const amplitudeEvent = events.find(e => e.eventName === 'Button Clicked');
    assert.ok(amplitudeEvent);
    assert.strictEqual(amplitudeEvent.source, 'amplitude');
    assert.strictEqual(amplitudeEvent.functionName, 'amplitude_track');
    assert.strictEqual(amplitudeEvent.line, 100);
    assert.deepStrictEqual(amplitudeEvent.properties, {
      user_id: { type: 'string' },
      color: { type: 'string' },
      size: { type: 'number' }
    });
    
    // Test Rudderstack event
    const rudderstackEvent = events.find(e => e.eventName === 'User Logged In');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.source, 'rudderstack');
    assert.strictEqual(rudderstackEvent.functionName, 'rudderstack_track');
    assert.strictEqual(rudderstackEvent.line, 116);
    assert.deepStrictEqual(rudderstackEvent.properties, {
      user_id: { type: 'string' },
      timestamp: { type: 'number' },
      os: { type: 'string' },
      version: { type: 'number' }
    });
    
    // Test PostHog events
    const posthogEvent1 = events.find(e => e.eventName === 'user_signed_up');
    assert.ok(posthogEvent1);
    assert.strictEqual(posthogEvent1.source, 'posthog');
    assert.strictEqual(posthogEvent1.functionName, 'posthog_capture');
    assert.strictEqual(posthogEvent1.line, 127);
    assert.deepStrictEqual(posthogEvent1.properties, {
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'string' }
    });
    
    const posthogEvent2 = events.find(e => e.eventName === 'user_cancelled_subscription');
    assert.ok(posthogEvent2);
    assert.strictEqual(posthogEvent2.source, 'posthog');
    assert.strictEqual(posthogEvent2.functionName, 'posthog_capture');
    assert.strictEqual(posthogEvent2.line, 133);
    assert.deepStrictEqual(posthogEvent2.properties, {
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'string' }
    });
    
    // Test Snowplow event
    const snowplowEvent = events.find(e => e.eventName === 'add-to-basket');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.source, 'snowplow');
    assert.strictEqual(snowplowEvent.functionName, 'snowplow_track_events');
    assert.strictEqual(snowplowEvent.line, 143);
    assert.deepStrictEqual(snowplowEvent.properties, {
      category: { type: 'string' },
      label: { type: 'string' },
      property: { type: 'string' },
      value: { type: 'number' }
    });
    
    // Test custom function event
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.ok(customEvent);
    assert.strictEqual(customEvent.source, 'custom');
    assert.strictEqual(customEvent.functionName, 'main');
    assert.strictEqual(customEvent.line, 158);
    assert.deepStrictEqual(customEvent.properties, {
      userId: { type: 'string' },
      key: { type: 'string' },
      nested: {
        type: 'object',
        properties: {
          a: { type: 'array', items: { type: 'number' } }
        }
      }
    });
  });
  
  test('should handle files without tracking events', async () => {
    const emptyTestFile = path.join(fixturesDir, 'python', 'empty.py');
    const customFunctionSignatures = [parseCustomFunctionSignature('customTrack')];
    const events = await analyzePythonFile(emptyTestFile, customFunctionSignatures);
    assert.deepStrictEqual(events, []);
  });
  
  test('should handle missing custom function', async () => {
    const events = await analyzePythonFile(testFilePath, null);
    
    // Should find all events except the custom one
    assert.strictEqual(events.length, 7);
    assert.strictEqual(events.find(e => e.source === 'custom'), undefined);
  });
  
  test('should handle nested property types correctly', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzePythonFile(testFilePath, customFunctionSignatures);
    
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.ok(customEvent);
    
    // Test nested object properties
    assert.deepStrictEqual(customEvent.properties.nested, {
      type: 'object',
      properties: {
        a: { type: 'array', items: { type: 'number' } }
      }
    });
  });
  
  test('should match expected tracking-schema.yaml output', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzePythonFile(testFilePath, customFunctionSignatures);
    
    // Create a map of events by name for easier verification
    const eventMap = {};
    events.forEach(event => {
      eventMap[event.eventName] = event;
    });
    
    // Verify all expected events are present
    assert.deepStrictEqual(Object.keys(eventMap).sort(), [
      'Button Clicked',
      'Purchase Completed',
      'User Logged In',
      'User Signed Up',
      'add-to-basket',
      'custom_event',
      'user_cancelled_subscription',
      'user_signed_up'
    ]);
    
    // Verify each event matches the expected schema format
    assert.ok(eventMap['User Signed Up']);
    assert.strictEqual(eventMap['User Signed Up'].eventName, 'User Signed Up');
    assert.strictEqual(eventMap['User Signed Up'].source, 'segment');
    assert.strictEqual(eventMap['User Signed Up'].line, 80);
    assert.strictEqual(eventMap['User Signed Up'].functionName, 'segment_track');
    assert.deepStrictEqual(eventMap['User Signed Up'].properties, {
      user_id: { type: 'string' },
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'string' }
    });
    
    assert.ok(eventMap['Purchase Completed']);
    assert.strictEqual(eventMap['Purchase Completed'].eventName, 'Purchase Completed');
    assert.strictEqual(eventMap['Purchase Completed'].source, 'mixpanel');
    assert.strictEqual(eventMap['Purchase Completed'].line, 90);
    assert.strictEqual(eventMap['Purchase Completed'].functionName, 'mixpanel_track');
    assert.deepStrictEqual(eventMap['Purchase Completed'].properties, {
      distinct_id: { type: 'string' },
      plan: { type: 'string' },
      price: { type: 'number' },
      items: { type: 'array', items: { type: 'string' } }
    });
    
    assert.ok(eventMap['Button Clicked']);
    assert.strictEqual(eventMap['Button Clicked'].eventName, 'Button Clicked');
    assert.strictEqual(eventMap['Button Clicked'].source, 'amplitude');
    assert.strictEqual(eventMap['Button Clicked'].line, 100);
    assert.strictEqual(eventMap['Button Clicked'].functionName, 'amplitude_track');
    assert.deepStrictEqual(eventMap['Button Clicked'].properties, {
      user_id: { type: 'string' },
      color: { type: 'string' },
      size: { type: 'number' }
    });
    
    assert.ok(eventMap['User Logged In']);
    assert.strictEqual(eventMap['User Logged In'].eventName, 'User Logged In');
    assert.strictEqual(eventMap['User Logged In'].source, 'rudderstack');
    assert.strictEqual(eventMap['User Logged In'].line, 116);
    assert.strictEqual(eventMap['User Logged In'].functionName, 'rudderstack_track');
    assert.deepStrictEqual(eventMap['User Logged In'].properties, {
      user_id: { type: 'string' },
      timestamp: { type: 'number' },
      os: { type: 'string' },
      version: { type: 'number' }
    });
    
    assert.ok(eventMap['user_signed_up']);
    assert.strictEqual(eventMap['user_signed_up'].eventName, 'user_signed_up');
    assert.strictEqual(eventMap['user_signed_up'].source, 'posthog');
    assert.strictEqual(eventMap['user_signed_up'].line, 127);
    assert.strictEqual(eventMap['user_signed_up'].functionName, 'posthog_capture');
    assert.deepStrictEqual(eventMap['user_signed_up'].properties, {
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'string' }
    });
    
    assert.ok(eventMap['user_cancelled_subscription']);
    assert.strictEqual(eventMap['user_cancelled_subscription'].eventName, 'user_cancelled_subscription');
    assert.strictEqual(eventMap['user_cancelled_subscription'].source, 'posthog');
    assert.strictEqual(eventMap['user_cancelled_subscription'].line, 133);
    assert.strictEqual(eventMap['user_cancelled_subscription'].functionName, 'posthog_capture');
    assert.deepStrictEqual(eventMap['user_cancelled_subscription'].properties, {
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'string' }
    });
    
    assert.ok(eventMap['add-to-basket']);
    assert.strictEqual(eventMap['add-to-basket'].eventName, 'add-to-basket');
    assert.strictEqual(eventMap['add-to-basket'].source, 'snowplow');
    assert.strictEqual(eventMap['add-to-basket'].line, 143);
    assert.strictEqual(eventMap['add-to-basket'].functionName, 'snowplow_track_events');
    assert.deepStrictEqual(eventMap['add-to-basket'].properties, {
      category: { type: 'string' },
      label: { type: 'string' },
      property: { type: 'string' },
      value: { type: 'number' }
    });
    
    assert.ok(eventMap['custom_event']);
    assert.strictEqual(eventMap['custom_event'].eventName, 'custom_event');
    assert.strictEqual(eventMap['custom_event'].source, 'custom');
    assert.strictEqual(eventMap['custom_event'].line, 158);
    assert.strictEqual(eventMap['custom_event'].functionName, 'main');
    assert.deepStrictEqual(eventMap['custom_event'].properties, {
      userId: { type: 'string' },
      key: { type: 'string' },
      nested: {
        type: 'object',
        properties: {
          a: { type: 'array', items: { type: 'number' } }
        }
      }
    });
  });
  
  test('should handle type annotations correctly', async () => {
    // Create a test file with type annotations
    const typeTestFile = path.join(fixturesDir, 'python', 'types_test.py');
    
    fs.writeFileSync(typeTestFile, `
from typing import List, Dict, Any

def track_with_types() -> None:
    items: List[int] = [1, 2, 3]
    config: Dict[str, Any] = {"enabled": True}
    customTrackFunction("user111", "types_test", {
        "items": items,
        "config": config,
        "inline_list": [1, 2, 3],
        "inline_dict": {"a": 1, "b": "two"}
    })

def customTrackFunction(user_id: str, event_name: str, params: Dict[str, Any]) -> None:
    pass
`);
    
    const customFunctionSignatures = [parseCustomFunctionSignature('customTrackFunction(userId, EVENT_NAME, PROPERTIES)')];
    const events = await analyzePythonFile(typeTestFile, customFunctionSignatures);
    assert.strictEqual(events.length, 1);
    
    const event = events[0];
    assert.strictEqual(event.eventName, 'types_test');
    assert.deepStrictEqual(event.properties.items, { type: 'array', items: { type: 'number' } });
    assert.deepStrictEqual(event.properties.config, { type: 'object' });
    assert.deepStrictEqual(event.properties.inline_list, { type: 'array', items: { type: 'number' } });
    assert.deepStrictEqual(event.properties.inline_dict, {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'string' }
      }
    });
    
    // Clean up
    fs.unlinkSync(typeTestFile);
  });
  
  test('should detect events for all custom function signature variations', async () => {
    const variants = [
      { sig: 'customTrackFunction0', event: 'custom_event0' },
      { sig: 'customTrackFunction1(EVENT_NAME, PROPERTIES)', event: 'custom_event1' },
      { sig: 'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)', event: 'custom_event2' },
      { sig: 'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)', event: 'custom_event3' },
      { sig: 'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)', event: 'custom_event4' },
      { sig: 'CustomModule.track(userId, EVENT_NAME, PROPERTIES)', event: 'custom_module_event' },
    ];

    for (const { sig, event } of variants) {
      const customFunctionSignatures = [parseCustomFunctionSignature(sig)];
      const events = await analyzePythonFile(testFilePath, customFunctionSignatures);
      const found = events.find(e => e.eventName === event && e.source === 'custom');
      assert.ok(found, `Should detect ${event} for signature ${sig}`);
    }
  });
  
  test('should detect events when multiple custom function signatures are provided together', async () => {
    const variants = [
      'customTrackFunction(userId, EVENT_NAME, PROPERTIES)',
      'customTrackFunction0',
      'customTrackFunction1(EVENT_NAME, PROPERTIES)',
      'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)',
      'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)',
      'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)',
      'CustomModule.track(userId, EVENT_NAME, PROPERTIES)'
    ];

    const customFunctionSignatures = variants.map(parseCustomFunctionSignature);
    const events = await analyzePythonFile(testFilePath, customFunctionSignatures);

    const expectedEventNames = [
      'custom_event',
      'custom_event0',
      'custom_event1',
      'custom_event2',
      'custom_event3',
      'custom_event4',
      'custom_module_event'
    ];

    expectedEventNames.forEach(eventName => {
      const evt = events.find(e => e.eventName === eventName && e.source === 'custom');
      assert.ok(evt, `Expected to find event ${eventName}`);
    });

    const builtInCount = events.filter(e => e.source !== 'custom').length;
    assert.ok(builtInCount >= 7, 'Should still include built-in events');
  });
});
