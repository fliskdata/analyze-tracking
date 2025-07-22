import Foundation
import Analytics  // Segment
import Mixpanel
import Amplitude
import PostHog
import MParticle_Apple_SDK

// Custom tracking function for testing
func customTrackFunction(userId: String, eventName: String, properties: [String: Any]) {
    print("Custom track: \(userId) - \(eventName) - \(properties)")
}

// Additional custom function variants for testing
func customTrackFunction0(eventName: String, properties: [String: Any]) {}
func customTrackFunction1(eventName: String, properties: [String: Any]) {}
func customTrackFunction2(userId: String, eventName: String, properties: [String: Any]) {}
func customTrackFunction3(eventName: String, properties: [String: Any], userEmail: String) {}
func customTrackFunction4(userId: String, eventName: String, userAddress: [String: Any], properties: [String: Any], userEmail: String) {}

class TrackingManager {
    
    // MARK: - Segment Analytics
    func trackSegmentEvent() {
        Analytics.shared().track("User Signed Up", properties: [
            "plan": "Enterprise",
            "is_free_trial": true,
            "user_id": "user123"
        ])
    }
    
    // MARK: - Mixpanel Analytics
    func trackMixpanelEvent() {
        Mixpanel.mainInstance().track(event: "Purchase_Completed", properties: [
            "product": "Premium Plan",
            "price": 29.99,
            "currency": "USD",
            "is_first_purchase": false
        ])
    }
    
    // MARK: - Amplitude Analytics (new SDK)
    func trackAmplitudeEvent() {
        let amplitude = Amplitude(configuration: Configuration(apiKey: "YOUR_API_KEY"))
        amplitude.track(eventType: "Button_Clicked", eventProperties: [
            "button_name": "Checkout",
            "screen": "Product Page",
            "user_tier": "premium"
        ])
    }
    
    // MARK: - RudderStack Analytics
    func trackRudderStackEvent() {
        RSClient.sharedInstance()?.track("Page_Viewed", properties: [
            "page_name": "Home",
            "category": "main",
            "user_agent": "iOS App"
        ])
    }
    
    // MARK: - mParticle Analytics
    func trackMParticleEvent() {
        MParticle.sharedInstance().logEvent("Product_Added_To_Cart",
                                           eventType: .commerce,
                                           eventInfo: [
                                               "product_id": "12345",
                                               "product_name": "Widget",
                                               "quantity": 2,
                                               "price": 15.99
                                           ])
    }
    
    // MARK: - PostHog Analytics
    func trackPostHogEvent() {
        PostHogSDK.shared.capture("Feature_Used", properties: [
            "feature_name": "Dark Mode",
            "enabled": true,
            "user_preference": "automatic"
        ])
    }
    
    // MARK: - Pendo Analytics
    func trackPendoEvent() {
        PendoManager.shared().track("Guide_Completed", properties: [
            "guide_id": "onboarding_flow",
            "completion_time": 120,
            "success": true
        ])
    }
    
    // MARK: - Heap Analytics
    func trackHeapEvent() {
        Heap.shared.track("User_Engagement", properties: [
            "session_duration": 300,
            "pages_viewed": 5,
            "actions_taken": 12
        ])
    }
    
    // MARK: - Snowplow Analytics
    func trackSnowplowEvent() {
        let event = Structured(category: "User Actions",
                              action: "Button_Click",
                              label: "Main CTA",
                              property: "Homepage",
                              value: 1)
        tracker.track(event)
    }
    
    // MARK: - Firebase Analytics (Google Analytics & GTM for iOS)
    func trackFirebaseEvent() {
        Analytics.logEvent("user_purchase", parameters: [
            "item_id": "SKU123",
            "item_name": "Premium Subscription",
            "item_category": "subscription",
            "quantity": 1,
            "price": 9.99,
            "currency": "USD"
        ])
    }
    
    // MARK: - Variable-based tracking
    func trackWithVariables() {
        let eventName = "Dynamic_Event"
        let userTier = "gold"
        let isActive = true
        let itemCount = 42
        let userMetadata = [
            "registration_date": "2023-01-15",
            "preferred_language": "en"
        ]
        
        Analytics.shared().track(eventName, properties: [
            "user_tier": userTier,
            "is_active": isActive,
            "item_count": itemCount,
            "metadata": userMetadata
        ])
    }
    
    // MARK: - Custom function usage
    func useCustomTracking() {
        let baz = 42
        let test = "test_value"
        let list = ["a", "b", "c"]
        let obj = [
            "a": 1,
            "b": 2,
            "c": test
        ] as [String : Any]
        
        customTrackFunction(userId: "user888", eventName: "custom_event", properties: [
            "foo": "bar",
            "baz": baz,
            "list": list,
            "obj": obj
        ])
        
        // Test additional custom function variants
        customTrackFunction0(eventName: "custom_event0", properties: ["foo": "bar"])
        customTrackFunction1(eventName: "custom_event1", properties: ["foo": "bar"])
        customTrackFunction2(userId: "user101", eventName: "custom_event2", properties: ["foo": "bar"])
        customTrackFunction3(eventName: "custom_event3", properties: ["foo": "bar"], userEmail: "user@example.com")
        customTrackFunction4(userId: "user202", eventName: "custom_event4", userAddress: ["city": "San Francisco"], properties: ["foo": "bar"], userEmail: "user@example.com")
    }
    
    // MARK: - Edge cases and complex scenarios
    func trackComplexScenarios() {
        // Nested method calls
        Analytics.shared().track("Nested_Call", properties: [
            "computed_value": calculateValue(),
            "timestamp": Date().timeIntervalSince1970
        ])
        
        // Conditional tracking
        if shouldTrackEvent() {
            Mixpanel.mainInstance().track(event: "Conditional_Event", properties: [
                "condition_met": true
            ])
        }
        
        // Property spreading
        let baseProperties = ["source": "ios_app", "version": "1.2.3"]
        var extendedProperties = baseProperties
        extendedProperties["user_action"] = "tap"
        
        PostHogSDK.shared.capture("Extended_Properties", properties: extendedProperties)
    }
    
    private func calculateValue() -> Int {
        return 100
    }
    
    private func shouldTrackEvent() -> Bool {
        return true
    }
}