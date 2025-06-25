const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { analyzeJsFile } = require('../src/analyze/javascript');

test.describe('analyzeJsFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'javascript', 'main.js');
  
  test('should correctly analyze JavaScript file with multiple tracking providers', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = analyzeJsFile(testFilePath, customFunction);
    
    // Sort events by line number for consistent ordering
    events.sort((a, b) => a.line - b.line);
    
    assert.strictEqual(events.length, 11);
    
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
    assert.strictEqual(snowplowEvent.line, 138);
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
    assert.strictEqual(customEvent.line, 152);
    assert.deepStrictEqual(customEvent.properties, {
      userId: { type: 'string' },
      order_id: { type: 'string' },
      value: { type: 'number' },
      list: {
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
    
    const events = analyzeJsFile(emptyTestFile, 'customTrack');
    assert.deepStrictEqual(events, []);
  });
  
  test('should handle missing custom function', () => {
    const events = analyzeJsFile(testFilePath, null);
    
    // Should find all events except the custom one
    assert.strictEqual(events.length, 10);
    assert.strictEqual(events.find(e => e.source === 'custom'), undefined);
  });
  
  test('should handle nested property types correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = analyzeJsFile(testFilePath, customFunction);
    
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
    const events = analyzeJsFile(testFilePath, customFunction);
    
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
    const events = analyzeJsFile(testFilePath, customFunction);
    
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
    const events = analyzeJsFile(testFilePath, customFunction);
    
    // mParticle is used with lowercase 'p' in the test file
    const mparticleEvent = events.find(e => e.source === 'mparticle');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.eventName, 'Buy Now');
  });
  
  test('should exclude action field from Snowplow properties', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = analyzeJsFile(testFilePath, customFunction);
    
    const snowplowEvent = events.find(e => e.source === 'snowplow');
    assert.ok(snowplowEvent);
    assert.strictEqual(snowplowEvent.eventName, 'someevent');
    // action field should not be in properties since it's used as event name
    assert.strictEqual(snowplowEvent.properties.action, undefined);
    assert.ok(snowplowEvent.properties.category);
  });
  
  test('should handle mParticle three-parameter format', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const events = analyzeJsFile(testFilePath, customFunction);
    
    const mparticleEvent = events.find(e => e.source === 'mparticle');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.eventName, 'Buy Now');
    // Event name is first param, properties are third param
    assert.ok(mparticleEvent.properties.order_id);
  });
});
