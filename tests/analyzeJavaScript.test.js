const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { analyzeJsFile } = require('../src/analyze/javascript');
const { parseCustomFunctionSignature } = require('../src/analyze/utils/customFunctionParser');

test.describe('analyzeJsFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'javascript', 'main.js');
  
  test('should correctly analyze JavaScript file with multiple tracking providers', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    // Sort events by line number for consistent ordering
    events.sort((a, b) => a.line - b.line);
    
    assert.strictEqual(events.length, 19);
    
    // Test Google Analytics event
    const gaEvent = events.find(e => e.eventName === 'purchase' && e.source === 'googleanalytics');
    assert.ok(gaEvent);
    assert.strictEqual(gaEvent.source, 'googleanalytics');
    assert.strictEqual(gaEvent.functionName, 'trackGA4');
    assert.strictEqual(gaEvent.line, 14);
    assert.deepStrictEqual(gaEvent.properties, {
      order_id: { type: 'any' },
      products: { type: 'any' },
      total: { type: 'any' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    });
    
    // Test Segment event
    const segmentEvent = events.find(e => e.eventName === 'newEvent');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    assert.strictEqual(segmentEvent.functionName, 'checkout');
    assert.strictEqual(segmentEvent.line, 27);
    assert.deepStrictEqual(segmentEvent.properties, {
      something: { type: 'string' },
      count: { type: 'number' }
    });
    
    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.eventName === 'orderCompleted');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.source, 'mixpanel');
    assert.strictEqual(mixpanelEvent.functionName, 'test12345678');
    assert.strictEqual(mixpanelEvent.line, 34);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      order_id: { type: 'any' },
      products: { type: 'any' },
      total: { type: 'any' }
    });
    
    // Test Amplitude event
    const amplitudeEvent = events.find(e => e.eventName === 'checkout' && e.source === 'amplitude');
    assert.ok(amplitudeEvent);
    assert.strictEqual(amplitudeEvent.source, 'amplitude');
    assert.strictEqual(amplitudeEvent.functionName, 'checkout');
    assert.strictEqual(amplitudeEvent.line, 44);
    assert.deepStrictEqual(amplitudeEvent.properties, {
      order_id: { type: 'any' },
      products: { type: 'any' },
      total: { type: 'any' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    });
    
    // Test Rudderstack event
    const rudderstackEvent = events.find(e => e.eventName === 'Order Completed');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.source, 'rudderstack');
    assert.strictEqual(rudderstackEvent.functionName, 'checkout');
    assert.strictEqual(rudderstackEvent.line, 57);
    assert.deepStrictEqual(rudderstackEvent.properties, {
      order_id: { type: 'any' },
      products: { type: 'any' },
      revenue: { type: 'any' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    });
    
    // Test mParticle event
    const mparticleEvent = events.find(e => e.eventName === 'Buy Now');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.source, 'mparticle');
    assert.strictEqual(mparticleEvent.functionName, 'checkout2');
    assert.strictEqual(mparticleEvent.line, 80);
    assert.deepStrictEqual(mparticleEvent.properties, {
      order_id: { type: 'any' },
      products: { type: 'any' },
      total: { type: 'any' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    });
    
    // Test PostHog event
    const posthogEvent = events.find(e => e.eventName === 'user click');
    assert.ok(posthogEvent);
    assert.strictEqual(posthogEvent.source, 'posthog');
    assert.strictEqual(posthogEvent.functionName, 'checkout2');
    assert.strictEqual(posthogEvent.line, 93);
    assert.deepStrictEqual(posthogEvent.properties, {
      order_id: { type: 'any' },
      blah: { type: 'any' },
      products: { type: 'any' },
      total: { type: 'any' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    });
    
    // Test Pendo event
    const pendoEvent = events.find(e => e.eventName === 'customer checkout');
    assert.ok(pendoEvent);
    assert.strictEqual(pendoEvent.source, 'pendo');
    assert.strictEqual(pendoEvent.functionName, 'checkout3');
    assert.strictEqual(pendoEvent.line, 107);
    assert.deepStrictEqual(pendoEvent.properties, {
      order_id: { type: 'string' },
      products: {
        type: 'array',
        items: { type: 'object' }
      },
      total: { type: 'number' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' }
        }
      }
    });
    
    // Test Heap event
    const heapEvent = events.find(e => e.eventName === 'login');
    assert.ok(heapEvent);
    assert.strictEqual(heapEvent.source, 'heap');
    assert.strictEqual(heapEvent.functionName, 'checkout3');
    assert.strictEqual(heapEvent.line, 124);
    assert.deepStrictEqual(heapEvent.properties, {
      user_id: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' }
    });
    
    // Test Snowplow event
    const snowplowEvent = events.find(e => e.eventName === 'someevent');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.source, 'snowplow');
    assert.strictEqual(snowplowEvent.functionName, 'trackSnowplow');
    assert.strictEqual(snowplowEvent.line, 157);
    assert.deepStrictEqual(snowplowEvent.properties, {
      category: { type: 'string' },
      label: { type: 'string' },
      property: { type: 'string' },
      value: { type: 'any' }
    });
    
    // Test custom function event
    const customEvent = events.find(e => e.eventName === 'customEvent');
    assert.ok(customEvent);
    assert.strictEqual(customEvent.source, 'custom');
    assert.strictEqual(customEvent.functionName, 'global');
    assert.strictEqual(customEvent.line, 171);
    assert.deepStrictEqual(customEvent.properties, {
      userId: { type: 'string' },
      order_id: { type: 'string' },
      value: { type: 'number' },
      list: {
        type: 'array',
        items: { type: 'string' }
      }
    });
    
    // Test frozen constant event name via Object.freeze constant
    const frozenEvent = events.find(e => e.eventName === 'ecommerce_purchase_frozen');
    assert.ok(frozenEvent);
    assert.strictEqual(frozenEvent.source, 'mixpanel');
    assert.strictEqual(frozenEvent.functionName, 'global');
    assert.deepStrictEqual(frozenEvent.properties, {
      orderId: { type: 'string' },
      total: { type: 'number' },
      items: {
        type: 'array',
        items: { type: 'string' }
      }
    });
  });
  
  test('should handle files without tracking events', () => {
    const emptyTestFile = path.join(fixturesDir, 'javascript', 'empty.js');
    // Create empty file for testing
    const fs = require('fs');
    if (!fs.existsSync(emptyTestFile)) {
      fs.writeFileSync(emptyTestFile, '// Empty file\n');
    }
    
    const customFunctionSignatures = [parseCustomFunctionSignature('customTrack')];
    const events = analyzeJsFile(emptyTestFile, customFunctionSignatures);
    assert.deepStrictEqual(events, []);
  });
  
  test('should handle missing custom function', () => {
    const events = analyzeJsFile(testFilePath, null);
    
    // Should find all events except the custom one
    assert.strictEqual(events.length, 18);
    assert.strictEqual(events.find(e => e.source === 'custom'), undefined);
  });
  
  test('should handle nested property types correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    // Test nested object properties
    const eventWithNestedObj = events.find(e => e.properties.address);
    assert.ok(eventWithNestedObj);
    assert.deepStrictEqual(eventWithNestedObj.properties.address, {
      type: 'object',
      properties: {
        city: { type: 'string' },
        state: { type: 'string' }
      }
    });
    
    // Test array properties
    const eventWithArray = events.find(e => e.properties.list);
    assert.ok(eventWithArray);
    assert.deepStrictEqual(eventWithArray.properties.list, {
      type: 'array',
      items: { type: 'string' }
    });
  });
  
  test('should detect array types correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    // Test array of objects
    const pendoEvent = events.find(e => e.eventName === 'customer checkout');
    assert.ok(pendoEvent);
    assert.deepStrictEqual(pendoEvent.properties.products, {
      type: 'array',
      items: { type: 'object' }
    });
    
    // Test array of strings
    const customEvent = events.find(e => e.eventName === 'customEvent');
    assert.ok(customEvent);
    assert.deepStrictEqual(customEvent.properties.list, {
      type: 'array',
      items: { type: 'string' }
    });
  });
  
  test('should handle different function contexts correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    // Test function declaration
    const funcDeclEvent = events.find(e => e.functionName === 'test12345678');
    assert.ok(funcDeclEvent);
    
    // Test arrow function
    const arrowFuncEvent = events.find(e => e.functionName === 'trackGA4');
    assert.ok(arrowFuncEvent);
    
    // Test class method
    const classMethodEvent = events.find(e => e.functionName === 'trackSnowplow');
    assert.ok(classMethodEvent);
    
    // Test global scope
    const globalEvent = events.find(e => e.functionName === 'global');
    assert.ok(globalEvent);
  });
  
  test('should handle case variations in provider names', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    // mParticle is used with lowercase 'p' in the test file
    const mparticleEvent = events.find(e => e.source === 'mparticle');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.eventName, 'Buy Now');
  });
  
  test('should exclude action field from Snowplow properties', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    const snowplowEvent = events.find(e => e.source === 'snowplow');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.eventName, 'someevent');
    // action field should not be in properties since it's used as event name
    assert.strictEqual(snowplowEvent.properties.action, undefined);
    assert.ok(snowplowEvent.properties.category);
  });
  
  test('should handle mParticle three-parameter format', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);
    
    const mparticleEvent = events.find(e => e.source === 'mparticle');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.eventName, 'Buy Now');
    // Event name is first param, properties are third param
    assert.ok(mparticleEvent.properties.order_id);
  });
  
  test('should detect events for all custom function signature variations', () => {
    const variants = [
      { sig: 'customTrackFunction0', event: 'custom_event0' },
      { sig: 'customTrackFunction1(EVENT_NAME, PROPERTIES)', event: 'custom_event1' },
      { sig: 'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)', event: 'custom_event2' },
      { sig: 'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)', event: 'custom_event3' },
      { sig: 'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)', event: 'custom_event4' },
      { sig: 'CustomModule.track(userId, EVENT_NAME, PROPERTIES)', event: 'custom_module_event' },
    ];

    variants.forEach(({ sig, event }) => {
      const customFunctionSignatures = [parseCustomFunctionSignature(sig)];
      const events = analyzeJsFile(testFilePath, customFunctionSignatures);
      const found = events.find(e => e.eventName === event && e.source === 'custom');
      assert.ok(found, `Should detect ${event} for signature ${sig}`);
    });
  });
  
  test('should detect events when multiple custom function signatures are provided together', () => {
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
    const events = analyzeJsFile(testFilePath, customFunctionSignatures);

    // Each variant triggers exactly one event in the fixture file
    const expectedEventNames = [
      'customEvent',
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

    // Sanity check – ensure we did not lose built-in provider events
    const builtInProvidersCount = events.filter(e => e.source !== 'custom').length;
    assert.ok(builtInProvidersCount >= 10, 'Should still include built-in events');
  });

  test('should detect events with no properties for custom function', () => {
    const eventOnlyFile = path.join(fixturesDir, 'javascript', 'event-only.js');
    const customFunctionSignatures = [parseCustomFunctionSignature('trackUserEvent(EVENT_NAME)')];
    const events = analyzeJsFile(eventOnlyFile, customFunctionSignatures);

    assert.strictEqual(events.length, 2);

    const literalEvent = events.find(e => e.eventName === 'ViewedEligibilityResults');
    assert.ok(literalEvent);
    assert.deepStrictEqual(literalEvent.properties, {});

    const constantEvent = events.find(e => e.eventName === 'ViewedPostShipDashboard');
    assert.ok(constantEvent);
    assert.deepStrictEqual(constantEvent.properties, {});
  });

  test('should include component name for React hook functions', () => {
    const hookFile = path.join(fixturesDir, 'javascript', 'react-hook.js');
    const customFunctionSignatures = [parseCustomFunctionSignature('trackUserEvent(EVENT_NAME)')];
    const events = analyzeJsFile(hookFile, customFunctionSignatures);

    assert.strictEqual(events.length, 1);
    const evt = events[0];
    assert.strictEqual(evt.eventName, 'ViewedEligibilityResults');
    assert.strictEqual(evt.functionName, 'PrePaymentDashboard.useEffect');
  });
});
