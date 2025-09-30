// Swift test fixtures for analytics SDKs (for detection coverage only)
// This file intentionally uses a variety of patterns: direct literals, constants,
// nested functions, classes/structs, and optional/empty properties.

import Foundation

// MARK: - Stubs for SDK symbols (so this compiles in isolation if needed)

// These are lightweight placeholders to mimic common Swift SDK APIs.
enum Analytics { // Google Analytics GA4 via Firebase style
  static func logEvent(_ name: String, parameters: [String: Any]?) {}
}

var dataLayer: [[String: Any]] = [] // Google Tag Manager

class SegmentAnalytics {
  func track(name: String, properties: [String: Any]?) {}
}
let analytics = SegmentAnalytics()

class MixpanelInstance {
  func track(event: String, properties: [String: Any]?) {}
}
class Mixpanel {
  static func mainInstance() -> MixpanelInstance { MixpanelInstance() }
}

class AmplitudeClient {
  func track(eventType: String, eventProperties: [String: Any]?) {}
}
let amplitude = AmplitudeClient()

class RSClient { // Rudderstack
  static func sharedInstance() -> RSClient? { RSClient() }
  func track(_ event: String, properties: [String: Any]?) {}
}

class MPEvent { // mParticle
  enum EventType { case other }
  let name: String
  let type: EventType
  var customAttributes: [String: Any]? = nil
  init(name: String, type: EventType) { self.name = name; self.type = type }
}
class MParticle {
  static func sharedInstance() -> MParticle { MParticle() }
  func logEvent(_ event: MPEvent) {}
}

class PostHogSDK {
  static let shared = PostHogSDK()
  func capture(_ event: String, properties: [String: Any]?) {}
}

class PendoManager {
  static func shared() -> PendoManager { PendoManager() }
  func track(_ event: String, properties: [String: Any]?) {}
}

class Heap {
  static let shared = Heap()
  func track(_ event: String, properties: [String: Any]?) {}
}

// MARK: - Constants and helpers

// Reuse builders from constants.swift
// EVENTS.*, KEYS.*, ORDER_ID, USER_ID, EMAIL, NAME, makeProducts(), makeAddress()

// MARK: - Google Analytics (GA4)

func trackGA_Purchase() {
  Analytics.logEvent("purchase", parameters: [
    KEYS.orderId: ORDER_ID,
    KEYS.products: makeProducts(),
    KEYS.total: 99.99,
    KEYS.address: makeAddress(),
  ])
}

func trackGA_NoProps() {
  Analytics.logEvent(EVENTS.purchase, parameters: nil)
}

// MARK: - Google Tag Manager

func pushGTM_Basic() {
  dataLayer.append(["event": EVENTS.formSubmission, "formId": "contactForm", "formLocation": "footer"])
}

func pushGTM_ViaWindowStyle() {
  dataLayer.append(["event": EVENTS.ecommercePurchase, KEYS.total: 99.99, "currency": "USD", KEYS.products: makeProducts()])
}

// MARK: - Segment

func segment_TrackLiteral() {
  analytics.track(name: "newEvent", properties: [
    "something": "value",
    "count": 5,
  ])
}

func segment_TrackConstants() {
  let props: [String: Any] = ["stage": "payment", "method": "credit_card", "item_count": 3]
  analytics.track(name: "user_checkout", properties: props)
}

func segment_TrackNoProps() {
  analytics.track(name: "app_opened", properties: nil)
}

// MARK: - Mixpanel

func mixpanel_OrderCompleted() {
  Mixpanel.mainInstance().track(event: "orderCompleted", properties: [
    KEYS.orderId: ORDER_ID,
    KEYS.products: makeProducts(),
    KEYS.total: 99.99,
  ])
}

func mixpanel_NoProps() {
  Mixpanel.mainInstance().track(event: EVENTS.purchase, properties: nil)
}

// MARK: - Amplitude

func amplitude_CheckoutInitiated() {
  amplitude.track(eventType: EVENTS.checkoutInitiated, eventProperties: [
    KEYS.orderId: ORDER_ID,
    KEYS.products: makeProducts(),
    KEYS.total: 99.99,
    KEYS.address: makeAddress(),
  ])
}

