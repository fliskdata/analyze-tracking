# @flisk/analyze-tracking

Automatically document your analytics setup by analyzing tracking code and generating data schemas from tools like Segment, Amplitude, Mixpanel, and more 🚀

[![NPM version](https://img.shields.io/npm/v/@flisk/analyze-tracking.svg)](https://www.npmjs.com/package/@flisk/analyze-tracking) [![Tests](https://github.com/fliskdata/analyze-tracking/actions/workflows/tests.yml/badge.svg?branch=main)](https://github.com/fliskdata/analyze-tracking/actions/workflows/tests.yml)


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

### Key Options
- `-g, --generateDescription`: Generate descriptions of fields (default: `false`)
- `-p, --provider <provider>`: Specify a provider (options: `openai`, `gemini`)
- `-m, --model <model>`: Specify a model (ex: `gpt-4.1-nano`, `gpt-4o-mini`, `gemini-2.0-flash-lite-001`)
- `-o, --output <output_file>`: Name of the output file (default: `tracking-schema.yaml`)
- `-c, --customFunction <function_signature>`: Specify the signature of your custom tracking function (see [instructions here](#custom-functions))
- `--format <format>`: Output format, either `yaml` (default) or `json`. If an invalid value is provided, the CLI will exit with an error.
- `--stdout`: Print the output to the terminal instead of writing to a file (works with both YAML and JSON)

🔑&nbsp; **Important:** If you are using `generateDescription`, you must set the appropriate credentials for the LLM provider you are using as an environment variable. OpenAI uses `OPENAI_API_KEY` and Google Vertex AI uses `GOOGLE_APPLICATION_CREDENTIALS`.


### Custom Functions

If you have your own in-house tracker or a wrapper function that calls other tracking libraries, you can specify the function signature with the `-c` or `--customFunction` option.

Your function signature should be in the following format:
```js
yourCustomTrackFunctionName(EVENT_NAME, PROPERTIES, customFieldOne, customFieldTwo)
```

- `EVENT_NAME` is the name of the event you are tracking. It should be a string or a pointer to a string. This is required.
- `PROPERTIES` is an object of properties for that event. It should be an object / dictionary. This is optional.
- Any additional parameters are other fields you are tracking. They can be of any type. The names you provide for these parameters will be used as the property names in the output.


For example, if your function has a userId parameter at the beginning, followed by the event name and properties, you would pass in the following:

```js
yourCustomTrackFunctionName(userId, EVENT_NAME, PROPERTIES)
```

If your function follows the standard format `yourCustomTrackFunctionName(EVENT_NAME, PROPERTIES)`, you can simply pass in `yourCustomTrackFunctionName` to `--customFunction` as a shorthand.

You can also pass in multiple custom function signatures by passing in the `--customFunction` option multiple times or by passing in a space-separated list of function signatures.

```sh
npx @flisk/analyze-tracking /path/to/project --customFunction "yourFunc1" --customFunction "yourFunc2(userId, EVENT_NAME, PROPERTIES)"
npx @flisk/analyze-tracking /path/to/project -c "yourFunc1" "yourFunc2(userId, EVENT_NAME, PROPERTIES)"
```


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

| Library | JavaScript/TypeScript | Python | Ruby | Go |
|---------|:---------------------:|:------:|:----:|:--:|
| Google Analytics   | ✅ | ❌ | ❌ | ❌ |
| Google Tag Manager | ✅ | ❌ | ❌ | ❌ |
| Segment            | ✅ | ✅ | ✅ | ✅ |
| Mixpanel           | ✅ | ✅ | ✅ | ✅ |
| Amplitude          | ✅ | ✅ | ❌ | ✅ |
| Rudderstack        | ✅ | ✅ | ✳️ | ✳️ |
| mParticle          | ✅ | ❌ | ❌ | ❌ |
| PostHog            | ✅ | ✅ | ✅ | ✅ |
| Pendo              | ✅ | ❌ | ❌ | ❌ |
| Heap               | ✅ | ❌ | ❌ | ❌ |
| Snowplow           | ✅ | ✅ | ✅ | ✅ |
| Datadog RUM        | ✅ | ❌ | ❌ | ❌ |
| Custom Function    | ✅ | ✅ | ✅ | ✅ |

✳️ Rudderstack's SDKs often use the same format as Segment, so Rudderstack events may be detected as Segment events.


## SDKs for supported libraries

<details>
  <summary>Google Analytics</summary>

  **JavaScript/TypeScript**
  ```js
  gtag('event', '<event_name>', {
    '<property_name>': '<property_value>'
  });
  ```
</details>

<details>
  <summary>Google Tag Manager</summary>

  **JavaScript/TypeScript**
  ```js
  dataLayer.push({
    event: '<event_name>',
    '<property_name>': '<property_value>'
  });

  // Or via window
  window.dataLayer.push({
    event: '<event_name>',
    '<property_name>': '<property_value>'
  });
  ```
</details>

<details>
  <summary>Segment</summary>

  **JavaScript/TypeScript**
  ```js
  analytics.track('<event_name>', {
    '<property_name>': '<property_value>'
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
      '<property_name>': '<property_value>'
    }
  )
  ```

  **Go**
  ```go
  client.Enqueue(analytics.Track{
    UserId: "user-id",
    Event:  "<event_name>",
    Properties: analytics.NewProperties().
      Set("<property_name>", "<property_value>"),
  })
  ```
</details>

<details>
  <summary>Mixpanel</summary>

  **JavaScript/TypeScript**
  ```js
  mixpanel.track('<event_name>', {
    '<property_name>': '<property_value>'
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
  tracker.track('<distinct_id>', '<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```

  **Go**
  ```go
  ctx := context.Background()
  mp := mixpanel.NewApiClient("YOUR_PROJECT_TOKEN")
  mp.Track(ctx, []*mixpanel.Event{
    mp.NewEvent("<event_name>", "", map[string]any{}{
      "<property_name>": "<property_value>",
    }),
  })
  ```
</details>

<details>
  <summary>Amplitude</summary>

  **JavaScript/TypeScript**
  ```js
  amplitude.track('<event_name>', {
    <event_parameters>
  });
  ```

  **Python**
  ```python
  client.track(
    BaseEvent(
      event_type="<event_name>",
      user_id="<user_id>",
      event_properties={
        "<property_name>": "<property_value>",
      },
    )
  )
  ```

  **Go**
  ```go
  client.Track(amplitude.Event{
    UserID:    "<user_id>",
    EventType: "<event_name>",
    EventProperties: map[string]any{}{
      "<property_name>": "<property_value>",
    },
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
  rudder_analytics.track('<event_name>', {
    '<property_name>': '<property_value>'
  })
  ```

  **Ruby**
  ```ruby
  analytics.track(
    user_id: '<user_id>',
    event: '<event_name>',
    properties: {
      '<property_name>': '<property_value>'
    }
  )
  ```

  **Go**
  ```go
  client.Enqueue(analytics.Track{
    UserId: "<user_id>",
    Event:  "<event_name>",
    Properties: analytics.NewProperties().
      Set("<property_name>", "<property_value>"),
  })
  ```
</details>

<details>
  <summary>mParticle</summary>

  **JavaScript/TypeScript**
  ```js
  mParticle.logEvent('<event_name>', mParticle.EventType.<event_type>, {
    '<property_name>': '<property_value>'
  });
  ```
</details>

<details>
  <summary>PostHog</summary>

  **JavaScript/TypeScript**
  ```js
  posthog.capture('<event_name>', {
    '<property_name>': '<property_value>'
  });
  ```

  **Python**
  ```python
  posthog.capture('distinct_id', '<event_name>', {
    '<property_name>': '<property_value>'
  })
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

  **Go**
  ```go
  client.Enqueue(posthog.Capture{
    DistinctId: "<distinct_id>",
    Event:      "<event_name>",
    Properties: posthog.NewProperties().
      Set("<property_name>", "<property_value>"),
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
  <summary>Datadog RUM</summary>

  **JavaScript/TypeScript**
  ```js
  datadogRum.addAction('<event_name>', {
    '<property_name>': '<property_value>'
  });
  
  // Or via window
  window.DD_RUM.addAction('<event_name>', {
    '<property_name>': '<property_value>'
  });

  // Or via global DD_RUM
  DD_RUM.addAction('<event_name>', {
    '<property_name>': '<property_value>'
  });
  ```
</details>

<details>
  <summary>Snowplow (Structured Events)</summary>

  **JavaScript/TypeScript**
  ```js
  tracker.track(buildStructEvent({
    action: '<event_name>',
    category: '<category>',
    label: '<label>',
    property: '<property>',
    value: <value>
  }));
  ```

  **Python**
  ```python
  tracker.track(StructuredEvent(
    action="<event_name>",
    category="<category>",
    label="<label>",
    property_="<property>",
    value=<value>,
  ))
  ```

  **Ruby**
  ```ruby
  tracker.track_struct_event(
    action: '<event_name>',
    category: '<category>',
    label: '<label>',
    property: '<property>',
    value: <value>
  )
  ```

  **Go**
  ```go
  tracker.TrackStructEvent(sp.StructuredEvent{
		Action:   sp.NewString("<event_name>"),
		Category: sp.NewString("<category>"),
		Label:    sp.NewString("<label>"),
		Property: sp.NewString("<property>"),
		Value:    sp.NewFloat64(<value>),
	})
  ```
</details>

## Parsing Swift files with SwiftSyntax via WebAssembly (WASI)

If your project includes Swift code, you can parse it with full-fidelity **SwiftSyntax** instead of brittle regular expressions. Thanks to the official Swift WASI SDK this works completely inside a Node.js environment—no native Swift toolchain is required at runtime.

Below is a minimal, end-to-end recipe you can drop into your build docs or copy-paste into a README. It turns a tiny SwiftSyntax-based CLI into a `.wasm` module and shows how to execute it from JavaScript.

---

### 1. Set up a Swift toolchain that can target WASM

1. Install the latest Swift **development snapshot** *and* the matching **Swift SDK for WASI** (one-liner provided on the [Swift downloads page](https://www.swift.org/download/)).
2. Verify the SDK ID:

   ```sh
   swift sdk list      # e.g. swift-6.2-20250720_wasm
   ```
3. Whenever you build, pass `--swift-sdk <id>` (or `--triple wasm32-unknown-wasi` if you prefer). The [official guide](https://www.swift.org/getting-started) shows the exact commands.

---

### 2. Create a tiny SwiftSyntax wrapper

```sh
mkdir SwiftSyntaxWasm && cd SwiftSyntaxWasm
swift package init --type executable
```

`Package.swift` (only the interesting bits):

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SwiftSyntaxWasm",
  dependencies: [
    .package(url: "https://github.com/apple/swift-syntax.git", from: "602.0.0")
  ],
  targets: [
    .executableTarget(
      name: "SwiftSyntaxWasm",
      dependencies: [
        .product(name: "SwiftParser", package: "swift-syntax")
      ])
  ]
)
```

`Sources/SwiftSyntaxWasm/main.swift`:

```swift
import Foundation
import SwiftParser      // Light-weight entry point
import SwiftSyntax

@main
struct CLI {
  static func main() throws {
    guard CommandLine.arguments.count > 1 else {
      fputs("usage: <tool> file.swift\n", stderr)
      exit(1)
    }
    let url = URL(fileURLWithPath: CommandLine.arguments[1])
    let source = try String(contentsOf: url)
    let tree = Parser.parse(source: source)
    // TODO: Replace with a custom visitor that emits compact JSON.
    print(tree.description)
  }
}
```

---

### 3. Compile to WASM

```sh
swift build -c release --swift-sdk swift-6.2-20250720_wasm
# result: .build/wasm32-unknown-wasi/release/SwiftSyntaxWasm.wasm
```

The binary will be large (15-25 MB). If size matters, rebuild with the *Embedded Swift* SDK variant or post-process with `wasm-opt -Oz`.

---

### 4. Call the module from Node

Add a tiny launcher—`runner.js`:

```js
import { readFile } from "node:fs/promises";
import { WASI } from "node:wasi";
import { argv, env } from "node:process";

const wasi = new WASI({
  args: ["SwiftSyntaxWasm.wasm", argv[2]],   // pass path to .swift file
  env,
  preopens: { "/": process.cwd() }           // expose CWD to WASI FS
});

const wasmBytes = await readFile("./SwiftSyntaxWasm.wasm");
const module = await WebAssembly.compile(wasmBytes);
const instance = await WebAssembly.instantiate(module, wasi.getImportObject());

wasi.start(instance);                         // prints AST (or your JSON) to stdout
```

Run it:

```sh
node runner.js ./Example.swift > ast.json
```

---

### 5. Consume from your NPM package

Wrap the call above in a helper (e.g. `parseSwift(sourcePath)`), capture `stdout`, and feed the JSON into your existing JS analysis pipeline—exactly like we already do with Pyodide or the Ruby/Python/Go WASM binaries.

---

#### Why this works
* **SwiftSyntax** itself is pure Swift → the Swift WASI SDK compiles it without native Apple frameworks.
* **WASI** provides a portable POSIX-ish layer, so the wasm module runs unchanged on Node, Wasmer, or Wasmtime.
* The approach keeps Swift-side parsing isolated and lets your JS orchestrate everything else.

> **TL;DR** Install the Swift WASI SDK, write a ~30-line SwiftSyntax CLI, `swift build --swift-sdk …`, then load the resulting `.wasm` through Node’s `wasi` API and capture its output.


## Contribute
We're actively improving this package. Found a bug? Have a feature request? Open an issue or submit a pull request!

[![Slack](https://img.shields.io/badge/Join%20Us%20on%20Slack-Flisk%20Community-611f69.svg?logo=slack)](https://join.slack.com/t/fliskcommunity/shared_invite/zt-354hesfnm-BbNzveERo9C4JwVQEWvXoA)
