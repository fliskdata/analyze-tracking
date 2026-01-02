// Test fixture for advanced type resolution scenarios
// This file tests:
// 1. Custom interface types being resolved to their properties
// 2. Union types with undefined (e.g., { id: string } | undefined)
// 3. Enum types being resolved to their values
// 4. Complex nested objects

// Enum definition
enum SubscriptionType {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly',
}

// Another enum for testing
enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  PAYPAL = 'paypal',
}

// Interface definition
interface ICartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  sku?: string;
}

// Interface with optional and enum fields
interface IUserInfo {
  id: string;
  email: string;
  name: string;
  subscription?: SubscriptionType;
  preferredPayment?: PaymentMethod;
}

// Declare eventCalls for testing
declare const eventCalls: {
  [key: string]: (props: any) => void;
};

// Test 1: Array of custom interface types
const cartItems: ICartItem[] = [{ id: '1', name: 'Product', price: 10, quantity: 1 }];
eventCalls.viewCart({
  items: cartItems,
  total: 100,
});

// Test 2: Union type with undefined (object literal in union)
const user: { id: string; name: string; email: string } | undefined = { id: '123', name: 'John', email: 'john@example.com' };
eventCalls.purchase({
  orderId: 'order_123',
  user: user,
  total: 150,
});

// Test 3: Enum type resolution
const subscriptionType: SubscriptionType = SubscriptionType.MONTHLY;
eventCalls.subscriptionCreated({
  userId: 'user_123',
  subscription: subscriptionType,
  paymentMethod: PaymentMethod.CREDIT_CARD,
});

// Test 4: Complex nested object with interface
interface IAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface ICheckoutData {
  items: ICartItem[];
  user: IUserInfo;
  shippingAddress: IAddress;
  billingAddress?: IAddress;
  total: number;
}

const checkoutData: ICheckoutData = {
  items: [],
  user: { id: '1', email: 'test@test.com', name: 'Test' },
  shippingAddress: { street: '123 Main', city: 'SF', state: 'CA', zip: '94102' },
  total: 200,
};

eventCalls.checkoutCompleted({
  checkout: checkoutData,
  timestamp: Date.now(),
});

// Test 5: Inline object with optional fields using conditional expression
const maybeUser = true ? { id: 'user1', email: 'test@example.com', name: 'Test User' } : undefined;
eventCalls.userAction({
  user: maybeUser,
  action: 'click',
});
