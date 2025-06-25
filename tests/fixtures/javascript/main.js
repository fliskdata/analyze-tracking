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