func amplitude_Empty() {
  amplitude.track(eventType: EVENTS.checkoutInitiated, eventProperties: [:])
}

// MARK: - Rudderstack

func rudder_OrderCompleted() {
  RSClient.sharedInstance()?.track("Order Completed", properties: [
    KEYS.orderId: ORDER_ID,
    KEYS.products: makeProducts(),
    "revenue": 99.99,
  ])
}

func rudder_NoProps() {
  RSClient.sharedInstance()?.track("App Launched", properties: nil)
}

// MARK: - mParticle

func mparticle_Transaction() {
  let event = MPEvent(name: "Buy Now", type: .other)
  event.customAttributes = [
    KEYS.orderId: ORDER_ID,
    KEYS.products: makeProducts(),
    KEYS.total: 123.45,
    KEYS.address: makeAddress(),
  ]
  MParticle.sharedInstance().logEvent(event)
}

func mparticle_Minimal() {
  let event = MPEvent(name: "Viewed Screen", type: .other)
  MParticle.sharedInstance().logEvent(event)
}

// MARK: - PostHog

func posthog_UserAction() {
  PostHogSDK.shared.capture(EVENTS.userSignedUp, properties: [
    KEYS.userId: USER_ID,
    "method": "email",
    "plan": "premium",
  ])
}

func posthog_NoProps() {
  PostHogSDK.shared.capture("app_opened", properties: nil)
}

// MARK: - Pendo

func pendo_CustomerCheckout() {
  PendoManager.shared().track(EVENTS.customerCheckout, properties: [
    KEYS.orderId: ORDER_ID,
    "products": makeProducts(),
    "subtotal": 345,
    KEYS.address: makeAddress(),
  ])
}

func pendo_NoProps() {
  PendoManager.shared().track("onboarding_step_viewed", properties: nil)
}

// MARK: - Heap

func heap_UserLogin() {
  Heap.shared.track(EVENTS.userLogin, properties: [
    KEYS.userId: USER_ID,
    KEYS.email: EMAIL,
    KEYS.name: NAME,
  ])
}

func heap_Minimal() {
  Heap.shared.track("heartbeat", properties: [:])
}

// MARK: - Nested patterns and classes

final class AnalyticsManager {
  func trackCheckoutFlow() {
    // Nested function calling multiple trackers
    func step1() { trackGA_Purchase() }
    func step2() { amplitude_CheckoutInitiated() }
    func step3() { rudder_OrderCompleted() }
    step1(); step2(); step3()
  }

  func trackFromConstants() {
    Analytics.logEvent(EVENTS.orderCompleted, parameters: [
      KEYS.orderId: ORDER_ID,
      KEYS.products: makeProducts(),
    ])
  }
}

struct ViewControllerLike {
  func onAppear() {
    segment_TrackLiteral()
    mixpanel_NoProps()
    heap_Minimal()
  }
}

// MARK: - Custom tracking functions (stubs)

// Generic custom tracking signatures mirroring other languages' fixtures
func customTrackFunction(_ userId: String, _ eventName: String, _ params: [String: Any]) {}
func customTrackFunction0(_ eventName: String, _ params: [String: Any]) {}
func customTrackFunction1(_ eventName: String, _ params: [String: Any]) {}
func customTrackFunction2(_ userId: String, _ eventName: String, _ params: [String: Any]) {}
func customTrackFunction3(_ eventName: String, _ params: [String: Any], _ userEmail: String) {}
func customTrackFunction4(_ userId: String, _ eventName: String, _ userAddress: [String: Any], _ params: [String: Any], _ userEmail: String) {}
func customTrackFunction5(_ eventName: String, _ params: [String: Any]) {}
func customTrackFunction6(_ eventName: String, _ params: [String: Any]) {}
func customTrackFunction7(_ eventName: String, _ params: [String: Any]) {}

// No-properties variant
func customTrackNoProps(_ eventName: String) {}

// Dot-namespaced module style
enum My {
  enum Module {
    enum Here {
      static func `func`(_ eventName: String) {}
    }
  }
}

