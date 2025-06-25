package main

import (
	"context"
	"log"

	"github.com/amplitude/analytics-go/amplitude"
	"github.com/mixpanel/mixpanel-go"
	"github.com/posthog/posthog-go"
	"github.com/segmentio/analytics-go/v3"
	sp "github.com/snowplow/snowplow-golang-tracker/tracker"
)

// Custom tracking function for your own hooks
func customTrackFunction(userId string, eventName string, params map[string]any) {
	log.Printf("Custom track: %s - %s - %+v\n", userId, eventName, params)
}

// Stub custom tracking variants for tests
func customTrackFunction0(eventName string, params map[string]any)                   {}
func customTrackFunction1(eventName string, params map[string]any)                   {}
func customTrackFunction2(userId string, eventName string, params map[string]any)    {}
func customTrackFunction3(eventName string, params map[string]any, userEmail string) {}
func customTrackFunction4(userId string, eventName string, userAddress map[string]any, params map[string]any, userEmail string) {
}

func segmentTrack(userId string) {
	client := analytics.New("YOUR_SEGMENT_WRITE_KEY")
	client.Enqueue(analytics.Track{
		UserId: userId,
		Event:  "Signed Up",
		Properties: analytics.NewProperties().
			Set("plan", "Enterprise").
			Set("is_free_trial", true),
	})
}

func mixpanelTrack(userId string, price float64) {
	mp := mixpanel.NewApiClient("YOUR_MIXPANEL_TOKEN")
	ctx := context.Background()
	mp.Track(ctx, []*mixpanel.Event{
		mp.NewEvent("some_event", userId, map[string]any{
			"plan":  "premium",
			"price": price,
		}),
	})
}

func amplitudeTrack(isFreeTrial bool) {
	config := amplitude.NewConfig("YOUR_AMPLITUDE_API_KEY")
	client := amplitude.NewClient(config)
	client.Track(amplitude.Event{
		UserID:    "user-id",
		EventType: "Button Clicked",
		EventProperties: map[string]any{
			"name":          "Checkout",
			"a property":    "a value",
			"is_free_trial": isFreeTrial,
		},
		EventOptions: amplitude.EventOptions{
			Price: 1.99,
		},
	})
}

func posthogTrack(plan string, isFreeTrial bool) {
	client, err := posthog.NewWithConfig("YOUR_POSTHOG_API_KEY", posthog.Config{})
	if err != nil {
		log.Fatalf("PostHog init error: %v", err)
	}
	defer client.Close()
	client.Enqueue(posthog.Capture{
		DistinctId: "distinct_id_of_the_user",
		Event:      "user_signed_up",
		Properties: posthog.NewProperties().
			Set("login_type", "email").
			Set("plan", plan).
			Set("is_free_trial", isFreeTrial),
	})
}

func snowplowTrack(property string, value float64) {
	emitter := sp.InitEmitter(
		sp.RequireCollectorUri("collector.example.com"),
	)
	tracker := sp.InitTracker(
		sp.RequireEmitter(emitter),
	)
	tracker.TrackStructEvent(sp.StructuredEvent{
		Action:   sp.NewString("add-to-basket"),
		Category: sp.NewString("test"),
		Property: sp.NewString(property),
		Value:    sp.NewFloat64(value),
	})
}

func main() {
	segmentTrack("f4ca124298")
	mixpanelTrack("f4ca124298", 1.99)
	amplitudeTrack(false)
	posthogTrack("Enterprise", false)
	snowplowTrack("pcs", 2)

	// Custom function usage
	var baz int = 42
	var test string = "test"
	var list []string = []string{"a", "b", "c"}
	var obj map[string]any = map[string]any{
		"a": 1,
		"b": 2,
		"c": test,
	}
	customTrackFunction("user888", "custom_event", map[string]any{
		"foo":  "bar",
		"baz":  baz,
		"list": list,
		"obj":  obj,
	})

	// Calls for additional custom tracking variants
	customTrackFunction0("custom_event0", map[string]any{"foo": "bar"})
	customTrackFunction1("custom_event1", map[string]any{"foo": "bar"})
	customTrackFunction2("user101", "custom_event2", map[string]any{"foo": "bar"})
	customTrackFunction3("custom_event3", map[string]any{"foo": "bar"}, "user@example.com")
	customTrackFunction4("user202", "custom_event4", map[string]any{"city": "San Francisco"}, map[string]any{"foo": "bar"}, "user@example.com")
}
