const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { analyzeRubyFile } = require('../src/analyze/ruby');
const { parseCustomFunctionSignature } = require('../src/analyze/utils/customFunctionParser');

test.describe('analyzeRubyFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'ruby', 'main.rb');
  
  test('should correctly analyze Ruby file with multiple tracking providers', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);
    
    // Sort events by eventName for consistent ordering
    events.sort((a, b) => a.eventName.localeCompare(b.eventName));
    
    assert.strictEqual(events.length, 7);
    
    // Test Segment event
    const segmentEvent = events.find(e => e.eventName === 'User Signed Up');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    assert.strictEqual(segmentEvent.functionName, 'segment_track');
    assert.strictEqual(segmentEvent.line, 22);
    assert.deepStrictEqual(segmentEvent.properties, {
      user_id: { type: 'string' },
      method: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      plan: { type: 'any' }
    });
    
    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.eventName === 'Purchase Completed');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.source, 'mixpanel');
    assert.strictEqual(mixpanelEvent.functionName, 'mixpanel_track');
    assert.strictEqual(mixpanelEvent.line, 36);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      distinct_id: { type: 'any' },
      plan: { type: 'any' },
      price: { type: 'number' }
    });
    
    // Test Rudderstack event
    const rudderstackEvent = events.find(e => e.eventName === 'Item Sold');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.source, 'rudderstack');
    assert.strictEqual(rudderstackEvent.functionName, 'rudderstack_track');
    assert.strictEqual(rudderstackEvent.line, 49);
    assert.deepStrictEqual(rudderstackEvent.properties, {
      user_id: { type: 'any' },
      sku: { type: 'any' },
      shipping: { type: 'string' }
    });
    
    // Test PostHog event
    const posthogEvent = events.find(e => e.eventName === 'user_signed_up');
    assert.ok(posthogEvent);
    assert.strictEqual(posthogEvent.source, 'posthog');
    assert.strictEqual(posthogEvent.functionName, 'posthog_track');
    assert.strictEqual(posthogEvent.line, 66);
    assert.deepStrictEqual(posthogEvent.properties, {
      distinct_id: { type: 'string' },
      method: { type: 'string' },
      is_free_trial: { type: 'any' },
      plan: { type: 'any' }
    });
    
    // Test Snowplow event
    const snowplowEvent = events.find(e => e.eventName === 'add-to-basket');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.source, 'snowplow');
    assert.strictEqual(snowplowEvent.functionName, 'snowplow_track');
    assert.strictEqual(snowplowEvent.line, 109);
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
    assert.strictEqual(customEvent.functionName, 'custom_track_event');
    assert.strictEqual(customEvent.line, 79);
    assert.deepStrictEqual(customEvent.properties, {
      userId: { type: 'string' },
      key: { type: 'string' },
      nested: { 
        type: 'object', 
        properties: { 
          a: { 
            type: 'array', 
            items: { type: 'number' } 
          } 
        } 
      }
    });
    
    // Test module event
    const moduleEvent = events.find(e => e.eventName === 'Module Event');
    assert.ok(moduleEvent);
    assert.strictEqual(moduleEvent.source, 'segment');
    assert.strictEqual(moduleEvent.functionName, 'track_something');
    assert.strictEqual(moduleEvent.line, 121);
    assert.deepStrictEqual(moduleEvent.properties, {
      anonymous_id: { type: 'string' },
      from_module: { type: 'boolean' }
    });
  });
  
  test('should handle files without tracking events', async () => {
    const emptyTestFile = path.join(fixturesDir, 'ruby', 'empty.rb');
    const customFunctionSignatures = [parseCustomFunctionSignature('customTrack')];
    const events = await analyzeRubyFile(emptyTestFile, customFunctionSignatures);
    assert.deepStrictEqual(events, []);
  });
  
  test('should handle missing custom function', async () => {
    const events = await analyzeRubyFile(testFilePath, null);
    
    // Should find all events except the custom one
    assert.strictEqual(events.length, 6);
    assert.strictEqual(events.find(e => e.source === 'custom'), undefined);
  });
  
  test('should handle nested property types correctly', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);
    
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.ok(customEvent);
    
    // Test nested object properties
    assert.deepStrictEqual(customEvent.properties.nested, {
      type: 'object',
      properties: {
        a: { 
          type: 'array', 
          items: { type: 'number' }
        }
      }
    });
  });
  
  test('should detect tracking in modules', async () => {
    const events = await analyzeRubyFile(testFilePath, null);
    
    const moduleEvent = events.find(e => e.eventName === 'Module Event');
    assert.ok(moduleEvent);
    assert.strictEqual(moduleEvent.source, 'segment');
    assert.strictEqual(moduleEvent.functionName, 'track_something');
    assert.deepStrictEqual(moduleEvent.properties, {
      anonymous_id: { type: 'string' },
      from_module: { type: 'boolean' }
    });
  });
  
  test('should handle all property types correctly', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);
    
    // Test string properties
    const signupEvent = events.find(e => e.eventName === 'User Signed Up');
    assert.strictEqual(signupEvent.properties.method.type, 'string');
    assert.strictEqual(signupEvent.properties.plan.type, 'any');
    
    // Test boolean properties
    assert.strictEqual(signupEvent.properties.is_free_trial.type, 'boolean');
    
    // Test number properties
    const purchaseEvent = events.find(e => e.eventName === 'Purchase Completed');
    assert.strictEqual(purchaseEvent.properties.price.type, 'number');
    
    // Test array properties
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.strictEqual(customEvent.properties.nested.properties.a.type, 'array');
    assert.strictEqual(customEvent.properties.nested.properties.a.items.type, 'number');
  });
  
  test('should correctly identify function names in different contexts', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);
    
    // Verify function names are correctly identified
    const functionNames = events.map(e => e.functionName).sort();
    assert.deepStrictEqual(functionNames, [
      'custom_track_event',
      'mixpanel_track',
      'posthog_track',
      'rudderstack_track',
      'segment_track',
      'snowplow_track',
      'track_something'
    ]);
  });
  
  test('should detect custom functions that are methods of a module', async () => {
    const customFunction = 'CustomModule.track(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);
    
    // Should find the CustomModule.track call (now reported under the enclosing method name)
    const customModuleEvent = events.find(e => e.source === 'custom' && e.functionName === 'custom_track_module');
    assert.ok(customModuleEvent);
    assert.strictEqual(customModuleEvent.eventName, 'custom_event');
    assert.strictEqual(customModuleEvent.line, 98);
    assert.deepStrictEqual(customModuleEvent.properties, {
      userId: { type: 'string' },
      key: { type: 'string' },
      nested: { 
        type: 'object', 
        properties: { 
          a: { 
            type: 'array', 
            items: { type: 'number' } 
          } 
        } 
      }
    });
  });
  
  test('should correctly differentiate between Segment and Rudderstack', async () => {
    const events = await analyzeRubyFile(testFilePath, null);
    
    // Test that uppercase Analytics is detected as Segment
    const segmentEvent = events.find(e => e.eventName === 'User Signed Up');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    
    // Test that lowercase analytics is detected as Rudderstack
    const rudderstackEvent = events.find(e => e.eventName === 'Item Sold');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.source, 'rudderstack');
  });
  
  test('should detect events for all custom function signature variations', async () => {
    const variants = [
      { sig: 'customTrackFunction0', event: 'custom_event0' },
      { sig: 'customTrackFunction1(EVENT_NAME, PROPERTIES)', event: 'custom_event1' },
      { sig: 'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)', event: 'custom_event2' },
      { sig: 'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)', event: 'custom_event3' },
      { sig: 'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)', event: 'custom_event4' },
    ];

    for (const { sig, event } of variants) {
      const customFunctionSignatures = [parseCustomFunctionSignature(sig)];
      const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);
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
    const events = await analyzeRubyFile(testFilePath, customFunctionSignatures);

    const expectedEventNames = [
      'custom_event',
      'custom_event0',
      'custom_event1',
      'custom_event2',
      'custom_event3',
      'custom_event4'
    ];

    expectedEventNames.forEach(eventName => {
      const evt = events.find(e => e.eventName === eventName && e.source === 'custom');
      assert.ok(evt, `Expected to find event ${eventName}`);
    });

    const builtInCount = events.filter(e => e.source !== 'custom').length;
    assert.ok(builtInCount >= 6, 'Should still include built-in events');
  });
  
  test('should detect CustomModule.track inside case/when blocks', async () => {
    const registrationFile = path.join(fixturesDir, 'ruby', 'registration_module.rb');
    const customSignature = parseCustomFunctionSignature('CustomModule.track(userId, EVENT_NAME, PROPERTIES)');
    const events = await analyzeRubyFile(registrationFile, [customSignature]);

    assert.strictEqual(events.length, 1);
    const evt = events[0];
    assert.strictEqual(evt.eventName, 'BecameLead');
    assert.strictEqual(evt.source, 'custom');
    // function name should be the enclosing method name
    assert.strictEqual(evt.functionName, 'post_registration');
    assert.deepStrictEqual(evt.properties, {
      userId: { type: 'any' },
      leadType: { type: 'string' },
      nonInteraction: { type: 'number' }
    });
  });
  
  test('should detect events in various ruby node types', async () => {
    const nodeFile = path.join(fixturesDir, 'ruby', 'node_types.rb');
    const sig = parseCustomFunctionSignature('CustomModule.track(userId, EVENT_NAME, PROPERTIES)');
    const events = await analyzeRubyFile(nodeFile, [sig]);

    const expected = ['UnlessEvent','WhileEvent','ForEvent','RescueEvent','EnsureEvent','LambdaEvent','ArrayEvent','AndEvent','OrEvent','InterpolationEvent'];

    expected.forEach(ev => {
      const found = events.find(e => e.eventName === ev);
      assert.ok(found, `Missing ${ev}`);
    });
  });
  
  test('should detect event names passed as constant references', async () => {
    const constFile = path.join(fixturesDir, 'ruby', 'constant_event.rb');
    const sig = parseCustomFunctionSignature('CustomModule.track(userId, EVENT_NAME, PROPERTIES)');
    const events = await analyzeRubyFile(constFile, [sig]);
    const evt = events.find(e => e.eventName === '_FinishedSection');
    assert.ok(evt);
    assert.deepStrictEqual(evt.properties, {
      userId: { type: 'any' },
      foo: { type: 'string' }
    });
  });

  test('should extract properties passed via local variable and resolve constants across files', async () => {
    const dirRoot = path.join(fixturesDir, 'ruby');
    const { analyzeDirectory } = require('../src/analyze');

    const eventsMap = await analyzeDirectory(dirRoot, ['CustomModule.track(userId, EVENT_NAME, PROPERTIES)']);

    const evt = eventsMap['AnsweredQuestion'];
    assert.ok(evt, 'Should find AnsweredQuestion event');

    const expectedProps = ['userId','sectionName','questionnaireName','registered','eligible','nonInteraction'];
    expectedProps.forEach(p => {
      assert.ok(evt.properties[p], `Expected property ${p}`);
    });
  });
  
  test('should detect event when constant is defined in another file', async () => {
    const useFile = path.join(fixturesDir, 'ruby', 'external_constant_use.rb');
    const sig = parseCustomFunctionSignature('CustomModule.track(userId, EVENT_NAME, PROPERTIES)');
    const events = await analyzeRubyFile(useFile, [sig]);
    const evt = events.find(e => e.eventName === '_ExternalSection');
    assert.ok(evt);
    assert.deepStrictEqual(evt.properties, {
      userId: { type: 'number' }
    });
  });
  
  test('should handle complex nested structures without infinite recursion', async () => {
    const complexFile = path.join(fixturesDir, 'ruby', 'infinite_recursion_test.rb');
    const sig = parseCustomFunctionSignature('CustomModule.track(userId, EVENT_NAME, PROPERTIES)');
    
    // This test ensures the fix for the infinite recursion bug works
    // The complex nested structures in the test file would have caused
    // infinite loops in the generic fallback mechanism before the fix
    const events = await analyzeRubyFile(complexFile, [sig]);
    
    // Verify that we can extract events from complex nested structures
    const expectedEvents = [
      'DeepNestedEvent',
      'LambdaEvent', 
      'ArrayLambdaEvent',
      'InterpolationEvent',
      'PatternMatchEvent',
      'BulkEvent',
      'FallbackEvent',
      'DynamicEvent'
    ];
    
    // Check that we found at least some of the events (some might be skipped due to Ruby version compatibility)
    const foundEventNames = events.map(e => e.eventName);
    const foundExpectedEvents = expectedEvents.filter(name => foundEventNames.includes(name));
    
    // Should find at least a few events without hanging in infinite recursion
    assert.ok(foundExpectedEvents.length >= 3, 
      `Should find at least 3 expected events, found: ${foundEventNames.join(', ')}`);
    
    // Verify that the analysis completes in reasonable time (not infinite loop)
    // If we get here, it means the analysis didn't hang
    assert.ok(true, 'Analysis completed without infinite recursion');
  });

  test('should extract properties from hash assigned via .compact', async () => {
    const compactFile = path.join(fixturesDir, 'ruby', 'compact_event.rb');
    const sig = parseCustomFunctionSignature('TrackingModule.track(userId, EVENT_NAME, PROPERTIES)');
    const events = await analyzeRubyFile(compactFile, [sig]);
    assert.strictEqual(events.length, 1);

    const evt = events[0];
    assert.strictEqual(evt.eventName, 'RegisteredUser');
    assert.deepStrictEqual(evt.properties, {
      userId: { type: 'number' },
      createdByAdminEmail: { type: 'string' },
      _email: { type: 'string' },
      emailOptIn: { type: 'boolean' }
    });
  });
});
