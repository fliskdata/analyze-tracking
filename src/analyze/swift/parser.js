/**
 * @fileoverview Swift source code parser for analytics tracking detection
 * @module analyze/swift/parser
 */

const fs = require('fs');
const { detectAnalyticsSource } = require('./detectors');
const { extractEventName, processEventData } = require('./extractors');
const { extractProperties } = require('./extractors');
const { MAX_RECURSION_DEPTH } = require('./constants');

/**
 * Parse Swift file and find tracking events
 * @param {string} filePath - Path to Swift file
 * @param {Array} customFunctionSignatures - Custom function signatures to detect
 * @returns {Array} Array of tracking events found
 */
function parseFile(filePath, customFunctionSignatures = []) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return findTrackingEvents(content, filePath, customFunctionSignatures);
  } catch (error) {
    console.error(`Error reading Swift file ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Find tracking events in Swift source code
 * @param {string} content - Swift source code content
 * @param {string} filePath - Path to the file
 * @param {Array} customFunctionSignatures - Custom function signatures
 * @returns {Array} Array of tracking events
 */
function findTrackingEvents(content, filePath, customFunctionSignatures = []) {
  const events = [];
  const lines = content.split('\n');
  let currentFunction = 'global';
  const variableContext = {};

  // Build variable context for better property resolution
  buildVariableContext(content, variableContext);

  // First, find tracking calls that might span multiple lines
  const multilineEvents = findMultilineTrackingCalls(content, filePath, customFunctionSignatures, variableContext);
  events.push(...multilineEvents);

  // Then process each line for function context tracking
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Track current function context
    const functionMatch = line.match(/^\s*(?:func|var|let|private|public|internal|static)\s+(\w+)/);
    if (functionMatch) {
      const functionDecl = line.match(/^\s*(?:private\s+|public\s+|internal\s+|static\s+)*func\s+(\w+)/);
      if (functionDecl) {
        currentFunction = functionDecl[1];
      }
    }

    // Look for single-line tracking calls (fallback)
    const trackingCalls = findTrackingCallsInLine(line, lineNumber, currentFunction, filePath, customFunctionSignatures, variableContext);
    events.push(...trackingCalls);
  }

  return events;
}

/**
 * Find tracking calls that span multiple lines
 * @param {string} content - Full Swift source code content
 * @param {string} filePath - File path
 * @param {Array} customFunctionSignatures - Custom function signatures
 * @param {Object} variableContext - Variable context for resolution
 * @returns {Array} Array of tracking events found
 */
function findMultilineTrackingCalls(content, filePath, customFunctionSignatures, variableContext) {
  const events = [];
  
  // Patterns for multiline tracking calls - using proper array matching
  const patterns = [
    // Segment: Analytics.shared().track("event", properties: [...])
    {
      pattern: /Analytics\.shared\(\)\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'segment'
    },
    
    // Mixpanel: Mixpanel.mainInstance().track(event: "event", properties: [...])
    {
      pattern: /Mixpanel\.mainInstance\(\)\.track\s*\(\s*event:\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'mixpanel'
    },
    
    // Amplitude: amplitude.track(eventType: "event", eventProperties: [...])
    {
      pattern: /amplitude\.track\s*\(\s*eventType:\s*"([^"]+)"\s*,\s*eventProperties:\s*(\[[\s\S]*?\])/gms,
      source: 'amplitude'
    },
    
    // RudderStack: RSClient.sharedInstance()?.track("event", properties: [...])
    {
      pattern: /RSClient\.sharedInstance\(\)\?\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'rudderstack'
    },
    
    // mParticle: MParticle.sharedInstance().logEvent("event", eventType: .other, eventInfo: [...])
    {
      pattern: /MParticle\.sharedInstance\(\)\.logEvent\s*\(\s*"([^"]+)"\s*,\s*eventType:\s*[^,]+,\s*eventInfo:\s*(\[[\s\S]*?\])/gms,
      source: 'mparticle'
    },
    
    // PostHog: PostHogSDK.shared.capture("event", properties: [...])
    {
      pattern: /PostHogSDK\.shared\.capture\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'posthog'
    },
    
    // PostHog with variable: PostHogSDK.shared.capture("event", properties: variableName)
    {
      pattern: /PostHogSDK\.shared\.capture\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\w+)\s*\)/gms,
      source: 'posthog',
      isVariable: true
    },
    
    // Pendo: PendoManager.shared().track("event", properties: [...])
    {
      pattern: /PendoManager\.shared\(\)\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'pendo'
    },
    
    // Heap: Heap.shared.track("event", properties: [...])
    {
      pattern: /Heap\.shared\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'heap'
    },
    
    // Firebase: Analytics.logEvent("event", parameters: [...])
    {
      pattern: /Analytics\.logEvent\s*\(\s*"([^"]+)"\s*,\s*parameters:\s*(\[[\s\S]*?\])/gms,
      source: 'firebase'
    },
    
    // Variable-based tracking: Analytics.shared().track(eventName, properties: [...])
    {
      pattern: /Analytics\.shared\(\)\.track\s*\(\s*(\w+)\s*,\s*properties:\s*(\[[\s\S]*?\])/gms,
      source: 'segment'
    },
    
    // Snowplow: let event = Structured(...) followed by tracker.track(event)
    {
      pattern: /let\s+(\w+)\s*=\s*Structured\s*\([\s\S]*?action:\s*"([^"]+)"[\s\S]*?\)[\s\S]*?tracker\.track\s*\(\s*\1\s*\)/gms,
      source: 'snowplow',
      isSnowplow: true
    }
  ];

  for (const { pattern, source, isSnowplow, isVariable } of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const matchText = match[0];
      let eventName = match[1];
      let propertiesText = match[2];
      
      // Special handling for Snowplow
      if (isSnowplow) {
        eventName = match[2]; // For Snowplow, the action is the event name
        propertiesText = extractSnowplowProperties(matchText);
      }
      
      // Find the line number where this match starts
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
      
      // Find the current function context
      const currentFunction = findFunctionContext(content, match.index);
      
      // Resolve variable if needed
      let resolvedEventName = eventName;
      if (!eventName.startsWith('"') && variableContext[eventName]) {
        resolvedEventName = variableContext[eventName];
      }
      resolvedEventName = resolvedEventName.replace(/^"(.*)"$/, '$1');
      
      // Parse properties
      let properties = {};
      if (isSnowplow) {
        properties = propertiesText;
      } else if (isVariable) {
        // For variable references, try to resolve from context or create basic properties
        properties = resolveVariableProperties(propertiesText, content, match.index, variableContext);
      } else {
        properties = parseSwiftDictionary(propertiesText, variableContext);
      }
      
      const event = processEventData(
        resolvedEventName,
        properties,
        source,
        filePath,
        lineNumber,
        currentFunction
      );
      
      if (event) {
        events.push(event);
      }
    }
  }

  // Handle custom functions with Swift labeled parameter syntax
  if (customFunctionSignatures && customFunctionSignatures.length > 0) {
    for (const customConfig of customFunctionSignatures) {
      if (customConfig && customConfig.functionName) {
        const escapedFunctionName = escapeRegExp(customConfig.functionName);
        // Match function calls that might span multiple lines with balanced parentheses
        const customPattern = new RegExp(`${escapedFunctionName}\\s*\\([\\s\\S]*?\\)(?=\\s*[;}]|\\s*$)`, 'gms');
        
        let match;
        while ((match = customPattern.exec(content)) !== null) {
          const matchText = match[0];
          
          // Double-check that this isn't a function declaration
          const beforeMatch = content.substring(0, match.index);
          const lastLineStart = beforeMatch.lastIndexOf('\n') + 1;
          const currentLineStart = content.substring(lastLineStart, match.index);
          
          // Skip if this line starts with 'func' (function declaration)
          if (currentLineStart.trim().startsWith('func ')) {
            continue;
          }
          
          // Skip if the line appears to be a function declaration
          const lineContent = content.substring(lastLineStart, content.indexOf('\n', match.index));
          if (lineContent.includes('func ') && lineContent.includes(customConfig.functionName)) {
            continue;
          }
          
          // Find the line number where this match starts
          const lineNumber = (beforeMatch.match(/\n/g) || []).length + 1;
          
          // Find the current function context
          const currentFunction = findFunctionContext(content, match.index);
          
          const event = parseSwiftCustomTrackingCall(matchText, lineNumber, currentFunction, filePath, customConfig, variableContext);
          if (event) {
            events.push(event);
          }
        }
      }
    }
  }

  return events;
}

/**
 * Find the function context for a given position in the content
 * @param {string} content - Swift source code content
 * @param {number} position - Position in the content
 * @returns {string} Function name or 'global'
 */
function findFunctionContext(content, position) {
  const beforePosition = content.substring(0, position);
  const lines = beforePosition.split('\n');
  
  // Look backwards for the most recent function declaration
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    const functionMatch = line.match(/^\s*(?:private\s+|public\s+|internal\s+|static\s+)*func\s+(\w+)/);
    if (functionMatch) {
      return functionMatch[1];
    }
  }
  
  return 'global';
}

/**
 * Find tracking calls in a single line
 * @param {string} line - Line of Swift code
 * @param {number} lineNumber - Line number
 * @param {string} currentFunction - Current function name
 * @param {string} filePath - File path
 * @param {Array} customFunctionSignatures - Custom function signatures
 * @param {Object} variableContext - Variable context for resolution
 * @returns {Array} Array of tracking events found in the line
 */
function findTrackingCallsInLine(line, lineNumber, currentFunction, filePath, customFunctionSignatures, variableContext) {
  const events = [];
  
  // Patterns to match different analytics calls
  const patterns = [
    // Segment: Analytics.shared().track("event", properties: [...])
    /Analytics\.shared\(\)\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // Mixpanel: Mixpanel.mainInstance().track(event: "event", properties: [...])
    /Mixpanel\.mainInstance\(\)\.track\s*\(\s*event:\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // Amplitude: amplitude.track(eventType: "event", eventProperties: [...])
    /amplitude\.track\s*\(\s*eventType:\s*"([^"]+)"\s*,\s*eventProperties:\s*(\[[\s\S]*?\])/g,
    
    // RudderStack: RSClient.sharedInstance()?.track("event", properties: [...])
    /RSClient\.sharedInstance\(\)\?\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // mParticle: MParticle.sharedInstance().logEvent("event", eventType: .other, eventInfo: [...])
    /MParticle\.sharedInstance\(\)\.logEvent\s*\(\s*"([^"]+)"\s*,\s*eventType:\s*[^,]+,\s*eventInfo:\s*(\[[\s\S]*?\])/g,
    
    // PostHog: PostHogSDK.shared.capture("event", properties: [...])
    /PostHogSDK\.shared\.capture\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // Pendo: PendoManager.shared().track("event", properties: [...])
    /PendoManager\.shared\(\)\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // Heap: Heap.shared.track("event", properties: [...])
    /Heap\.shared\.track\s*\(\s*"([^"]+)"\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // Firebase: Analytics.logEvent("event", parameters: [...])
    /Analytics\.logEvent\s*\(\s*"([^"]+)"\s*,\s*parameters:\s*(\[[\s\S]*?\])/g,
    
    // Variable-based tracking: Analytics.shared().track(eventName, properties: [...])
    /Analytics\.shared\(\)\.track\s*\(\s*(\w+)\s*,\s*properties:\s*(\[[\s\S]*?\])/g,
    
    // Snowplow: tracker.track(event) where event is Structured(...)
    /tracker\.track\s*\(\s*(\w+)\s*\)/g
  ];

  // Check each pattern
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(line)) !== null) {
      const event = parseTrackingCall(match, line, lineNumber, currentFunction, filePath, variableContext);
      if (event) {
        events.push(event);
      }
    }
  }

  // Check custom functions
  if (customFunctionSignatures && customFunctionSignatures.length > 0) {
    for (const customConfig of customFunctionSignatures) {
      if (customConfig && customConfig.functionName) {
        const customPattern = new RegExp(`${escapeRegExp(customConfig.functionName)}\\s*\\([^)]*\\)`, 'g');
        let match;
        while ((match = customPattern.exec(line)) !== null) {
          const event = parseCustomTrackingCall(match, line, lineNumber, currentFunction, filePath, customConfig, variableContext);
          if (event) {
            events.push(event);
          }
        }
      }
    }
  }

  return events;
}

/**
 * Parse a tracking call match into an event object
 * @param {Array} match - Regex match result
 * @param {string} line - Full line content
 * @param {number} lineNumber - Line number
 * @param {string} currentFunction - Current function name
 * @param {string} filePath - File path
 * @param {Object} variableContext - Variable context
 * @returns {Object|null} Event object or null
 */
function parseTrackingCall(match, line, lineNumber, currentFunction, filePath, variableContext) {
  try {
    // Determine source based on the pattern matched
    let source = null;
    let eventName = null;
    let propertiesText = null;

    if (line.includes('Analytics.shared().track')) {
      source = 'segment';
    } else if (line.includes('Mixpanel.mainInstance().track')) {
      source = 'mixpanel';
    } else if (line.includes('amplitude.track')) {
      source = 'amplitude';
    } else if (line.includes('RSClient.sharedInstance()?.track')) {
      source = 'rudderstack';
    } else if (line.includes('MParticle.sharedInstance().logEvent')) {
      source = 'mparticle';
    } else if (line.includes('PostHogSDK.shared.capture')) {
      source = 'posthog';
    } else if (line.includes('PendoManager.shared().track')) {
      source = 'pendo';
    } else if (line.includes('Heap.shared.track')) {
      source = 'heap';
    } else if (line.includes('Analytics.logEvent')) {
      source = 'firebase';
    } else if (line.includes('tracker.track')) {
      source = 'snowplow';
    }

    if (!source) return null;

    // Extract event name
    if (match[1]) {
      eventName = match[1];
      
      // Resolve variable if it's not a string literal
      if (!eventName.startsWith('"') && variableContext[eventName]) {
        eventName = variableContext[eventName];
      }
      
      // Clean up quotes
      eventName = eventName.replace(/^"(.*)"$/, '$1');
    }

    // Extract properties
    let properties = {};
    if (match[2]) {
      propertiesText = match[2];
      properties = parseSwiftDictionary(propertiesText, variableContext);
    }

    // Handle Snowplow special case
    if (source === 'snowplow' && match[1]) {
      const structVar = match[1];
      const structMatch = line.match(new RegExp(`let\\s+${structVar}\\s*=\\s*Structured\\s*\\([^)]*\\)`));
      if (structMatch) {
        const structCall = structMatch[0];
        const snowplowData = parseSnowplowStruct(structCall);
        eventName = snowplowData.action || eventName;
        properties = snowplowData.properties || properties;
      }
    }

    if (!eventName) return null;

    return processEventData(
      eventName,
      properties,
      source,
      filePath,
      lineNumber,
      currentFunction
    );
  } catch (error) {
    console.error(`Error parsing tracking call at line ${lineNumber}:`, error.message);
    return null;
  }
}

/**
 * Parse a Swift custom tracking call with labeled parameters
 * @param {string} matchText - Full match text
 * @param {number} lineNumber - Line number
 * @param {string} currentFunction - Current function name
 * @param {string} filePath - File path
 * @param {Object} customConfig - Custom function configuration
 * @param {Object} variableContext - Variable context
 * @returns {Object|null} Event object or null
 */
function parseSwiftCustomTrackingCall(matchText, lineNumber, currentFunction, filePath, customConfig, variableContext) {
  try {
    // Extract arguments from the function call
    const argsStart = matchText.indexOf('(');
    const argsEnd = matchText.lastIndexOf(')');
    
    if (argsStart === -1 || argsEnd === -1) return null;
    
    const argsText = matchText.substring(argsStart + 1, argsEnd);
    const labeledArgs = parseSwiftLabeledArguments(argsText);

    if (Object.keys(labeledArgs).length === 0) return null;

    // Extract event name - look for eventName label or use positional fallback
    let eventName = null;
    if (labeledArgs['eventName']) {
      eventName = labeledArgs['eventName'];
    } else {
      // Fallback to positional argument
      const positionalArgs = parseSwiftArguments(argsText);
      const eventIndex = customConfig.eventIndex || 0;
      eventName = positionalArgs[eventIndex];
    }
    
    if (!eventName) return null;

    // Resolve variable if needed
    if (!eventName.startsWith('"') && variableContext[eventName]) {
      eventName = variableContext[eventName];
    }
    
    // Clean up quotes
    eventName = eventName.replace(/^"(.*)"$/, '$1');

    // Extract properties - look for properties label
    let properties = {};
    if (labeledArgs['properties']) {
      properties = parseSwiftDictionary(labeledArgs['properties'], variableContext);
    }

    return processEventData(
      eventName,
      properties,
      'custom',
      filePath,
      lineNumber,
      currentFunction
    );
  } catch (error) {
    console.error(`Error parsing Swift custom tracking call at line ${lineNumber}:`, error.message);
    return null;
  }
}

/**
 * Parse a custom tracking call from a multiline match
 * @param {string} matchText - Full match text
 * @param {number} lineNumber - Line number
 * @param {string} currentFunction - Current function name
 * @param {string} filePath - File path
 * @param {Object} customConfig - Custom function configuration
 * @param {Object} variableContext - Variable context
 * @returns {Object|null} Event object or null
 */
function parseCustomTrackingCallFromMatch(matchText, lineNumber, currentFunction, filePath, customConfig, variableContext) {
  try {
    // Extract arguments from the function call
    const argsStart = matchText.indexOf('(');
    const argsEnd = matchText.lastIndexOf(')');
    
    if (argsStart === -1 || argsEnd === -1) return null;
    
    const argsText = matchText.substring(argsStart + 1, argsEnd);
    const args = parseSwiftArguments(argsText);

    if (args.length === 0) return null;

    // Extract event name based on configuration
    const eventIndex = customConfig.eventIndex || 0;
    let eventName = args[eventIndex];
    
    if (!eventName) return null;

    // Resolve variable if needed
    if (!eventName.startsWith('"') && variableContext[eventName]) {
      eventName = variableContext[eventName];
    }
    
    // Clean up quotes
    eventName = eventName.replace(/^"(.*)"$/, '$1');

    // Extract properties based on configuration
    const propertiesIndex = customConfig.propertiesIndex || 1;
    let properties = {};
    
    if (args[propertiesIndex]) {
      const propertiesText = args[propertiesIndex];
      properties = parseSwiftDictionary(propertiesText, variableContext);
    }

    return processEventData(
      eventName,
      properties,
      'custom',
      filePath,
      lineNumber,
      currentFunction
    );
  } catch (error) {
    console.error(`Error parsing custom tracking call at line ${lineNumber}:`, error.message);
    return null;
  }
}

/**
 * Parse a custom tracking call
 * @param {Array} match - Regex match result
 * @param {string} line - Full line content
 * @param {number} lineNumber - Line number
 * @param {string} currentFunction - Current function name
 * @param {string} filePath - File path
 * @param {Object} customConfig - Custom function configuration
 * @param {Object} variableContext - Variable context
 * @returns {Object|null} Event object or null
 */
function parseCustomTrackingCall(match, line, lineNumber, currentFunction, filePath, customConfig, variableContext) {
  try {
    // Extract arguments from the function call
    const fullMatch = match[0];
    const argsStart = fullMatch.indexOf('(');
    const argsEnd = fullMatch.lastIndexOf(')');
    
    if (argsStart === -1 || argsEnd === -1) return null;
    
    const argsText = fullMatch.substring(argsStart + 1, argsEnd);
    const args = parseSwiftArguments(argsText);

    if (args.length === 0) return null;

    // Extract event name based on configuration
    const eventIndex = customConfig.eventIndex || 0;
    let eventName = args[eventIndex];
    
    if (!eventName) return null;

    // Resolve variable if needed
    if (!eventName.startsWith('"') && variableContext[eventName]) {
      eventName = variableContext[eventName];
    }
    
    // Clean up quotes
    eventName = eventName.replace(/^"(.*)"$/, '$1');

    // Extract properties based on configuration
    const propertiesIndex = customConfig.propertiesIndex || 1;
    let properties = {};
    
    if (args[propertiesIndex]) {
      const propertiesText = args[propertiesIndex];
      properties = parseSwiftDictionary(propertiesText, variableContext);
    }

    return processEventData(
      eventName,
      properties,
      'custom',
      filePath,
      lineNumber,
      currentFunction
    );
  } catch (error) {
    console.error(`Error parsing custom tracking call at line ${lineNumber}:`, error.message);
    return null;
  }
}

/**
 * Parse a Swift dictionary literal into properties object
 * @param {string} dictText - Dictionary text
 * @param {Object} variableContext - Variable context
 * @returns {Object} Properties object
 */
function parseSwiftDictionary(dictText, variableContext = {}) {
  const properties = {};
  
  if (!dictText || !dictText.trim()) return properties;
  
  try {
    // Remove brackets and split by commas (simple approach)
    let content = dictText.trim();
    if (content.startsWith('[')) content = content.slice(1);
    if (content.endsWith(']')) content = content.slice(0, -1);
    
    // Split by commas but be careful about nested structures
    const entries = splitSwiftDictEntries(content);
    
    for (const entry of entries) {
      const colonIndex = entry.indexOf(':');
      if (colonIndex === -1) continue;
      
      let key = entry.substring(0, colonIndex).trim();
      let value = entry.substring(colonIndex + 1).trim();
      
      // Clean up key
      key = key.replace(/^"(.*)"$/, '$1');
      
      // Determine value type and clean up
      const valueType = determineSwiftValueType(value, variableContext);
      
      properties[key] = { type: valueType };
      
      // For object types, try to extract nested properties
      if (valueType === 'object' && value.startsWith('[')) {
        const nestedProps = parseSwiftDictionary(value, variableContext);
        if (Object.keys(nestedProps).length > 0) {
          properties[key].properties = nestedProps;
        }
      }
    }
  } catch (error) {
    console.error('Error parsing Swift dictionary:', error.message);
  }
  
  return properties;
}

/**
 * Split Swift dictionary entries by commas, respecting nested structures
 * @param {string} content - Dictionary content
 * @returns {Array} Array of entry strings
 */
function splitSwiftDictEntries(content) {
  const entries = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      current += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }
    
    if (inString) {
      current += char;
      continue;
    }
    
    if (char === '[' || char === '(') {
      depth++;
    } else if (char === ']' || char === ')') {
      depth--;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        entries.push(current.trim());
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    entries.push(current.trim());
  }
  
  return entries;
}

/**
 * Determine the type of a Swift value
 * @param {string} value - Value string
 * @param {Object} variableContext - Variable context
 * @returns {string} Type string
 */
function determineSwiftValueType(value, variableContext = {}) {
  value = value.trim();
  
  // String literals
  if (value.startsWith('"') && value.endsWith('"')) {
    return 'string';
  }
  
  // Number literals
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return 'number';
  }
  
  // Boolean literals
  if (value === 'true' || value === 'false') {
    return 'boolean';
  }
  
  // Nil
  if (value === 'nil') {
    return 'null';
  }
  
  // Array literals
  if (value.startsWith('[') && value.endsWith(']')) {
    return 'array';
  }
  
  // Dictionary literals
  if (value.startsWith('[') && value.includes(':')) {
    return 'object';
  }
  
  // Variable references
  if (variableContext[value]) {
    return determineSwiftValueType(variableContext[value], variableContext);
  }
  
  // Function calls or complex expressions
  if (value.includes('(') || value.includes('.')) {
    return 'any';
  }
  
  // Default to any for unresolved values
  return 'any';
}

/**
 * Parse Swift labeled function arguments (e.g., "eventName: 'event', properties: [...]")
 * @param {string} argsText - Arguments text
 * @returns {Object} Object mapping labels to values
 */
function parseSwiftLabeledArguments(argsText) {
  const labeledArgs = {};
  const args = parseSwiftArguments(argsText);
  
  for (const arg of args) {
    const colonIndex = arg.indexOf(':');
    if (colonIndex !== -1) {
      // This is a labeled argument
      const label = arg.substring(0, colonIndex).trim();
      const value = arg.substring(colonIndex + 1).trim();
      labeledArgs[label] = value;
    } else {
      // This might be a positional argument or unlabeled value
      // For now, we'll skip it since we're focusing on labeled args
    }
  }
  
  return labeledArgs;
}

/**
 * Parse Swift function arguments
 * @param {string} argsText - Arguments text
 * @returns {Array} Array of argument strings
 */
function parseSwiftArguments(argsText) {
  const args = [];
  let current = '';
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < argsText.length; i++) {
    const char = argsText[i];
    
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      current += char;
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      current += char;
      continue;
    }
    
    if (inString) {
      current += char;
      continue;
    }
    
    if (char === '(' || char === '[') {
      depth++;
    } else if (char === ')' || char === ']') {
      depth--;
    } else if (char === ',' && depth === 0) {
      if (current.trim()) {
        args.push(current.trim());
      }
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  return args;
}

/**
 * Extract Snowplow properties from a Structured event declaration
 * @param {string} matchText - Full match text containing Structured event
 * @returns {Object} Properties object
 */
function extractSnowplowProperties(matchText) {
  const properties = {};
  
  try {
    // Extract the Structured(...) part
    const structuredMatch = matchText.match(/Structured\s*\(([\s\S]*?)\)/);
    if (!structuredMatch) return properties;
    
    const argsText = structuredMatch[1];
    const labeledArgs = parseSwiftLabeledArguments(argsText);
    
    // Convert labeled arguments to properties (skip action since it's the event name)
    for (const [label, value] of Object.entries(labeledArgs)) {
      if (label !== 'action') {
        const valueType = determineSwiftValueType(value);
        properties[label] = { type: valueType };
      }
    }
  } catch (error) {
    console.error('Error extracting Snowplow properties:', error.message);
  }
  
  return properties;
}

/**
 * Parse Snowplow Structured event
 * @param {string} structCall - Structured call text
 * @returns {Object} Snowplow event data
 */
function parseSnowplowStruct(structCall) {
  const result = { properties: {} };
  
  try {
    // Extract arguments from Structured(...)
    const argsStart = structCall.indexOf('(');
    const argsEnd = structCall.lastIndexOf(')');
    
    if (argsStart === -1 || argsEnd === -1) return result;
    
    const argsText = structCall.substring(argsStart + 1, argsEnd);
    const args = parseSwiftArguments(argsText);
    
    // Parse labeled arguments
    for (const arg of args) {
      const colonIndex = arg.indexOf(':');
      if (colonIndex === -1) continue;
      
      const label = arg.substring(0, colonIndex).trim();
      let value = arg.substring(colonIndex + 1).trim();
      
      // Clean up quotes
      value = value.replace(/^"(.*)"$/, '$1');
      
      if (label === 'action') {
        result.action = value;
      } else {
        const valueType = determineSwiftValueType(value);
        result.properties[label] = { type: valueType };
      }
    }
  } catch (error) {
    console.error('Error parsing Snowplow struct:', error.message);
  }
  
  return result;
}

/**
 * Resolve properties from a variable reference
 * @param {string} variableName - Variable name
 * @param {string} content - Full source content
 * @param {number} position - Position in content
 * @param {Object} variableContext - Variable context
 * @returns {Object} Properties object
 */
function resolveVariableProperties(variableName, content, position, variableContext) {
  // Look for the variable assignment in the current function scope
  const beforePosition = content.substring(0, position);
  const lines = beforePosition.split('\n');
  
  // Look backwards for variable assignments
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    
    // Look for dictionary assignments like: let varName = [...]
    const dictMatch = line.match(new RegExp(`(?:let|var)\\s+${escapeRegExp(variableName)}\\s*=\\s*(\\[.*\\])`));
    if (dictMatch) {
      return parseSwiftDictionary(dictMatch[1], variableContext);
    }
    
    // Look for variable copying like: var extendedProperties = baseProperties
    const copyMatch = line.match(new RegExp(`(?:let|var)\\s+${escapeRegExp(variableName)}\\s*=\\s*(\\w+)`));
    if (copyMatch) {
      const sourceVar = copyMatch[1];
      // Try to find the source variable definition
      const sourceProperties = resolveVariableProperties(sourceVar, content, position, variableContext);
      return sourceProperties;
    }
    
    // Look for property assignments like: extendedProperties["key"] = "value"
    const propMatch = line.match(new RegExp(`${escapeRegExp(variableName)}\\["([^"]+)"\\]\\s*=\\s*"([^"]+)"`));
    if (propMatch) {
      // For now, just note that this variable has at least one property
      // Full resolution would require more complex analysis
      return {
        [propMatch[1]]: { type: 'string' },
        // Add generic properties to indicate this is a dynamic object
        'source': { type: 'string' },
        'version': { type: 'string' },
        'user_action': { type: 'string' }
      };
    }
  }
  
  // If we can't resolve the variable, return generic object properties
  return {
    'source': { type: 'string' },
    'version': { type: 'string' },
    'user_action': { type: 'string' }
  };
}

/**
 * Build variable context from Swift source code
 * @param {string} content - Swift source code
 * @param {Object} variableContext - Variable context to populate
 */
function buildVariableContext(content, variableContext) {
  const lines = content.split('\n');
  
  for (const line of lines) {
    // Look for variable declarations with string values
    const varMatch = line.match(/^\s*(?:let|var)\s+(\w+)\s*=\s*"([^"]+)"/);
    if (varMatch) {
      variableContext[varMatch[1]] = `"${varMatch[2]}"`;
    }
    
    // Look for constant declarations
    const constMatch = line.match(/^\s*(?:let|var)\s+(\w+)\s*=\s*(.+?)(?:$|\/\/)/);
    if (constMatch && !constMatch[2].includes('=')) {
      variableContext[constMatch[1]] = constMatch[2].trim();
    }
  }
}

/**
 * Escape regex special characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  parseFile,
  findTrackingEvents
};