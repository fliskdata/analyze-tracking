export const checkout = async (products) => {
  const orderId = 'order123'

  const productsList = products.map(product => {
    return {
      id: product.id,
      name: product.name,
      price: product.price
    }
  })

  // Google Analytics tracking example
  const trackGA4 = () => {
    gtag('event', 'purchase', {
      order_id: orderId,
      products: productsList,
      total: products.reduce((acc, product) => acc + product.price, 0),
      address: {
        city: 'San Francisco',
        state: 'CA'
      }
    });
  }
  trackGA4()

  // Segment tracking example
  analytics.track("newEvent", {
    something: "value",
    count: 5,
  });

  function test12345678() {
    // Mixpanel tracking example
    mixpanel.track('orderCompleted', {
      order_id: orderId,
      products: productsList,
      total: products.reduce((acc, product) => acc + product.price, 0)
    })
  }

  test12345678();

  // Amplitude tracking example
  amplitude.track('checkout', {
    order_id: orderId,
    products: productsList,
    total: products.reduce((acc, product) => acc + product.price, 0),
    address: {
      city: 'San Francisco',
      state: 'CA'
    }
  })

  const total = products.reduce((acc, product) => acc + product.price, 0)

  // Rudderstack tracking example
  rudderanalytics.track('Order Completed', {
    order_id: orderId,
    products: productsList,
    revenue: total,
    address: {
      city: 'San Francisco',
      state: 'CA'
    }
  });
}

export const checkout2 = async (products) => {
  const orderId = await createOrder();

  const productsList = products.map(product => {
    return {
      id: product.id,
      name: product.name,
      price: product.price
    };
  });

  // mParticle tracking example
  mParticle.logEvent('Buy Now', mParticle.EventType.Transaction, {
    order_id: orderId,
    products: productsList,
    total: products.reduce((acc, product) => acc + product.price, 0),
    address: {
      city: 'San Francisco',
      state: 'CA'
    }
  });

  const blah = 5

  // posthog tracking example
  posthog.capture('user click', {
    order_id: orderId,
    blah,
    products: productsList,
    total: blah,
    address: {
      city: 'San Francisco',
      state: 'CA'
    }
  });
}

export const checkout3 = function() {
  // pendo tracking example
  pendo.track('customer checkout', {
    order_id: 'order123',
    products: [
      {
        id: '123',
        name: 'Product 1',
        price: 100
      }
    ],
    total: 345,
    address: {
      city: 'San Francisco',
      state: 'CA'
    }
  });

  // heap tracking example
  heap.track('login', {
    user_id: 'user123',
    email: 'user123@example.com',
    name: 'John Doe'
  });

  // datadog tracking examples - all three patterns
  datadogRum.addAction('checkout', {
    total: 500,
    order_id: 'ABC123',
    currency: 'USD'
  });

  window.DD_RUM.addAction('user_login', {
    user_id: 'user123',
    method: 'email',
    success: true
  });

  DD_RUM.addAction('page_view', {
    page: '/checkout',
    section: 'payment',
    user_type: 'premium'
  });
}

class MyClass {
  constructor(value) {
    this.value = value;
  }

  trackSnowplow() {
    // snowplow tracking example
    tracker.track(buildStructEvent({
      action: 'someevent',
      category: 'purchase',
      label: 'abc123',
      property: 'num_pizzas',
      value: this.value
    }));
  }
}

const myClass = new MyClass(12345678);
myClass.trackSnowplow();

// custom tracking example
customTrackFunction('user999', 'customEvent', {
  order_id: 'order123',
  value: 12345678,
  list: ['item1', 'item2', 'item3']
});

// -----------------------------------------------------------------------------
// Additional custom tracking function variants for testing
// -----------------------------------------------------------------------------

customTrackFunction0('custom_event0', { foo: 'bar' });
customTrackFunction1('custom_event1', { foo: 'bar' });
customTrackFunction2('user101', 'custom_event2', { foo: 'bar' });
customTrackFunction3('custom_event3', { foo: 'bar' }, 'user@example.com');
customTrackFunction4('user202', 'custom_event4', { city: 'San Francisco' }, { foo: 'bar' }, 'user@example.com');

// -----------------------------------------------------------------------------
// Dot-separated custom tracking function (module-style)
// -----------------------------------------------------------------------------

const CustomModule = {
  track(userId, eventName, params) {
    console.log('CustomModule.track', userId, eventName, params);
  }
};

CustomModule.track('user321', 'custom_module_event', {
  order_id: 'order123',
  foo: 'bar'
});

// -----------------------------------------------------------------------------
// Object.freeze constant tracking example (new test case)
// -----------------------------------------------------------------------------
const TRACKING_EVENTS_FROZEN = Object.freeze({
  ECOMMERCE_PURCHASE: 'ecommerce_purchase_frozen',
});

mixpanel.track(TRACKING_EVENTS_FROZEN.ECOMMERCE_PURCHASE, {
  orderId: 'order_123',
  total: 99.99,
  items: ['sku_1', 'sku_2']
});

// -----------------------------------------------------------------------------
// Google Tag Manager (GTM) tracking examples
// -----------------------------------------------------------------------------

// GTM example 1: window.dataLayer.push
window.dataLayer.push({
  'event': 'formSubmission',
  'formId': 'contactForm',
  'formLocation': 'footer'
});

// GTM example 2: dataLayer.push (without window)
dataLayer.push({
  'event': 'userRegistration',
  'userId': 'user123',
  'source': 'organic',
  'plan': 'premium'
});

// GTM example 3: complex properties
window.dataLayer.push({
  'event': 'ecommerce_purchase',
  'transactionId': 'txn_123',
  'value': 99.99,
  'currency': 'USD',
  'items': [
    {
      'item_id': 'sku_001',
      'item_name': 'Product A',
      'price': 49.99
    },
    {
      'item_id': 'sku_002', 
      'item_name': 'Product B',
      'price': 50.00
    }
  ]
});

function gtmTestFunction() {
  // GTM example 4: inside a function
  dataLayer.push({
    'event': 'buttonClick',
    'buttonText': 'Subscribe Now',
    'location': 'header'
  });
}
