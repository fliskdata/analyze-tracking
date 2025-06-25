const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { analyzeGoFile } = require('../src/analyze/go');

test.describe('analyzeGoFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'go', 'main.go');
  
  test('should correctly analyze Go file with multiple tracking providers', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = await analyzeGoFile(testFilePath, customFunction);
    
    // Sort events by eventName for consistent ordering
    events.sort((a, b) => a.eventName.localeCompare(b.eventName));
    
    assert.strictEqual(events.length, 6);
    
    // Test Amplitude event
    const amplitudeEvent = events.find(e => e.eventName === 'Button Clicked');
    assert.ok(amplitudeEvent);
    assert.strictEqual(amplitudeEvent.source, 'amplitude');
    assert.strictEqual(amplitudeEvent.functionName, 'amplitudeTrack');
    assert.strictEqual(amplitudeEvent.line, 44);
    assert.deepStrictEqual(amplitudeEvent.properties, {
      UserID: { type: 'string' },
      name: { type: 'string' },
      'a property': { type: 'string' },
      is_free_trial: { type: 'boolean' },
      Price: { type: 'number' }
    });
    
    // Test Segment event
    const segmentEvent = events.find(e => e.eventName === 'Signed Up');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    assert.strictEqual(segmentEvent.functionName, 'segmentTrack');
    assert.strictEqual(segmentEvent.line, 21);
    assert.deepStrictEqual(segmentEvent.properties, {
      UserId: { type: 'string' },
      plan: { type: 'string' },
      is_free_trial: { type: 'boolean' }
    });
    
    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.eventName === 'some_event');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.source, 'mixpanel');
    assert.strictEqual(mixpanelEvent.functionName, 'mixpanelTrack');
    assert.strictEqual(mixpanelEvent.line, 33);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      DistinctId: { type: 'string' },
      plan: { type: 'string' },
      price: { type: 'number' }
    });
    
    // Test PostHog event
    const posthogEvent = events.find(e => e.eventName === 'user_signed_up');
    assert.ok(posthogEvent);
    assert.strictEqual(posthogEvent.source, 'posthog');
    assert.strictEqual(posthogEvent.functionName, 'posthogTrack');
    assert.strictEqual(posthogEvent.line, 64);
    assert.deepStrictEqual(posthogEvent.properties, {
      DistinctId: { type: 'string' },
      login_type: { type: 'string' },
      plan: { type: 'string' },
      is_free_trial: { type: 'boolean' }
    });
    
    // Test Snowplow event
    const snowplowEvent = events.find(e => e.eventName === 'add-to-basket');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.source, 'snowplow');
    assert.strictEqual(snowplowEvent.functionName, 'snowplowTrack');
    assert.strictEqual(snowplowEvent.line, 81);
    assert.deepStrictEqual(snowplowEvent.properties, {
      Category: { type: 'string' },
      Property: { type: 'string' },
      Value: { type: 'number' }
    });
    
    // Test custom function event
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.ok(customEvent);
    assert.strictEqual(customEvent.source, 'custom');
    assert.strictEqual(customEvent.functionName, 'main');
    assert.strictEqual(customEvent.line, 105);
    assert.deepStrictEqual(customEvent.properties, {
      userId: { type: 'string' },
      foo: { type: 'string' },
      baz: { type: 'number' },
      list: { type: 'array', items: { type: 'string' } },
      obj: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
          c: { type: 'string' }
        }
      }
    });
  });
  
  test('should handle files without tracking events', async () => {
    const emptyTestFile = path.join(fixturesDir, 'go', 'empty.go');
    const events = await analyzeGoFile(emptyTestFile, 'customTrack');
    assert.deepStrictEqual(events, []);
  });
  
  test('should handle missing custom function', async () => {
    const events = await analyzeGoFile(testFilePath, null);
    
    // Should find all events except the custom one
    assert.strictEqual(events.length, 5);
    assert.strictEqual(events.find(e => e.source === 'custom'), undefined);
  });
  
  test('should handle nested property types correctly', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = await analyzeGoFile(testFilePath, customFunction);
    
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.ok(customEvent);
    
    // Test nested object properties
    assert.deepStrictEqual(customEvent.properties.obj, {
      type: 'object',
      properties: {
        a: { type: 'number' },
        b: { type: 'number' },
        c: { type: 'string' }
      }
    });
    
    // Test array properties
    assert.deepStrictEqual(customEvent.properties.list, {
      type: 'array',
      items: { type: 'string' }
    });
  });
  
  test('should match expected tracking-schema.yaml output', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = await analyzeGoFile(testFilePath, customFunction);
    
    // Create a map of events by name for easier verification
    const eventMap = {};
    events.forEach(event => {
      eventMap[event.eventName] = event;
    });
    
    // Verify all expected events are present
    assert.deepStrictEqual(Object.keys(eventMap).sort(), [
      'Button Clicked',
      'Signed Up',
      'add-to-basket',
      'custom_event',
      'some_event',
      'user_signed_up'
    ]);
    
    // Verify each event matches the expected schema format
    assert.ok(eventMap['Signed Up']);
    assert.strictEqual(eventMap['Signed Up'].eventName, 'Signed Up');
    assert.strictEqual(eventMap['Signed Up'].source, 'segment');
    assert.strictEqual(eventMap['Signed Up'].line, 21);
    assert.strictEqual(eventMap['Signed Up'].functionName, 'segmentTrack');
    assert.deepStrictEqual(eventMap['Signed Up'].properties, {
      UserId: { type: 'string' },
      plan: { type: 'string' },
      is_free_trial: { type: 'boolean' }
    });
    
    assert.ok(eventMap['some_event']);
    assert.strictEqual(eventMap['some_event'].eventName, 'some_event');
    assert.strictEqual(eventMap['some_event'].source, 'mixpanel');
    assert.strictEqual(eventMap['some_event'].line, 33);
    assert.strictEqual(eventMap['some_event'].functionName, 'mixpanelTrack');
    assert.deepStrictEqual(eventMap['some_event'].properties, {
      DistinctId: { type: 'string' },
      plan: { type: 'string' },
      price: { type: 'number' }
    });
    
    assert.ok(eventMap['Button Clicked']);
    assert.strictEqual(eventMap['Button Clicked'].eventName, 'Button Clicked');
    assert.strictEqual(eventMap['Button Clicked'].source, 'amplitude');
    assert.strictEqual(eventMap['Button Clicked'].line, 44);
    assert.strictEqual(eventMap['Button Clicked'].functionName, 'amplitudeTrack');
    assert.deepStrictEqual(eventMap['Button Clicked'].properties, {
      UserID: { type: 'string' },
      name: { type: 'string' },
      'a property': { type: 'string' },
      is_free_trial: { type: 'boolean' },
      Price: { type: 'number' }
    });
    
    assert.ok(eventMap['user_signed_up']);
    assert.strictEqual(eventMap['user_signed_up'].eventName, 'user_signed_up');
    assert.strictEqual(eventMap['user_signed_up'].source, 'posthog');
    assert.strictEqual(eventMap['user_signed_up'].line, 64);
    assert.strictEqual(eventMap['user_signed_up'].functionName, 'posthogTrack');
    assert.deepStrictEqual(eventMap['user_signed_up'].properties, {
      DistinctId: { type: 'string' },
      login_type: { type: 'string' },
      plan: { type: 'string' },
      is_free_trial: { type: 'boolean' }
    });
    
    assert.ok(eventMap['add-to-basket']);
    assert.strictEqual(eventMap['add-to-basket'].eventName, 'add-to-basket');
    assert.strictEqual(eventMap['add-to-basket'].source, 'snowplow');
    assert.strictEqual(eventMap['add-to-basket'].line, 81);
    assert.strictEqual(eventMap['add-to-basket'].functionName, 'snowplowTrack');
    assert.deepStrictEqual(eventMap['add-to-basket'].properties, {
      Category: { type: 'string' },
      Property: { type: 'string' },
      Value: { type: 'number' }
    });
    
    assert.ok(eventMap['custom_event']);
    assert.strictEqual(eventMap['custom_event'].eventName, 'custom_event');
    assert.strictEqual(eventMap['custom_event'].source, 'custom');
    assert.strictEqual(eventMap['custom_event'].line, 105);
    assert.strictEqual(eventMap['custom_event'].functionName, 'main');
    assert.deepStrictEqual(eventMap['custom_event'].properties, {
      userId: { type: 'string' },
      foo: { type: 'string' },
      baz: { type: 'number' },
      list: { 
        type: 'array', 
        items: { type: 'string' }
      },
      obj: {
        type: 'object',
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
          c: { type: 'string' }
        }
      }
    });
  });
});
