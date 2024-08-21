# @flisk/analyze-tracking

Analyzes tracking code in a project and generates data schemas

[![NPM version](https://img.shields.io/npm/v/@flisk/analyze-tracking.svg)](https://www.npmjs.com/package/@flisk/analyze-tracking)


## Usage
```sh
npx @flisk/analyze-tracking /path/to/project [options]
```

Optional arguments:
- `--repository <repository_url>`: URL of the repository where the code is hosted (defaults to git remote origin in project directory)
- `--output <output_file>`: Name of the output file (default: `tracking-schema.yaml`)


## Output Schema
A YAML file with the following structure is generated:

```yaml
version: 1.0
events:
  <event_name>:
    sources:
      - repository: <repository_name>
        path: <path_to_file>
        line: <line_number>
        function: <function_name>
    destinations:
      - <destination_name>
    properties:
      <property_name>:
        type: <property_type>
        required: <property_required>
        description: <property_description>
```

See [schema.json](schema.json) for the output schema.


## Supported tracking libraries

#### Google Analytics
```js
gtag('event', '<event_name>', {
  <event_parameters>
});
```


#### Segment
```js
analytics.track('<event_name>', {
  <event_parameters>
});
```


#### Mixpanel
```js
mixpanel.track('<event_name>', {
  <event_parameters>
});
```


#### Amplitude
```js
amplitude.logEvent('<event_name>', {
  <event_parameters>
});
```


#### Rudderstack
```js
rudderanalytics.track('<event_name>', {
  <event_parameters>
});
```


#### mParticle
```js
mParticle.logEvent('<event_name>', {
  <event_parameters>
});
```


#### Snowplow
```js
snowplow('trackStructEvent', {
  category: '<category>',
  action: '<action>',
  label: '<label>',
  property: '<property>',
  value: '<value> '
});
```

```js
trackStructEvent({
  category: '<category>',
  action: '<action>',
  label: '<label>',
  property: '<property>',
  value: '<value>'
});
```

```js
buildStructEvent({
  category: '<category>',
  action: '<action>',
  label: '<label>',
  property: '<property>',
  value: '<value>'
});
```

_Note: Snowplow Self Describing Events are not supported yet._
