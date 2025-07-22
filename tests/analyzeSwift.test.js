const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { analyzeSwiftFile } = require('../src/analyze/swift');
const { parseCustomFunctionSignature } = require('../src/analyze/utils/customFunctionParser');

test.describe('analyzeSwiftFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'swift', 'main.swift');
  
  test('should correctly analyze Swift file with multiple tracking providers', async () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = await analyzeSwiftFile(testFilePath, customFunctionSignatures);
    
    // Sort events by line number for consistent ordering
    events.sort((a, b) => a.line - b.line);
    
    assert.strictEqual(events.length, 21);
    
    // Test Segment event
    const segmentEvent = events.find(e => e.eventName === 'User Signed Up' && e.source === 'segment');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    assert.strictEqual(segmentEvent.functionName, 'trackSegmentEvent');
    assert.strictEqual(segmentEvent.line, 25);
    assert.deepStrictEqual(segmentEvent.properties, {
      plan: { type: 'string' },
      is_free_trial: { type: 'boolean' },
      user_id: { type: 'string' }
    });
    
    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.eventName === 'Purchase_Completed');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.source, 'mixpanel');
    assert.strictEqual(mixpanelEvent.functionName, 'trackMixpanelEvent');
    assert.strictEqual(mixpanelEvent.line, 34);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      product: { type: 'string' },
      price: { type: 'number' },
      currency: { type: 'string' },
      is_first_purchase: { type: 'boolean' }
    });
    
    // Test Amplitude event
    const amplitudeEvent = events.find(e => e.eventName === 'Button_Clicked');
    assert.ok(amplitudeEvent);
    assert.strictEqual(amplitudeEvent.source, 'amplitude');
    assert.strictEqual(amplitudeEvent.functionName, 'trackAmplitudeEvent');
    assert.strictEqual(amplitudeEvent.line, 45);
    assert.deepStrictEqual(amplitudeEvent.properties, {
      button_name: { type: 'string' },
      screen: { type: 'string' },
      user_tier: { type: 'string' }
    });
    
    // Test RudderStack event
    const rudderstackEvent = events.find(e => e.eventName === 'Page_Viewed');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.source, 'rudderstack');
    assert.strictEqual(rudderstackEvent.functionName, 'trackRudderStackEvent');
    assert.strictEqual(rudderstackEvent.line, 54);
    assert.deepStrictEqual(rudderstackEvent.properties, {
      page_name: { type: 'string' },
      category: { type: 'string' },
      user_agent: { type: 'string' }
    });
    
    // Test mParticle event
    const mparticleEvent = events.find(e => e.eventName === 'Product_Added_To_Cart');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.source, 'mparticle');
    assert.strictEqual(mparticleEvent.functionName, 'trackMParticleEvent');
    assert.strictEqual(mparticleEvent.line, 62);
    assert.deepStrictEqual(mparticleEvent.properties, {
      product_id: { type: 'string' },
      product_name: { type: 'string' },
      quantity: { type: 'number' },
      price: { type: 'number' }
    });
    
    // Test PostHog event
    const posthogEvent = events.find(e => e.eventName === 'Feature_Used');
    assert.ok(posthogEvent);
    assert.strictEqual(posthogEvent.source, 'posthog');
    assert.strictEqual(posthogEvent.functionName, 'trackPostHogEvent');
    assert.strictEqual(posthogEvent.line, 73);
    assert.deepStrictEqual(posthogEvent.properties, {
      feature_name: { type: 'string' },
      enabled: { type: 'boolean' },
      user_preference: { type: 'string' }
    });
    
    // Test Pendo event
    const pendoEvent = events.find(e => e.eventName === 'Guide_Completed');
    assert.ok(pendoEvent);
    assert.strictEqual(pendoEvent.source, 'pendo');
    assert.strictEqual(pendoEvent.functionName, 'trackPendoEvent');
    assert.strictEqual(pendoEvent.line, 81);
    assert.deepStrictEqual(pendoEvent.properties, {
      guide_id: { type: 'string' },
      completion_time: { type: 'number' },
      success: { type: 'boolean' }
    });
    
    // Test Heap event
    const heapEvent = events.find(e => e.eventName === 'User_Engagement');
    assert.ok(heapEvent);
    assert.strictEqual(heapEvent.source, 'heap');
    assert.strictEqual(heapEvent.functionName, 'trackHeapEvent');
    assert.strictEqual(heapEvent.line, 89);
    assert.deepStrictEqual(heapEvent.properties, {
      session_duration: { type: 'number' },
      pages_viewed: { type: 'number' },
      actions_taken: { type: 'number' }
    });
    
    // Test Snowplow event
    const snowplowEvent = events.find(e => e.eventName === 'Button_Click' && e.source === 'snowplow');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.source, 'snowplow');
    assert.strictEqual(snowplowEvent.functionName, 'trackSnowplowEvent');
    assert.strictEqual(snowplowEvent.line, 98);
    assert.deepStrictEqual(snowplowEvent.properties, {
      category: { type: 'string' },
      action: { type: 'string' },
      label: { type: 'string' },
      property: { type: 'string' },
      value: { type: 'number' }
    });
    
    // Test Firebase Analytics event
    const firebaseEvent = events.find(e => e.eventName === 'user_purchase');
    assert.ok(firebaseEvent);
    assert.strictEqual(firebaseEvent.source, 'firebase');
    assert.strictEqual(firebaseEvent.functionName, 'trackFirebaseEvent');
    assert.strictEqual(firebaseEvent.line, 104);
    assert.deepStrictEqual(firebaseEvent.properties, {
      item_id: { type: 'string' },
      item_name: { type: 'string' },
      item_category: { type: 'string' },
      quantity: { type: 'number' },
      price: { type: 'number' },
      currency: { type: 'string' }
    });
    
    // Test variable-based event
    const variableEvent = events.find(e => e.eventName === 'Dynamic_Event');
    assert.ok(variableEvent);
    assert.strictEqual(variableEvent.source, 'segment');
    assert.strictEqual(variableEvent.functionName, 'trackWithVariables');
    assert.strictEqual(variableEvent.line, 120);
    assert.deepStrictEqual(variableEvent.properties, {
      user_tier: { type: 'string' },
      is_active: { type: 'boolean' },
      item_count: { type: 'number' },
      metadata: {
        type: 'object',
        properties: {
          registration_date: { type: 'string' },
          preferred_language: { type: 'string' }
        }
      }
    });
    
    // Test custom function event
    const customEvent = events.find(e => e.eventName === 'custom_event');
    assert.ok(customEvent);
    assert.strictEqual(customEvent.source, 'custom');
    assert.strictEqual(customEvent.functionName, 'useCustomTracking');
    assert.strictEqual(customEvent.line, 140);
    assert.deepStrictEqual(customEvent.properties, {
      foo: { type: 'string' },
      baz: { type: 'number' },
      list: { type: 'array' },
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
  
  test('should handle empty Swift file', async () => {
    const emptyFilePath = path.join(fixturesDir, 'swift', 'empty.swift');
    const events = await analyzeSwiftFile(emptyFilePath);
    
    assert.strictEqual(events.length, 0);
  });
  
  test('should handle file read errors', async () => {
    const nonExistentFile = path.join(fixturesDir, 'swift', 'non-existent.swift');
    const events = await analyzeSwiftFile(nonExistentFile);
    
    assert.strictEqual(events.length, 0);
  });
  
  test('should support multiple custom function signatures', async () => {
    const customFunctions = [
      'customTrackFunction0(EVENT_NAME, PROPERTIES)',
      'customTrackFunction1(EVENT_NAME, PROPERTIES)',
      'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)',
      'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)',
      'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)'
    ];
    const customFunctionSignatures = customFunctions.map(parseCustomFunctionSignature);
    const events = await analyzeSwiftFile(testFilePath, customFunctionSignatures);
    
    const customEvents = events.filter(e => e.source === 'custom');
    assert.ok(customEvents.length >= 6); // At least 6 custom events
    
    // Verify different custom function variants
    const customEvent0 = customEvents.find(e => e.eventName === 'custom_event0');
    assert.ok(customEvent0);
    assert.strictEqual(customEvent0.source, 'custom');
    
    const customEvent2 = customEvents.find(e => e.eventName === 'custom_event2');
    assert.ok(customEvent2);
    assert.strictEqual(customEvent2.source, 'custom');
    
    const customEvent4 = customEvents.find(e => e.eventName === 'custom_event4');
    assert.ok(customEvent4);
    assert.strictEqual(customEvent4.source, 'custom');
  });
  
  test('should extract properties with correct types', async () => {
    const events = await analyzeSwiftFile(testFilePath);
    
    // Find an event with various property types
    const mixpanelEvent = events.find(e => e.eventName === 'Purchase_Completed');
    assert.ok(mixpanelEvent);
    
    // Check string property
    assert.strictEqual(mixpanelEvent.properties.product.type, 'string');
    
    // Check number property
    assert.strictEqual(mixpanelEvent.properties.price.type, 'number');
    
    // Check boolean property
    assert.strictEqual(mixpanelEvent.properties.is_first_purchase.type, 'boolean');
    
    // Check object property
    const variableEvent = events.find(e => e.eventName === 'Dynamic_Event');
    assert.ok(variableEvent);
    assert.strictEqual(variableEvent.properties.metadata.type, 'object');
    assert.ok(variableEvent.properties.metadata.properties);
  });
  
  test('should handle complex tracking scenarios', async () => {
    const events = await analyzeSwiftFile(testFilePath);
    
    // Test nested call tracking
    const nestedEvent = events.find(e => e.eventName === 'Nested_Call');
    assert.ok(nestedEvent);
    assert.strictEqual(nestedEvent.source, 'segment');
    assert.strictEqual(nestedEvent.functionName, 'trackComplexScenarios');
    
    // Test conditional tracking
    const conditionalEvent = events.find(e => e.eventName === 'Conditional_Event');
    assert.ok(conditionalEvent);
    assert.strictEqual(conditionalEvent.source, 'mixpanel');
    assert.strictEqual(conditionalEvent.functionName, 'trackComplexScenarios');
    
    // Test extended properties
    const extendedEvent = events.find(e => e.eventName === 'Extended_Properties');
    assert.ok(extendedEvent);
    assert.strictEqual(extendedEvent.source, 'posthog');
    assert.strictEqual(extendedEvent.functionName, 'trackComplexScenarios');
  });
});