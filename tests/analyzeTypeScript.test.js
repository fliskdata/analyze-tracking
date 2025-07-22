const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const ts = require('typescript');
const { analyzeTsFile } = require('../src/analyze/typescript');
const { parseCustomFunctionSignature } = require('../src/analyze/utils/customFunctionParser');

test.describe('analyzeTsFile', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const testFilePath = path.join(fixturesDir, 'typescript', 'main.ts');

  // Helper function to create TypeScript program
  function createProgram(filePath) {
    const options = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      lib: ['lib.es2022.d.ts'],
      allowJs: false,
      strict: true
    };

    return ts.createProgram([filePath], options);
  }

  test('should correctly analyze TypeScript file with multiple tracking providers', () => {
    const customFunctions = [
      'customTrackFunction(userId, EVENT_NAME, PROPERTIES)',
      'customTrackFunction5',
      'customTrackFunction6(EVENT_NAME, PROPERTIES)',
      'customTrackFunction7(EVENT_NAME, PROPERTIES)',
      'this.props.customTrackFunction6(EVENT_NAME, PROPERTIES)'
    ];
    const customFunctionSignatures = customFunctions.map(parseCustomFunctionSignature);
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Sort events by line number for consistent ordering
    events.sort((a, b) => a.line - b.line);

    assert.strictEqual(events.length, 25);

    // Test Google Analytics event
    const gaEvent = events.find(e => e.eventName === 'order_completed' && e.source === 'googleanalytics');
    assert.ok(gaEvent);
    assert.strictEqual(gaEvent.source, 'googleanalytics');
    assert.strictEqual(gaEvent.functionName, 'trackOrderCompletedGA');
    assert.strictEqual(gaEvent.line, 119);
    assert.deepStrictEqual(gaEvent.properties, {
      order_id: { type: 'string' },
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      order_total: { type: 'number' },
      location: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string | undefined' }
        }
      },
      currency: { type: 'string' }
    });

    // Test Segment event
    const segmentEvent = events.find(e => e.eventName === 'user_checkout');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.source, 'segment');
    assert.strictEqual(segmentEvent.functionName, 'checkout');
    assert.strictEqual(segmentEvent.line, 135);
    assert.deepStrictEqual(segmentEvent.properties, {
      stage: { type: 'string' },
      method: { type: 'string' },
      item_count: { type: 'number' }
    });

    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.eventName === 'purchase_confirmed');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.source, 'mixpanel');
    assert.strictEqual(mixpanelEvent.functionName, 'confirmPurchaseMixpanel');
    assert.strictEqual(mixpanelEvent.line, 144);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      order_id: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      total_amount: { type: 'number' }
    });

    // Test Amplitude event
    const amplitudeEvent = events.find(e => e.eventName === 'checkout_initiated' && e.source === 'amplitude');
    assert.ok(amplitudeEvent);
    assert.strictEqual(amplitudeEvent.source, 'amplitude');
    assert.strictEqual(amplitudeEvent.functionName, 'checkout');
    assert.strictEqual(amplitudeEvent.line, 149);
    assert.deepStrictEqual(amplitudeEvent.properties, {
      order_id: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      order_total: { type: 'number' },
      location: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string | undefined' }
        }
      },
      coupon_code: { type: 'null' }
    });

    // Test Rudderstack event
    const rudderstackEvent = events.find(e => e.eventName === 'order_finalized');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.source, 'rudderstack');
    assert.strictEqual(rudderstackEvent.functionName, 'checkout');
    assert.strictEqual(rudderstackEvent.line, 164);
    assert.deepStrictEqual(rudderstackEvent.properties, {
      order_id: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      revenue: { type: 'number' },
      location: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string | undefined' }
        }
      }
    });

    // Test mParticle event
    const mparticleEvent = events.find(e => e.eventName === 'BuyNow');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.source, 'mparticle');
    assert.strictEqual(mparticleEvent.functionName, 'checkout2');
    assert.strictEqual(mparticleEvent.line, 190);
    assert.deepStrictEqual(mparticleEvent.properties, {
      order_id: { type: 'string' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      total: { type: 'number' },
      location: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string | undefined' }
        }
      }
    });

    // Test PostHog event
    const posthogEvent = events.find(e => e.eventName === 'user_action');
    assert.ok(posthogEvent);
    assert.strictEqual(posthogEvent.source, 'posthog');
    assert.strictEqual(posthogEvent.functionName, 'checkout2');
    assert.strictEqual(posthogEvent.line, 209);
    assert.deepStrictEqual(posthogEvent.properties, {
      order_id: { type: 'string' },
      retry: { type: 'number' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      amount: { type: 'number' },
      shipping: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string | undefined' }
        }
      }
    });

    // Test Pendo event
    const pendoEvent = events.find(e => e.eventName === 'customer_checkout');
    assert.ok(pendoEvent);
    assert.strictEqual(pendoEvent.source, 'pendo');
    assert.strictEqual(pendoEvent.functionName, 'checkout3');
    assert.strictEqual(pendoEvent.line, 230);
    assert.deepStrictEqual(pendoEvent.properties, {
      order_id: { type: 'string' },
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            price: { type: 'number' },
            sku: { type: 'string | undefined' }
          }
        }
      },
      subtotal: { type: 'number' },
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
          postalCode: { type: 'string | undefined' }
        }
      }
    });

    // Test Heap event
    const heapEvent = events.find(e => e.eventName === 'user_login');
    assert.ok(heapEvent);
    assert.strictEqual(heapEvent.source, 'heap');
    assert.strictEqual(heapEvent.functionName, 'checkout3');
    assert.strictEqual(heapEvent.line, 244);
    assert.deepStrictEqual(heapEvent.properties, {
      user_id: { type: 'string' },
      email: { type: 'string' },
      name: { type: 'string' },
      roles: {
        type: 'array',
        items: { type: 'string' }
      }
    });

    // Test Snowplow events
    const snowplowEvent1 = events.find(e => e.eventName === 'item_view');
    assert.ok(snowplowEvent1);
    assert.strictEqual(snowplowEvent1.source, 'snowplow');
    assert.strictEqual(snowplowEvent1.functionName, 'trackSnowplow');
    assert.strictEqual(snowplowEvent1.line, 282);
    assert.deepStrictEqual(snowplowEvent1.properties, {
      category: { type: 'string' },
      label: { type: 'string' },
      property: { type: 'string' },
      value: { type: 'number' }
    });

    const snowplowEvent2 = events.find(e => e.eventName === 'button_click');
    assert.ok(snowplowEvent2);
    assert.strictEqual(snowplowEvent2.source, 'snowplow');
    assert.strictEqual(snowplowEvent2.functionName, 'trackSnowplow2');
    assert.strictEqual(snowplowEvent2.line, 286);

    // Test custom function event
    const customEvent = events.find(e => e.eventName === 'custom_event_v2');
    assert.ok(customEvent);
    assert.strictEqual(customEvent.source, 'custom');
    assert.strictEqual(customEvent.functionName, 'global');
    assert.strictEqual(customEvent.line, 315);
    assert.deepStrictEqual(customEvent.properties, {
      userId: { type: 'string' },
      order_id: { type: 'string' },
      value: { type: 'number' },
      list: {
        type: 'array',
        items: { type: 'string' }
      },
      metadata: {
        type: 'object',
        properties: {
          source: { type: 'string' },
          retry: { type: 'boolean' }
        }
      }
    });

    // Test custom function event with constant reference
    const constantEvent = events.find(e => e.eventName === 'ecommerce_purchase');
    assert.ok(constantEvent);
    assert.strictEqual(constantEvent.source, 'custom');
    assert.strictEqual(constantEvent.functionName, 'global');
    assert.strictEqual(constantEvent.line, 326);
    assert.deepStrictEqual(constantEvent.properties, {
      userId: { type: 'string' },
      orderId: { type: 'string' },
      total: { type: 'number' },
      items: {
        type: 'array',
        items: { type: 'string' }
      }
    });

    // Test imported constant event
    const importedConstantEvent = events.find(e => e.eventName === 'ecommerce_purchase_v2');
    assert.ok(importedConstantEvent);
    assert.strictEqual(importedConstantEvent.source, 'segment');
    assert.strictEqual(importedConstantEvent.functionName, 'global');
    assert.strictEqual(importedConstantEvent.line, 328);
    assert.deepStrictEqual(importedConstantEvent.properties, {
      orderId: { type: 'string' },
      total: { type: 'number' },
      items: {
        type: 'array',
        items: { type: 'string' }
      }
    });

    // Test frozen constant event
    const frozenConstantEvent = events.find(e => e.eventName === 'ecommerce_purchase_frozen');
    assert.ok(frozenConstantEvent);
    assert.strictEqual(frozenConstantEvent.source, 'mixpanel');
    assert.strictEqual(frozenConstantEvent.functionName, 'global');
    assert.strictEqual(frozenConstantEvent.line, 327);
    assert.deepStrictEqual(frozenConstantEvent.properties, {
      orderId: { type: 'string' },
      total: { type: 'number' },
      items: {
        type: 'array',
        items: { type: 'string' }
      }
    });

    // Test InitiatedPayment custom event (nested dispatch)
    const initiatedPaymentEvent = events.find(e => e.eventName === 'InitiatedPayment');
    assert.ok(initiatedPaymentEvent);
    assert.strictEqual(initiatedPaymentEvent.source, 'custom');
    assert.deepStrictEqual(initiatedPaymentEvent.properties, {
      containerSection: { type: 'string' },
      tierCartIntent: { type: 'string' }
    });

    // Test FailedPayment custom event (variable properties) – from customTrackFunction5
    const failedPaymentEvent = events.find(e => e.eventName === 'FailedPayment');
    assert.ok(failedPaymentEvent);
    assert.strictEqual(failedPaymentEvent.source, 'custom');
    assert.deepStrictEqual(failedPaymentEvent.properties, {
      containerSection: { type: 'string' },
      amount: { type: 'number' }
    });
  });

  test('should handle files without tracking events', () => {
    const emptyTestFile = path.join(fixturesDir, 'typescript', 'empty.ts');
    // Create empty file for testing
    const fs = require('fs');
    if (!fs.existsSync(emptyTestFile)) {
      fs.writeFileSync(emptyTestFile, '// Empty file\n');
    }

    const program = createProgram(emptyTestFile);
    const customFunctionSignatures = [parseCustomFunctionSignature('customTrack')];
    const events = analyzeTsFile(emptyTestFile, program, customFunctionSignatures);
    assert.deepStrictEqual(events, []);
  });

  test('should handle missing custom function', () => {
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, null);

    // Should find all events except the custom ones
    assert.strictEqual(events.length, 18);
    assert.strictEqual(events.find(e => e.source === 'custom'), undefined);
  });

  test('should handle nested property types correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Test nested object properties with interfaces expanded
    const eventWithNestedObj = events.find(e => e.properties.location);
    assert.ok(eventWithNestedObj);
    assert.deepStrictEqual(eventWithNestedObj.properties.location, {
      type: 'object',
      properties: {
        city: { type: 'string' },
        state: { type: 'string' },
        postalCode: { type: 'string | undefined' }
      }
    });

    // Test array properties with interface expansion
    const eventWithArray = events.find(e => e.properties.items);
    assert.ok(eventWithArray);
    assert.deepStrictEqual(eventWithArray.properties.items, {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          sku: { type: 'string | undefined' }
        }
      }
    });
  });

  test('should detect and expand interface types correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Test that Address interface is expanded
    const eventWithAddress = events.find(e => e.properties.address || e.properties.location);
    assert.ok(eventWithAddress);
    const addressProp = eventWithAddress.properties.address || eventWithAddress.properties.location;
    assert.strictEqual(addressProp.type, 'object');
    assert.ok(addressProp.properties);
    assert.strictEqual(addressProp.properties.city.type, 'string');
    assert.strictEqual(addressProp.properties.state.type, 'string');
    assert.strictEqual(addressProp.properties.postalCode.type, 'string | undefined');

    // Test that Product interface is expanded in arrays
    const eventWithProducts = events.find(e => e.properties.items || e.properties.products);
    assert.ok(eventWithProducts);
    const productsProp = eventWithProducts.properties.items || eventWithProducts.properties.products;
    assert.strictEqual(productsProp.type, 'array');
    assert.strictEqual(productsProp.items.type, 'object');
    assert.ok(productsProp.items.properties);
    assert.strictEqual(productsProp.items.properties.id.type, 'string');
    assert.strictEqual(productsProp.items.properties.name.type, 'string');
    assert.strictEqual(productsProp.items.properties.price.type, 'number');
    assert.strictEqual(productsProp.items.properties.sku.type, 'string | undefined');
  });

  test('should handle shorthand property assignments correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Test that shorthand 'items' property is correctly expanded
    const mixpanelEvent = events.find(e => e.eventName === 'purchase_confirmed');
    assert.ok(mixpanelEvent);
    assert.ok(mixpanelEvent.properties.items);
    assert.strictEqual(mixpanelEvent.properties.items.type, 'array');
    assert.strictEqual(mixpanelEvent.properties.items.items.type, 'object');
    assert.ok(mixpanelEvent.properties.items.items.properties);
  });

  test('should handle variable references correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Test that variable references like segmentProps are resolved
    const segmentEvent = events.find(e => e.eventName === 'user_checkout');
    assert.ok(segmentEvent);
    assert.deepStrictEqual(segmentEvent.properties, {
      stage: { type: 'string' },
      method: { type: 'string' },
      item_count: { type: 'number' }
    });
  });

  test('should exclude action field from Snowplow properties', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    const snowplowEvent = events.find(e => e.source === 'snowplow');
    assert.ok(snowplowEvent);
    // action field should not be in properties since it's used as event name
    assert.strictEqual(snowplowEvent.properties.action, undefined);
    assert.ok(snowplowEvent.properties.category);
  });

  test('should handle mParticle three-parameter format', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    const mparticleEvent = events.find(e => e.source === 'mparticle');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.eventName, 'BuyNow');
    // Event name is first param, properties are third param
    assert.ok(mparticleEvent.properties.order_id);
  });

  test('should handle readonly array types correctly', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Test ReadonlyArray<Product> in checkout3
    const pendoEvent = events.find(e => e.eventName === 'customer_checkout');
    assert.ok(pendoEvent);
    assert.strictEqual(pendoEvent.properties.products.type, 'array');
    assert.strictEqual(pendoEvent.properties.products.items.type, 'object');
    assert.ok(pendoEvent.properties.products.items.properties);
    assert.strictEqual(pendoEvent.properties.products.items.properties.id.type, 'string');
  });

  test('should handle exported vs non-exported interfaces', () => {
    const customFunction = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';
    const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    // Both exported Product and non-exported Address should be expanded
    const eventWithBoth = events.find(e => e.properties.items && e.properties.location);
    assert.ok(eventWithBoth);

    // Check exported Product interface
    assert.ok(eventWithBoth.properties.items.items.properties);

    // Check non-exported Address interface
    assert.ok(eventWithBoth.properties.location.properties);
  });

  test('should correctly analyze React TypeScript file with multiple tracking providers', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    const events = analyzeTsFile(reactFilePath, program);

    // Sort events by line number for consistent ordering
    events.sort((a, b) => a.line - b.line);

    // Updated count - 8 events for regular analysis (complex_operation is only detected with custom function)
    assert.strictEqual(events.length, 8);

    // Test new Segment event from ComplexUploadComponent (regression test pattern)
    const complexSegmentEvent = events.find(e => e.source === 'segment' && e.eventName === 'document_upload_clicked');
    assert.ok(complexSegmentEvent);
    assert.strictEqual(complexSegmentEvent.eventName, 'document_upload_clicked');
    assert.strictEqual(complexSegmentEvent.functionName, 'onFileUploadClick'); // Arrow function methods now show proper names
    assert.strictEqual(complexSegmentEvent.line, 53);
    assert.deepStrictEqual(complexSegmentEvent.properties, {
      documentId: { type: 'any' },
      documentType: { type: 'string' }
    });

    // Test PostHog event
    const posthogEvent = events.find(e => e.source === 'posthog');
    assert.ok(posthogEvent);
    assert.strictEqual(posthogEvent.eventName, 'cart_viewed');
    assert.strictEqual(posthogEvent.functionName, 'ShoppingCart.useEffect');
    assert.strictEqual(posthogEvent.line, 89);
    assert.deepStrictEqual(posthogEvent.properties, {
      item_count: { type: 'number' },
      total_value: { type: 'number' }
    });

    // Test Segment event from useCallback
    const segmentEvent = events.find(e => e.source === 'segment' && e.eventName === 'add_to_cart');
    assert.ok(segmentEvent);
    assert.strictEqual(segmentEvent.eventName, 'add_to_cart');
    assert.strictEqual(segmentEvent.functionName, 'ShoppingCart.useCallback(handleAddToCart)');
    assert.strictEqual(segmentEvent.line, 101);
    assert.deepStrictEqual(segmentEvent.properties, {
      product_id: { type: 'string' },
      product_name: { type: 'string' },
      price: { type: 'number' }
    });

    // Test Amplitude event
    const amplitudeEvent = events.find(e => e.source === 'amplitude');
    assert.ok(amplitudeEvent);
    assert.strictEqual(amplitudeEvent.eventName, 'item_added');
    assert.strictEqual(amplitudeEvent.functionName, 'ShoppingCart.useCallback(handleAddToCart)');
    assert.strictEqual(amplitudeEvent.line, 108);
    assert.deepStrictEqual(amplitudeEvent.properties, {
      item_details: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          price: { type: 'number' },
          sku: { type: 'string | undefined' }
        }
      },
      cart_size: { type: 'number' }
    });

    // Test Mixpanel event
    const mixpanelEvent = events.find(e => e.source === 'mixpanel');
    assert.ok(mixpanelEvent);
    assert.strictEqual(mixpanelEvent.eventName, 'remove_from_cart');
    assert.strictEqual(mixpanelEvent.functionName, 'removeFromCart');
    assert.strictEqual(mixpanelEvent.line, 119);
    assert.deepStrictEqual(mixpanelEvent.properties, {
      product_id: { type: 'string' },
      timestamp: { type: 'string' }
    });

    // Test Google Analytics event
    const gaEvent = events.find(e => e.source === 'googleanalytics');
    assert.ok(gaEvent);
    assert.strictEqual(gaEvent.eventName, 'begin_checkout');
    assert.strictEqual(gaEvent.functionName, 'handleCheckout');
    assert.strictEqual(gaEvent.line, 130);
    assert.deepStrictEqual(gaEvent.properties, {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, sku: { type: 'string | undefined' } }
        }
      },
      value: { type: 'number' },
      currency: { type: 'string' }
    });

    // Test RudderStack event
    const rudderstackEvent = events.find(e => e.source === 'rudderstack');
    assert.ok(rudderstackEvent);
    assert.strictEqual(rudderstackEvent.eventName, 'checkout_started');
    assert.strictEqual(rudderstackEvent.functionName, 'handleCheckout');
    assert.strictEqual(rudderstackEvent.line, 137);
    assert.deepStrictEqual(rudderstackEvent.properties, {
      products: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, sku: { type: 'string | undefined' } }
        }
      },
      total_items: { type: 'number' }
    });

    // Test mParticle event
    const mparticleEvent = events.find(e => e.source === 'mparticle');
    assert.ok(mparticleEvent);
    assert.strictEqual(mparticleEvent.eventName, 'InitiateCheckout');
    assert.strictEqual(mparticleEvent.functionName, 'handleCheckout');
    assert.strictEqual(mparticleEvent.line, 143);
    assert.deepStrictEqual(mparticleEvent.properties, {
      cart_items: {
        type: 'array',
        items: {
          type: 'object',
          properties: { id: { type: 'string' }, name: { type: 'string' }, price: { type: 'number' }, sku: { type: 'string | undefined' } }
        }
      },
      checkout_step: { type: 'number' }
    });

    // Note: cart_update event is only detected with custom function detection
    // Note: complex_operation event is only detected with custom function detection
  });

  test('should correctly analyze React TypeScript file with custom function', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    const customFunctionSignatures = [parseCustomFunctionSignature('tracker.track')];
    const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);

    // Should find both tracker.track events (cart_update and complex_operation)
    const trackEvents = events.filter(e => e.source === 'custom');
    assert.strictEqual(trackEvents.length, 2);

    const cartUpdateEvent = trackEvents.find(e => e.eventName === 'cart_update');
    assert.ok(cartUpdateEvent);
    assert.strictEqual(cartUpdateEvent.eventName, 'cart_update');
    assert.strictEqual(cartUpdateEvent.functionName, 'trackCartUpdate');
    assert.strictEqual(cartUpdateEvent.line, 155);
    assert.deepStrictEqual(cartUpdateEvent.properties, {
      cart_size: { type: 'number' }
    });

    const complexOpEvent = trackEvents.find(e => e.eventName === 'complex_operation');
    assert.ok(complexOpEvent);
    assert.strictEqual(complexOpEvent.eventName, 'complex_operation');
    assert.strictEqual(complexOpEvent.functionName, 'handleComplexOperation');
    assert.strictEqual(complexOpEvent.line, 62);
    assert.deepStrictEqual(complexOpEvent.properties, {
      hasRef: { type: 'boolean' },
      timestamp: { type: 'number' }
    });
  });

  // Regression tests for "Cannot read properties of undefined (reading 'kind')" fix
  test('should handle complex React class component patterns without crashing (regression test)', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // This should not throw any errors - the main test is that it doesn't crash
    assert.doesNotThrow(() => {
      const events = analyzeTsFile(reactFilePath, program);
      // Should complete analysis without throwing undefined .kind errors
      assert.ok(Array.isArray(events));
      assert.ok(events.length > 0);
    });
  });

  test('should handle complex class component with custom function detection without crashing', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // This was the specific case that was causing "Cannot read properties of undefined (reading 'kind')"
    assert.doesNotThrow(() => {
      const customFunctionSignatures = [parseCustomFunctionSignature('track')];
      const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
      assert.ok(Array.isArray(events));
      
      // Should find the analytics.track call when looking for 'track' custom function
      const analyticsEvent = events.find(e => e.eventName === 'document_upload_clicked');
      assert.ok(analyticsEvent);
      assert.strictEqual(analyticsEvent.source, 'segment');
      assert.strictEqual(analyticsEvent.line, 53);
      assert.deepStrictEqual(analyticsEvent.properties, {
        documentId: { type: 'any' },
        documentType: { type: 'string' }
      });
    });
  });

  test('should handle various custom function detection patterns without undefined errors', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // Test various custom function patterns that could trigger the bug
    const customFunctionTests = [
      'track',
      'analytics.track', 
      'tracker.track',
      'this.track',
      'mixpanel.track',
      'nonexistent.function'
    ];

    customFunctionTests.forEach(customFunction => {
      assert.doesNotThrow(() => {
        const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
        const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
        assert.ok(Array.isArray(events));
      }, `Should not throw error with custom function: ${customFunction}`);
    });
  });

  test('should handle nested property access expressions in custom function detection', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // Test deeply nested property access that could cause undefined node traversal
    const complexCustomFunctions = [
      'this.props.analytics.track',
      'window.analytics.track',
      'deep.nested.property.track',
      'undefined.property.access'
    ];

    complexCustomFunctions.forEach(customFunction => {
      assert.doesNotThrow(() => {
        const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
        const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
        assert.ok(Array.isArray(events));
      }, `Should not crash with complex custom function: ${customFunction}`);
    });
  });

  test('should correctly identify React class method contexts without undefined errors', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    const events = analyzeTsFile(reactFilePath, program);
    
    // Should find the analytics.track call in the arrow function method
    const analyticsEvent = events.find(e => e.eventName === 'document_upload_clicked');
    assert.ok(analyticsEvent);
    assert.strictEqual(analyticsEvent.functionName, 'onFileUploadClick'); // Arrow function methods now show proper names
    assert.strictEqual(analyticsEvent.source, 'segment');
  });

  test('should handle TypeScript React component with complex type intersections', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // The file has complex type intersections: MappedProps & ExplicitProps & ActionProps
    // This should not cause AST traversal issues
    assert.doesNotThrow(() => {
      const customFunctionSignatures = [parseCustomFunctionSignature('uploadError')];
      const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
      assert.ok(Array.isArray(events));
    });
  });

  test('should handle React refs and generic type parameters without errors', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // The file uses React.createRef<any>() which creates complex AST nodes
    assert.doesNotThrow(() => {
      const customFunctionSignatures = [parseCustomFunctionSignature('open')];
      const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
      assert.ok(Array.isArray(events));
    });
  });

  test('should handle both React functional and class components correctly', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // Should work without errors for file containing both patterns
    assert.doesNotThrow(() => {
      const customFunctionSignatures = [parseCustomFunctionSignature('track')];
      const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
      
      assert.ok(Array.isArray(events));
      
      // Should have events from both functional and class components
      assert.ok(events.length > 0);
      
      // Should have functional component events (from hooks)
      const functionalEvents = events.filter(e => e.functionName.includes('useCallback') || e.functionName.includes('useEffect'));
      assert.ok(functionalEvents.length > 0);
      
      // Should have class component events (they now show proper method names)
      const classEvents = events.filter(e => e.functionName === 'onFileUploadClick' || e.functionName === 'handleComplexOperation');
      assert.ok(classEvents.length > 0);
    });
  });

  test('should handle edge cases in isCustomFunction without undefined property access', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // These edge cases were specifically causing the "reading 'kind'" error
    const edgeCaseCustomFunctions = [
      'track', // matches .track in analytics.track
      'current', // matches .current in dropzoneRef.current
      'props', // matches this.props
      'state' // common React property
    ];

    edgeCaseCustomFunctions.forEach(customFunction => {
      assert.doesNotThrow(() => {
        const customFunctionSignatures = [parseCustomFunctionSignature(customFunction)];
        const events = analyzeTsFile(reactFilePath, program, customFunctionSignatures);
        assert.ok(Array.isArray(events));
      }, `Should handle edge case custom function: ${customFunction}`);
    });
  });

  test('should preserve correct event extraction while fixing undefined errors', () => {
    const reactFilePath = path.join(fixturesDir, 'typescript-react', 'main.tsx');
    const program = createProgram(reactFilePath);
    
    // Verify that our fix doesn't break the actual tracking detection
    const events = analyzeTsFile(reactFilePath, program);
    
    // Should correctly identify multiple tracking events including the complex class component
    assert.ok(events.length >= 8);
    
    // Should still correctly identify the analytics.track call from complex component
    const complexEvent = events.find(e => e.eventName === 'document_upload_clicked');
    assert.ok(complexEvent);
    assert.strictEqual(complexEvent.source, 'segment');
    assert.strictEqual(complexEvent.functionName, 'onFileUploadClick');
    assert.strictEqual(complexEvent.line, 53);
    assert.deepStrictEqual(complexEvent.properties, {
      documentId: { type: 'any' },
      documentType: { type: 'string' }
    });
  });

  test('should detect events for all custom function signature variations', () => {
    const variants = [
      { sig: 'customTrackFunction0', event: 'custom_event0' },
      { sig: 'customTrackFunction1(EVENT_NAME, PROPERTIES)', event: 'custom_event1' },
      { sig: 'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)', event: 'custom_event2' },
      { sig: 'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)', event: 'custom_event3' },
      { sig: 'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)', event: 'custom_event4' },
      { sig: 'CustomModule.track(userId, EVENT_NAME, PROPERTIES)', event: 'custom_module_event' },
      { sig: 'customTrackFunction5', event: 'FailedPayment' },
      { sig: 'this.props.customTrackFunction6(EVENT_NAME, PROPERTIES)', event: 'ViewedAttorneyAgreement' },
      { sig: 'customTrackFunction7(EVENT_NAME, PROPERTIES)', event: 'InitiatedPayment' },
    ];

    variants.forEach(({ sig, event }) => {
      const program = createProgram(testFilePath);
      const customFunctionSignatures = [parseCustomFunctionSignature(sig)];
      const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);
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
      'CustomModule.track(userId, EVENT_NAME, PROPERTIES)',
      'customTrackFunction5',
      'this.props.customTrackFunction6(EVENT_NAME, PROPERTIES)',
      'customTrackFunction7(EVENT_NAME, PROPERTIES)',
    ];

    const customFunctionSignatures = variants.map(parseCustomFunctionSignature);
    const program = createProgram(testFilePath);
    const events = analyzeTsFile(testFilePath, program, customFunctionSignatures);

    const expectedEventNames = [
      'custom_event_v2',
      'ecommerce_purchase',
      'custom_event0',
      'custom_event1',
      'custom_event2',
      'custom_event3',
      'custom_event4',
      'custom_module_event',
      'FailedPayment',
      'ViewedAttorneyAgreement',
      'InitiatedPayment'
    ];

    expectedEventNames.forEach(eventName => {
      const evt = events.find(e => e.eventName === eventName && e.source === 'custom');
      assert.ok(evt, `Expected to find event ${eventName}`);
    });

    // Ensure built-in provider events remain unaffected
    const builtInCount = events.filter(e => e.source !== 'custom').length;
    assert.ok(builtInCount >= 10, 'Should still include built-in provider events');
  });

  test('should resolve constants imported via path alias from tsconfig', () => {
    const aliasFilePath = path.join(fixturesDir, 'typescript-alias', 'app', 'components', 'main.ts');
    // Pass null program to force internal program creation (tsconfig parsing)
    const events = analyzeTsFile(aliasFilePath, null, null);

    // Expect one event detected with correct name
    assert.strictEqual(events.length, 1);
    const evt = events[0];
    assert.strictEqual(evt.eventName, 'ViewedPage');
    assert.strictEqual(evt.source, 'mixpanel');
    assert.deepStrictEqual(evt.properties, {
      foo: { type: 'string' }
    });
  });

  test('should detect events with no properties for custom function', () => {
    const eventOnlyFile = path.join(fixturesDir, 'typescript', 'event-only.ts');
    const program = createProgram(eventOnlyFile);
    const customFunctionSignatures = [parseCustomFunctionSignature('trackUserEvent(EVENT_NAME)')];
    const events = analyzeTsFile(eventOnlyFile, program, customFunctionSignatures);

    assert.strictEqual(events.length, 2);

    const literalEvent = events.find(e => e.eventName === 'ViewedEligibilityResults');
    assert.ok(literalEvent);
    assert.deepStrictEqual(literalEvent.properties, {});

    const constantEvent = events.find(e => e.eventName === 'ViewedPostShipDashboard');
    assert.ok(constantEvent);
    assert.deepStrictEqual(constantEvent.properties, {});
  });
});
