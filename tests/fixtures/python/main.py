from typing import Any, Dict, List

# Stub imports for external analytics SDKs so linters/type checkers don't complain.
# They are not actually executed in tests.
try:
    import segment  # type: ignore
    import mixpanel  # type: ignore
    import amplitude  # type: ignore
    import posthog  # type: ignore
    import rudderstack  # type: ignore
    import snowplow_tracker  # type: ignore
except ImportError:  # pragma: no cover
    import sys
    from types import ModuleType

    _stub_modules: List[str] = [
        'segment',
        'segment.analytics',
        'mixpanel',
        'amplitude',
        'amplitude.Amplitude',
        'amplitude.BaseEvent',
        'posthog',
        'rudderstack',
        'rudderstack.analytics',
        'snowplow_tracker',
    ]

    def _ensure_module(name: str) -> ModuleType:  # type: ignore[return-value]
        """Return existing or newly created stub module (supports dotted names)."""
        if name in sys.modules:
            return sys.modules[name]
        if '.' in name:
            parent_name, _, child = name.partition('.')
            parent = _ensure_module(parent_name)
            mod = ModuleType(name)
            setattr(parent, child, mod)  # type: ignore[attr-defined]
            sys.modules[name] = mod
            return mod
        mod = ModuleType(name)
        sys.modules[name] = mod
        return mod

    for _mod_name in _stub_modules:
        _ensure_module(_mod_name)

    # Add minimal class stubs used in tests
    amplitude_mod = sys.modules['amplitude']
    if not hasattr(amplitude_mod, 'Amplitude'):
        class Amplitude:  # type: ignore[too-many-instance-attributes]
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                pass
            def track(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401
                pass
        class BaseEvent:  # type: ignore[too-many-instance-attributes]
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                pass

        amplitude_mod.Amplitude = Amplitude  # type: ignore[attr-defined]
        amplitude_mod.BaseEvent = BaseEvent  # type: ignore[attr-defined]

    posthog_mod = sys.modules['posthog']
    if not hasattr(posthog_mod, 'Posthog'):
        class Posthog:  # type: ignore[too-many-instance-attributes]
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                pass
            def capture(self, *args: Any, **kwargs: Any) -> None:  # noqa: D401
                pass

        posthog_mod.Posthog = Posthog  # type: ignore[attr-defined]

# Custom tracking function stub
def customTrackFunction(user_id: str, event_name: str, params: Dict[str, Any]) -> None:
    print(f"Custom track: {user_id} - {event_name} - {params}")

# Segment tracking example
def segment_track(user_id: str, plan: str) -> None:
    import segment.analytics as analytics
    analytics.write_key = 'YOUR_WRITE_KEY'
    analytics.track(user_id, "User Signed Up", {
        "method": "email",
        "is_free_trial": True,
        "plan": plan,
    })

# Mixpanel tracking example
def mixpanel_track(distinct_id: str, price: float, items: List[str]) -> None:
    from mixpanel import Mixpanel
    mp = Mixpanel('YOUR_PROJECT_TOKEN')
    mp.track(distinct_id, 'Purchase Completed', {
        'plan': 'premium',
        'price': price,
        'items': items,
    })

# Amplitude tracking example
def amplitude_track(user_id: str, size: int) -> None:
    from amplitude import Amplitude, BaseEvent
    client = Amplitude('YOUR_API_KEY')
    client.track(
        BaseEvent(
            event_type="Button Clicked",
            user_id=user_id,
            event_properties={
                "color": "red",
                "size": size,
            },
        )
    )

# Rudderstack tracking example
def rudderstack_track(user_id: str, os: str, version: int) -> None:
    import rudderstack.analytics as rudder_analytics
    rudder_analytics.write_key = 'YOUR_WRITE_KEY'
    rudder_analytics.dataPlaneUrl = 'YOUR_DATA_PLANE_URL'
    rudder_analytics.track(user_id, 'User Logged In', {
        'timestamp': 1625247600,
        'os': os,
        'version': version,
    })

# PostHog tracking example
def posthog_capture(distinct_id: str, method: str, is_free_trial: bool, plan: str) -> None:
    from posthog import Posthog
    posthog = Posthog('YOUR_PROJECT_API_KEY', host='https://us.i.posthog.com')
    # positional args
    posthog.capture(distinct_id, "user_signed_up", {
        "method": method,
        "is_free_trial": is_free_trial,
        "plan": plan,
    })
    # keyword args
    posthog.capture(distinct_id, event="user_cancelled_subscription", properties={
        "method": method,
        "is_free_trial": is_free_trial,
        "plan": plan,
    })

# Snowplow tracking examples
def snowplow_track_events(category: str, value: float) -> None:
    from snowplow_tracker import Snowplow, StructuredEvent
    tracker = Snowplow.create_tracker(namespace='ns', endpoint='collector.example.com')
    tracker.track(StructuredEvent(
        action="add-to-basket",
        category=category,
        label="web-shop",
        property_="pcs",
        value=value,
    ))

def main() -> None:
    segment_track("user123", plan="Pro")
    mixpanel_track("user123", 9.99, ["apple", "banana"])
    amplitude_track("user123", 12)
    rudderstack_track("user123", "iOS", 14)
    posthog_capture("user123", "email", True, "premium")
    snowplow_track_events("shop", 2)
    customTrackFunction("user999", "custom_event", {"key": "value", "nested": {"a": [1,2,3]}})

    # Additional custom tracking function variant calls for testing
    customTrackFunction0("custom_event0", {"foo": "bar"})
    customTrackFunction1("custom_event1", {"foo": "bar"})
    customTrackFunction2("user101", "custom_event2", {"foo": "bar"})
    customTrackFunction3("custom_event3", {"foo": "bar"}, "user@example.com")
    customTrackFunction4("user202", "custom_event4", {"city": "San Francisco"}, {"foo": "bar"}, "user@example.com")

    # Dot-separated custom tracking function (module-style)
    class CustomModule:
        @staticmethod
        def track(user_id: str, event_name: str, params: Dict[str, Any]) -> None:  # type: ignore[return-value]
            print("CustomModule.track", user_id, event_name, params)

    CustomModule.track("user444", "custom_module_event", {
        "order_id": "order_xyz",
        "foo": "bar"
    })

# Stub variant definitions to satisfy linters (not executed)

def customTrackFunction0(event_name: str, params: Dict[str, Any]) -> None: ...

def customTrackFunction1(event_name: str, params: Dict[str, Any]) -> None: ...

def customTrackFunction2(user_id: str, event_name: str, params: Dict[str, Any]) -> None: ...

def customTrackFunction3(event_name: str, params: Dict[str, Any], user_email: str) -> None: ...

def customTrackFunction4(user_id: str, event_name: str, user_address: Dict[str, Any], params: Dict[str, Any], user_email: str) -> None: ...