// Module-style static tracker
enum CustomModule {
  static func track(_ userId: String, _ eventName: String, _ params: [String: Any]) {}
}

// Chained service style
struct TrackingService { func track(_ eventName: String, _ params: [String: Any]) {} }
func getTrackingService() -> TrackingService { TrackingService() }

// Other() builder style with extra custom fields
struct Other {
  func module(_ eventName: String, _ properties: [String: Any], _ customFieldOne: Any, _ customFieldTwo: Any) {}
}

// Component-like props carrier
class Props { func customTrackFunction6(_ eventName: String, _ props: [String: Any]) {} }
class SwiftExampleComponent {
  var props = Props()
  func handleView() {
    self.props.customTrackFunction6("ViewedAttorneyAgreementSwift", [:])
  }
}

// Redux-like dispatch wrapper
func dispatch(_ action: Any) {}

// MARK: - Custom tracking examples

func customExamples() {
  // Direct custom tracking with userId first
  customTrackFunction(USER_ID, "custom_event_swift", [
    KEYS.orderId: ORDER_ID,
    "value": 42,
    "list": ["a", "b"],
  ])

  // Signature variants (0..4) like other languages
  customTrackFunction0("custom_event0_swift", ["foo": "bar"])
  customTrackFunction1("custom_event1_swift", ["foo": "bar"])
  customTrackFunction2(USER_ID, "custom_event2_swift", ["foo": "bar"])
  customTrackFunction3("custom_event3_swift", ["foo": "bar"], "user@example.com")
  customTrackFunction4(USER_ID, "custom_event4_swift", ["city": "San Francisco"], ["foo": "bar"], "user@example.com")

  // Namespaced module function (dot chain) with event pointer
  My.Module.Here.func(EVENTS.userSignedUp)

  // Other().module(EVENT_NAME, PROPERTIES, customFieldOne, customFieldTwo)
  Other().module(EVENTS.orderCompleted, [
    KEYS.orderId: ORDER_ID,
    KEYS.total: 99.99,
  ], "cf1", 2)

  // CustomModule.track(userId, EVENT_NAME, PROPERTIES)
  CustomModule.track(USER_ID, "custom_module_event_swift", [
    KEYS.orderId: ORDER_ID,
    "foo": "bar",
  ])

  // getTrackingService().track(EVENT_NAME, PROPERTIES)
  getTrackingService().track("swiftChainedEvent", [
    "foo": "bar",
    "count": 7,
  ])

  // dispatch(customTrackFunction7(EVENT_NAME, PROPERTIES))
  dispatch(customTrackFunction7("InitiatedPaymentSwift", [
    "containerSection": "PaymentPage",
    "tierCartIntent": "Gold",
  ]))

  // Variable-only properties argument
  let paymentArgs: [String: Any] = [
    "containerSection": "Checkout",
    "amount": 99.99,
  ]
  dispatch(customTrackFunction5("FailedPaymentSwift", paymentArgs))

  // No properties custom
  customTrackNoProps("JustEventSwift")

  // Component-like props method invocation
  SwiftExampleComponent().handleView()

  // Nested inside another function scope
  func nested() {
    customTrackFunction6("NestedEventSwift", ["nested": true])
  }
  nested()
}

// MARK: - Entry point-like calls for the fixture

func mainFixture() {
  trackGA_Purchase()
  trackGA_NoProps()
  pushGTM_Basic()
  pushGTM_ViaWindowStyle()
  segment_TrackLiteral()
  segment_TrackConstants()
  segment_TrackNoProps()
  mixpanel_OrderCompleted()
  mixpanel_NoProps()
  amplitude_CheckoutInitiated()
  amplitude_Empty()
  rudder_OrderCompleted()
  rudder_NoProps()
  mparticle_Transaction()
  mparticle_Minimal()
  posthog_UserAction()
  posthog_NoProps()
  pendo_CustomerCheckout()
  pendo_NoProps()
  heap_UserLogin()
  heap_Minimal()

  let mgr = AnalyticsManager()
  mgr.trackCheckoutFlow()
  mgr.trackFromConstants()

  ViewControllerLike().onAppear()

  // Invoke custom tracking examples
  customExamples()
}

// Invoke
mainFixture()
