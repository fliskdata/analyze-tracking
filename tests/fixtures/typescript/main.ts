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

declare const datadogRum: {
  addAction(eventName: string, properties: Record<string, any>): void;
};

declare const DD_RUM: {
  addAction(eventName: string, properties: Record<string, any>): void;
};

declare const window: {
  DD_RUM: {
    addAction(eventName: string, properties: Record<string, any>): void;
  };
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

  // Datadog tracking examples - all three patterns
  datadogRum.addAction('checkout_completed', {
    total: 500,
    orderId: 'ABC123',
    currency: 'USD',
    items: itemsList.length
  });

  window.DD_RUM.addAction('user_registration', {
    user_id: 'user123',
    method: 'email',
    success: true,
    referrer: 'organic'
  });

  DD_RUM.addAction('error_occurred', {
    error_type: 'validation',
    field: 'email',
    page: '/checkout'
  });
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
import { TRACKING_EVENTS, TRACKING_EVENTS_FROZEN, ECOMMERCE_PURCHASE_V2 } from "./constants";
const purchaseEvent = {
  orderId: 'order_123',
  total: 99.99,
  items: ['sku_1', 'sku_2']
};
customTrackFunction('user555', TRACKING_EVENTS.ECOMMERCE_PURCHASE, purchaseEvent);
mixpanel.track(TRACKING_EVENTS_FROZEN.ECOMMERCE_PURCHASE, {orderId: purchaseEvent.orderId, total: purchaseEvent.total, items: purchaseEvent.items});
analytics.track(ECOMMERCE_PURCHASE_V2, {...purchaseEvent});

// -----------------------------------------------------------------------------
// Additional custom tracking function variants for testing
// -----------------------------------------------------------------------------

declare function customTrackFunction0(EVENT_NAME: string, PROPERTIES: Record<string, any>): void;
declare function customTrackFunction1(EVENT_NAME: string, PROPERTIES: Record<string, any>): void;
declare function customTrackFunction2(userId: string, EVENT_NAME: string, PROPERTIES: Record<string, any>): void;
declare function customTrackFunction3(EVENT_NAME: string, PROPERTIES: Record<string, any>, userEmail: string): void;
declare function customTrackFunction4(userId: string, EVENT_NAME: string, userAddress: Record<string, any>, PROPERTIES: Record<string, any>, userEmail: string): void;

// Calls for each variant so tests can verify detection
customTrackFunction0('custom_event0', { foo: 'bar' });
customTrackFunction1('custom_event1', { foo: 'bar' });
customTrackFunction2('user101', 'custom_event2', { foo: 'bar' });
customTrackFunction3('custom_event3', { foo: 'bar' }, 'user@example.com');
customTrackFunction4('user202', 'custom_event4', { city: 'San Francisco' }, { foo: 'bar' }, 'user@example.com');

// -----------------------------------------------------------------------------
// Dot-separated custom tracking function (module-style)
// -----------------------------------------------------------------------------

namespace CustomModule {
  export function track(userId: string, eventName: string, params: Record<string, any>): void {
    console.log('CustomModule.track', userId, eventName, params);
  }
}

CustomModule.track('user333', 'custom_module_event', {
  order_id: 'order_xyz',
  foo: 'bar'
});

// -----------------------------------------------------------------------------
// Additional Object.freeze constant and customTrackFunction6 patterns (new tests)
// -----------------------------------------------------------------------------

export const TELEMETRY_EVENTS = Object.freeze({
  VIEWED_TRANSITION: 'ViewedTransition',
  INITIATED_PAYMENT: 'InitiatedPayment',
  FAILED_PAYMENT: 'FailedPayment',
  VIEWED_ATTORNEY_AGREEMENT: 'ViewedAttorneyAgreement',
  ACCEPTED_ATTORNEY_AGREEMENT: 'AcceptedAttorneyAgreement',
  DECLINED_ATTORNEY_AGREEMENT_FOR_REFUND: 'DeclinedAttorneyAgreementForRefund',
  SUCCEEDED_PAYMENT: 'SucceededPayment',
});

declare function customTrackFunction5(EVENT_NAME: string, PROPERTIES: Record<string, any>): void;
declare function customTrackFunction6(EVENT_NAME: string, PROPERTIES: Record<string, any>): void;
declare function customTrackFunction7(EVENT_NAME: string, PROPERTIES: Record<string, any>): void;

declare function dispatch(action: any): void;

// Nested inside another function call (e.g., Redux dispatch pattern)
dispatch(
  customTrackFunction7(TELEMETRY_EVENTS.INITIATED_PAYMENT, {
    containerSection: 'PaymentPage',
    tierCartIntent: 'Gold',
  })
);

// Variable reference as properties argument
const paymentArgs = {
  containerSection: 'Checkout',
  amount: 99.99,
};
dispatch(
  customTrackFunction5(TELEMETRY_EVENTS.FAILED_PAYMENT, paymentArgs)
);

// Member expression chain: this.props.customTrackFunction6
class ExampleComponent {
  props: { customTrackFunction6: (evt: string, props: Record<string, any>) => void };

  constructor() {
    this.props = {
      customTrackFunction6: () => {},
    };
  }

  handleView() {
    this.props.customTrackFunction6(TELEMETRY_EVENTS.VIEWED_ATTORNEY_AGREEMENT, {});
  }
}

// -----------------------------------------------------------------------------
// Redux-style mapDispatchToActions with nested customTrackFunction6 patterns
// -----------------------------------------------------------------------------

interface ExplicitPropsRedux {
  tier: string;
  containerSection: string;
  applicationFeeInCents: number;
}

interface MappedProps {}

type GlobalErrorObject = { type: string; payload: any };

type ActionProps = Record<string, any>;

declare function closeModal(...args: any[]): void;
declare function postTelemetryWithConversion(
  eventName: string,
  props: Record<string, any>,
  conversionEvent: string,
  extra: Record<string, any>,
  urls: string[],
  destinations: string[]
): void;

declare const CONVERSION_TRACKING_EVENTS: { PAYMENT: string };
declare const CONVERSION_TRACKING_DESTINATIONS: { FACEBOOK: string; GOOGLE: string };

declare function trackUserEvent(eventName: string, props: Record<string, any>): void; // alias to customTrackFunction6

function mapDispatchToActions(dispatch: Function, ownProps: ExplicitPropsRedux & MappedProps): ActionProps {
  return {
    closeModal: (...args: any[]) => dispatch(closeModal(...args)),
    setGlobalError: ({ type, payload }: GlobalErrorObject) => dispatch({ type, payload }),

    // Variable-only properties argument
    trackFailedPayment: (args: Record<string, any>) => dispatch(
      customTrackFunction6(TELEMETRY_EVENTS.FAILED_PAYMENT, args)
    ),

    // Object literal with spread + additional props
    trackInitiatedPayment: (args: Record<string, any>) => dispatch(
      customTrackFunction7(TELEMETRY_EVENTS.INITIATED_PAYMENT, {
        ...args,
        containerSection: ownProps.containerSection,
        tierCartIntent: ownProps.tier,
      })
    ),
  };
}

// -----------------------------------------------------------------------------
// Google Tag Manager (GTM) tracking examples
// -----------------------------------------------------------------------------

// Extend existing window declaration to include dataLayer
interface GTMWindow extends Window {
  dataLayer: any[];
}

declare const dataLayer: any[];

// GTM example 1: window.dataLayer.push with explicit types
interface GTMEvent {
  event: string;
  [key: string]: any;
}

(window as any).dataLayer.push({
  'event': 'formSubmission',
  'formId': 'contactForm',
  'formLocation': 'footer',
  'timestamp': Date.now()
} as GTMEvent);

// GTM example 2: dataLayer.push (without window) with typed interface  
interface UserRegistrationEvent {
  event: 'userRegistration';
  userId: string;
  source: string;
  plan: string;
}

const gtmRegistrationEvent: UserRegistrationEvent = {
  event: 'userRegistration',
  userId: 'user123',
  source: 'organic',
  plan: 'premium'
};
dataLayer.push(gtmRegistrationEvent);

// GTM example 3: complex ecommerce tracking
interface GTMEcommerceItem {
  item_id: string;
  item_name: string;
  price: number;
}

interface GTMEcommercePurchaseEvent {
  event: 'ecommerce_purchase';
  transactionId: string;
  value: number;
  currency: string;
  items: GTMEcommerceItem[];
}

const gtmPurchaseEvent: GTMEcommercePurchaseEvent = {
  event: 'ecommerce_purchase',
  transactionId: 'txn_123',
  value: 99.99,
  currency: 'USD',
  items: [
    {
      item_id: 'sku_001',
      item_name: 'Product A',
      price: 49.99
    },
    {
      item_id: 'sku_002',
      item_name: 'Product B', 
      price: 50.00
    }
  ]
};
(window as any).dataLayer.push(gtmPurchaseEvent);

// GTM example 4: inside a function
function gtmTestFunction(): void {
  dataLayer.push({
    'event': 'buttonClick',
    'buttonText': 'Subscribe Now',
    'location': 'header',
    'timestamp': new Date().toISOString()
  });
}

// GTM example 5: with variable reference
const GTM_EVENTS = {
  VIDEO_PLAY: 'video_play'
} as const;

(window as any).dataLayer.push({
  'event': GTM_EVENTS.VIDEO_PLAY,
  'videoTitle': 'Product Demo',
  'videoDuration': 120
});
