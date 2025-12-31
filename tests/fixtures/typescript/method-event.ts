// Method-as-event tracking pattern test fixture
// Uses eventCalls.METHOD_NAME({ properties }) where METHOD_NAME is the event name

eventCalls.viewItemList({
  items: [{ id: '1', name: 'Product' }],
  item_list_id: '/products',
  item_list_name: 'Featured Products',
});

function handleAddToCart(): void {
  eventCalls.addToCart({
    items: [{ id: '1', price: 29.99, quantity: 2 }],
    value: 59.98,
    user: { id: 'user123', email: 'test@example.com', name: 'John Doe' },
  });
}

eventCalls.removeFromCart({
  items: [{ id: '1' }],
  value: 29.99,
});

const checkoutHandler = (): void => {
  eventCalls.beginCheckout({
    items: [{ id: '1' }, { id: '2' }],
    currency: 'USD',
    value: 150.00,
  });
};

checkoutHandler();

// Test with nested objects
eventCalls.purchase({
  transaction_id: 'txn_123',
  value: 99.99,
  currency: 'USD',
  items: [
    {
      item_id: 'sku_001',
      item_name: 'Product A',
      price: 49.99,
      quantity: 1,
    },
    {
      item_id: 'sku_002',
      item_name: 'Product B',
      price: 50.00,
      quantity: 1,
    },
  ],
  shipping: {
    method: 'standard',
    cost: 5.99,
    address: {
      city: 'San Francisco',
      state: 'CA',
      zip: '94102',
    },
  },
});

// Test with no properties (empty object)
eventCalls.pageView({});

// Test with constant event names (method name is still the event)
const EVENT_TYPES = {
  CUSTOM_EVENT: 'custom_event_name',
};

// Even with constants defined, method name takes precedence
eventCalls.complexOperation({
  timestamp: Date.now(),
  metadata: { source: 'test', version: '1.0' },
});
