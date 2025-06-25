// trackingExamples.ts

// -----------------------------------------------------------------------------
// Declarations for global tracking functions / objects
// (for test fixtures; in a real project you'd import these from their SDKs)
// -----------------------------------------------------------------------------
declare function gtag(
  eventType: 'event',
  eventName: string,
  params: Record<string, any>
): void;

declare const analytics: {
  track(eventName: string, properties: Record<string, any>): void;
};

declare const mixpanel: {
  track(eventName: string, properties: Record<string, any>): void;
};

declare const amplitude: {
  track(eventName: string, properties: Record<string, any>): void;
};

declare const rudderanalytics: {
  track(eventName: string, properties: Record<string, any>): void;
};

declare const mParticle: {
  logEvent(
    eventName: string,
    eventType: unknown,
    properties: Record<string, any>
  ): void;
  EventType: {
    Transaction: unknown;
  };
};

declare const posthog: {
  capture(eventName: string, properties: Record<string, any>): void;
};

declare const pendo: {
  track(eventName: string, properties: Record<string, any>): void;
};

declare const heap: {
  track(eventName: string, properties: Record<string, any>): void;
};

declare const tracker: {
  track(event: unknown): void;
};
declare function buildStructEvent(payload: {
  action: string;
  category: string;
  label: string;
  property: string;
  value: number;
}): unknown;

declare function customTrackFunction(
  userId: string,
  eventName: string,
  params: Record<string, any>
): void;

declare function createOrder(): Promise<string>;

// -----------------------------------------------------------------------------
// Interfaces
// -----------------------------------------------------------------------------
export interface Product {
  id: string;
  name: string;
  price: number;
  sku?: string;            // optional stock-keeping unit
}

interface Address {
  city: string;
  state: string;
  postalCode?: string;     // optional postal code
}

// -----------------------------------------------------------------------------
// checkout: GA4, Segment, Mixpanel, Amplitude, Rudderstack examples
// -----------------------------------------------------------------------------
export async function checkout(products: Product[]): Promise<void> {
  const orderId: string = 'order_xyz';

  const items: Product[] = products.map(({ id, name, price, sku }) => ({
    id,
    name,
    price,
    sku,
  }));

  const orderTotal: number = items.reduce((sum, p) => sum + p.price, 0);
  const location: Address = { city: 'San Francisco', state: 'CA', postalCode: '94105' };

  // GA4: order_completed
  function trackOrderCompletedGA(): void {
    gtag('event', 'order_completed', {
      order_id: orderId,
      products: items,
      order_total: orderTotal,
      location,
      currency: 'USD',
    });
  }
  trackOrderCompletedGA();

  // Segment: user_checkout
  const segmentProps: Record<string, any> = {
    stage: 'payment',
    method: 'credit_card',
    item_count: items.length,
  };
  analytics.track('user_checkout', segmentProps);

  // Mixpanel: purchase_confirmed (nested function)  
  function confirmPurchaseMixpanel(): void {
    const mixProps: Record<string, any> = {
      order_id: orderId,
      items,
      total_amount: orderTotal,
    };
    mixpanel.track('purchase_confirmed', mixProps);
  }
  confirmPurchaseMixpanel();

  // Amplitude: checkout_initiated
  amplitude.track('checkout_initiated', {
    order_id: orderId,
    items,
    order_total: orderTotal,
    location,
    coupon_code: null,
  });

  // Rudderstack: order_finalized
  const rudderProps: Record<string, any> = {
    order_id: orderId,
    items,
    revenue: orderTotal,
    location,
  };
  rudderanalytics.track('order_finalized', rudderProps);
}

// -----------------------------------------------------------------------------
// checkout2: mParticle & PostHog examples with typed helpers
// -----------------------------------------------------------------------------
export async function checkout2(products: Product[]): Promise<void> {
  const orderId: string = await createOrder();

  const items: Array<Product> = products.map(p => ({ ...p }));
  const totalAmount: number = items.reduce((sum, p) => sum + p.price, 0);
  const locationData: Address = { city: 'San Francisco', state: 'CA' };

  // mParticle: transaction_event
  interface MParticleProps {
    order_id: string;
    items: Product[];
    total: number;
    location: Address;
  }
  const mPartProps: MParticleProps = {
    order_id: orderId,
    items,
    total: totalAmount,
    location: locationData,
  };
  mParticle.logEvent('BuyNow', mParticle.EventType.Transaction, mPartProps);

  const retryCount: number = 3;

  // PostHog: user_action
  type PostHogProps = {
    order_id: string;
    retry: number;
    items: Product[];
    amount: number;
    shipping: Address;
  };
  const posthogProps: PostHogProps = {
    order_id: orderId,
    retry: retryCount,
    items,
    amount: totalAmount,
    shipping: locationData,
  };
  posthog.capture('user_action', posthogProps);
}

// -----------------------------------------------------------------------------
// checkout3: Pendo & Heap examples with explicit types
// -----------------------------------------------------------------------------
export function checkout3(): void {
  const orderId: string = 'order_xyz';
  const itemsList: ReadonlyArray<Product> = [
    { id: '123', name: 'Product 1', price: 100 },
  ];
  const subtotal: number = 345;
  const addressInfo: Address = { city: 'San Francisco', state: 'CA' };

  // Pendo: customer_checkout
  const pendoPayload: Record<string, any> = {
    order_id: orderId,
    products: itemsList,
    subtotal,
    address: addressInfo,
  };
  pendo.track('customer_checkout', pendoPayload);

  // Heap: user_login
  const heapData: {
    user_id: string;
    email: string;
    name: string;
    roles?: string[];
  } = {
    user_id: 'user123',
    email: 'user123@example.com',
    name: 'John Doe',
    roles: ['admin', 'editor'],
  };
  heap.track('user_login', heapData);
}

// -----------------------------------------------------------------------------
// MyClass: Snowplow example with typed builder
// -----------------------------------------------------------------------------
export class MyClass {
  constructor(private readonly value: number) {}

  public trackSnowplow(): void {
    const payload = buildStructEvent({
      action: 'item_view',
      category: 'interaction',
      label: 'view_item',
      property: 'item_count',
      value: this.value,
    });
    tracker.track(payload);
  }

  public trackSnowplow2(): void {
    tracker.track(buildStructEvent({
      action: 'button_click',
      category: 'interaction',
      label: 'view_item',
      property: 'button_name',
      value: this.value,
    }));
  }
}

// -----------------------------------------------------------------------------
// Usage examples
// -----------------------------------------------------------------------------
const myClassInstance = new MyClass(42_000_000);
myClassInstance.trackSnowplow();

// Custom tracking: advanced usage
interface CustomParams {
  order_id: string;
  value: number;
  list: string[];
  metadata: Record<string, any>;
}
const customParams: CustomParams = {
  order_id: 'order_xyz',
  value: 42_000_000,
  list: ['itemA', 'itemB'],
  metadata: { source: 'unit_test', retry: false },
};
customTrackFunction('user888', 'custom_event_v2', customParams);

// -----------------------------------------------------------------------------
// Event name is a const/pointer, not a string literal
// -----------------------------------------------------------------------------
import { TRACKING_EVENTS, ECOMMERCE_PURCHASE_V2 } from "./constants";
const purchaseEvent = {
  orderId: 'order_123',
  total: 99.99,
  items: ['sku_1', 'sku_2']
};
customTrackFunction('user555', TRACKING_EVENTS.ECOMMERCE_PURCHASE, purchaseEvent);

analytics.track(ECOMMERCE_PURCHASE_V2, {...purchaseEvent});
