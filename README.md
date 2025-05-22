# @flisk/analyze-tracking

Automatically document your analytics setup by analyzing tracking code and generating data schemas from tools like Segment, Amplitude, Mixpanel, and more 🚀.

[![NPM version](https://img.shields.io/npm/v/@flisk/analyze-tracking.svg)](https://www.npmjs.com/package/@flisk/analyze-tracking)


## Why Use @flisk/analyze-tracking?
📊 **Understand Your Tracking** – Effortlessly analyze your codebase for `track` calls so you can see all your analytics events, properties, and triggers in one place. No more guessing what's being tracked!

🔍 **Auto-Document Events** – Generates a complete YAML schema that captures all events and properties, including where they're implemented in your codebase.

🕵️‍♂️ **Track Changes Over Time** – Easily spot unintended changes or ensure your analytics setup remains consistent across updates.

📚 **Populate Data Catalogs** – Automatically generate structured documentation that can help feed into your data catalog, making it easier for everyone to understand your events.


## Quick Start

Run without installation! Just use:

```sh
npx @flisk/analyze-tracking /path/to/project [options]
```

### Key Options:
- `-g, --generateDescription`: Generate descriptions of fields (default: `false`)
- `-p, --provider <provider>`: Specify a provider (options: `openai`, `gemini`)
- `-m, --model <model>`: Specify a model (ex: `gpt-4.1-nano`, `gpt-4o-mini`, `gemini-2.0-flash-lite-001`)
- `-o, --output <output_file>`: Name of the output file (default: `tracking-schema.yaml`)
- `-c, --customFunction <function_name>`: Specify a custom tracking function

🔑&nbsp; **Important:** If you are using `generateDescription`, you must set the appropriate credentials for the provider you are using as an environment variable. OpenAI uses `OPENAI_API_KEY` and Google Vertex AI uses `GOOGLE_APPLICATION_CREDENTIALS`.

<details>
  <summary>Note on Custom Functions 💡</summary>

  Use this if you have your own in-house tracker or a wrapper function that calls other tracking libraries.

  We currently only support functions that follow the following format:
  ```js
  yourCustomTrackFunctionName('<event_name>', {
    <event_parameters>
  });
  ```
</details>


## What's Generated?
A clear YAML schema that shows where your events are tracked, their properties, and more.
Here's an example:

```yaml
version: 1
source:
  repository: <repository_url>
  commit: <commit_sha>
  timestamp: <commit_timestamp>
events:
  <event_name>:
    description: <ai_generated_description>
    implementations:
      - description: <ai_generated_description>
        path: <path_to_file>
        line: <line_number>
        function: <function_name>
        destination: <platform_name>
    properties:
      <property_name>:
        description: <ai_generated_description>
        type: <property_type>
```

Use this to understand where your events live in the code and how they're being tracked.

Your LLM of choice is used for generating descriptions of events, properties, and implementations.

See [schema.json](schema.json) for a JSON Schema of the output.


## Supported tracking libraries & languages

| Library | JavaScript/TypeScript | Python | Ruby |
|---------|:---------------------:|:------:|:----:|
| Google Analytics | ✅ | ❌ | ❌ |
| Segment | ✅ | ✅ | ✅ |
| Mixpanel | ✅ | ✅ | ✅ |
| Amplitude | ✅ | ✅ | ❌ |
| Rudderstack | ✅ | ✅ | ❌ |
| mParticle | ✅ | ✅ | ❌ |
| PostHog | ✅ | ✅ | ✅ |
| Pendo | ✅ | ✅ | ❌ |
| Heap | ✅ | ✅ | ❌ |
| Snowplow | ✅ | ✅ | ✅ |
| Custom Function | ✅ | ✅ | ✅ |


## SDKs for supported libraries

<details>
  <summary>Google Analytics</summary>

  **JavaScript/TypeScript**
  ```js
  gtag('event', '<event_name>', {
    <event_parameters>
  });
  ```
</details>

<details>
  <summary>Segment</summary>

  **JavaScript/TypeScript**
  ```js
  analytics.track('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  analytics.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```

  **Ruby**
  ```ruby
  Analytics.track(
    event: '<event_name>',
    properties: {
      <event_parameters>
    }
  )
  ```
</details>

<details>
  <summary>Mixpanel</summary>

  **JavaScript/TypeScript**
  ```js
  mixpanel.track('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  mixpanel.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```

  **Ruby**
  ```ruby
  tracker.track('distinct_id', '<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```
</details>

<details>
  <summary>Amplitude</summary>

  **JavaScript/TypeScript**
  ```js
  amplitude.logEvent('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  amplitude.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```
</details>

<details>
  <summary>Rudderstack</summary>

  **JavaScript/TypeScript**
  ```js
  rudderanalytics.track('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  rudderanalytics.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```
</details>

<details>
  <summary>mParticle</summary>

  **JavaScript/TypeScript**
  ```js
  mParticle.logEvent('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  mParticle.logEvent('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```
</details>

<details>
  <summary>PostHog</summary>

  **JavaScript/TypeScript**
  ```js
  posthog.capture('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  posthog.capture(
    'distinct_id',
    '<event_name>',
    {
      '<property_name>': '<property_value>'
    }
  )
  # Or
  posthog.capture(
    'distinct_id',
    event='<event_name>',
    properties={
      '<property_name>': '<property_value>'
    }
  )
  ```

  **Ruby**
  ```ruby
  posthog.capture({
    distinct_id: '<distinct_id>',
    event: '<event_name>',
    properties: {
      '<property_name>': '<property_value>'
    }
  })
  ```
</details>

<details>
  <summary>Pendo</summary>

  **JavaScript/TypeScript**
  ```js
  pendo.track('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  pendo.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```
</details>

<details>
  <summary>Heap</summary>

  **JavaScript/TypeScript**
  ```js
  heap.track('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  heap.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```
</details>

<details>
  <summary>Snowplow (struct events)</summary>

  **JavaScript/TypeScript**
  ```js
  snowplow('trackStructEvent', {
    category: '<category>',
    action: '<action>',
    label: '<label>',
    property: '<property>',
    value: '<value>'
  });
  ```

  **Python**
  ```python
  # Direct tracking
  trackStructEvent({
    'category': '<category>',
    'action': '<action>',
    'label': '<label>',
    'property': '<property>',
    'value': '<value>'
  })
  
  # Builder pattern
  buildStructEvent({
    'category': '<category>',
    'action': '<action>',
    'label': '<label>',
    'property': '<property>',
    'value': '<value>'
  })
  
  # Function call pattern
  snowplow('trackStructEvent', {
    'category': '<category>',
    'action': '<action>',
    'label': '<label>',
    'property': '<property>',
    'value': '<value>'
  })
  ```

  **Ruby**
  ```ruby
  tracker.track_struct_event(
    category: '<category>',
    action: '<action>',
    label: '<label>',
    property: '<property>',
    value: '<value>'
  )
  ```

  _Note: Snowplow Self Describing Events are coming soon!_
</details>


## Contribute
We're actively improving this package. Found a bug? Want to request a feature? Open an issue or contribute directly!
