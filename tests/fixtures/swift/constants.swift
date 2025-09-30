// Swift test fixtures: constants and helpers used across examples

import Foundation

// Event name constants to simulate pointer-based usage
enum EVENTS {
  static let userSignedUp = "user_signed_up"
  static let orderCompleted = "order_completed"
  static let checkoutInitiated = "checkout_initiated"
  static let customerCheckout = "customer_checkout"
  static let userLogin = "user_login"
  static let purchase = "purchase"
  static let formSubmission = "formSubmission"
  static let ecommercePurchase = "ecommerce_purchase"
  static let videoPlay = "video_play"
}

// Common property keys to simulate pointer usage
enum KEYS {
  static let orderId = "order_id"
  static let products = "products"
  static let total = "total"
  static let address = "address"
  static let userId = "user_id"
  static let email = "email"
  static let name = "name"
  static let city = "city"
  static let state = "state"
}

// Sample data builders
func makeProducts() -> [[String: Any]] {
  return [
    ["id": "sku_001", "name": "Product A", "price": 49.99],
    ["id": "sku_002", "name": "Product B", "price": 50.00]
  ]
}

func makeAddress() -> [String: Any] {
  return [
    KEYS.city: "San Francisco",
    KEYS.state: "CA",
  ]
}

let ORDER_ID = "order_123"
let USER_ID = "user_abc"
let EMAIL = "user@example.com"
let NAME = "Jane Doe"
