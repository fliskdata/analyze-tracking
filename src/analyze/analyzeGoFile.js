const fs = require('fs');
const path = require('path');
const { extractGoAST } = require('./go2json');

async function analyzeGoFile(filePath, customFunction) {
  try {
    // Read the Go file
    const source = fs.readFileSync(filePath, 'utf8');
    
    // Parse the Go file using go2json
    const ast = extractGoAST(source);
    
    // Extract tracking events from the AST
    const events = [];
    let currentFunction = 'global';
    
    // Walk through the AST
    for (const node of ast) {
      if (node.tag === 'func') {
        currentFunction = node.name;
        // Process the function body
        if (node.body) {
          extractEventsFromBody(node.body, events, filePath, currentFunction, customFunction);
        }
      }
    }
    
    return events;
  } catch (error) {
    console.error(`Error analyzing Go file ${filePath}:`, error.message);
    return [];
  }
}

function extractEventsFromBody(body, events, filePath, functionName, customFunction) {
  for (const stmt of body) {
    if (stmt.tag === 'exec' && stmt.expr) {
      processExpression(stmt.expr, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'declare' && stmt.value) {
      // Handle variable declarations with tracking calls
      processExpression(stmt.value, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'assign' && stmt.rhs) {
      // Handle assignments with tracking calls
      processExpression(stmt.rhs, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'if' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'elseif' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'else' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'for' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'foreach' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customFunction);
    } else if (stmt.tag === 'switch' && stmt.cases) {
      for (const caseNode of stmt.cases) {
        if (caseNode.body) {
          extractEventsFromBody(caseNode.body, events, filePath, functionName, customFunction);
        }
      }
    }
  }
}

function processExpression(expr, events, filePath, functionName, customFunction, depth = 0) {
  if (!expr || depth > 20) return; // Prevent infinite recursion with depth limit
  
  // Handle array of expressions
  if (Array.isArray(expr)) {
    for (const item of expr) {
      processExpression(item, events, filePath, functionName, customFunction, depth + 1);
    }
    return;
  }
  
  // Handle single expression with body
  if (expr.body) {
    for (const item of expr.body) {
      processExpression(item, events, filePath, functionName, customFunction, depth + 1);
    }
    return;
  }
  
  // Handle specific node types
  if (expr.tag === 'call') {
    const trackingCall = extractTrackingCall(expr, filePath, functionName, customFunction);
    if (trackingCall) {
      events.push(trackingCall);
    }
    
    // Also process call arguments
    if (expr.args) {
      processExpression(expr.args, events, filePath, functionName, customFunction, depth + 1);
    }
  } else if (expr.tag === 'structlit') {
    // Check if this struct literal is a tracking event
    const trackingCall = extractTrackingCall(expr, filePath, functionName, customFunction);
    if (trackingCall) {
      events.push(trackingCall);
    }
    
    // Process fields (but don't recurse into field values for tracking structs)
    if (!trackingCall && expr.fields) {
      for (const field of expr.fields) {
        if (field.value) {
          processExpression(field.value, events, filePath, functionName, customFunction, depth + 1);
        }
      }
    }
  }
  
  // Process other common properties that might contain expressions
  if (expr.value && expr.tag !== 'structlit') {
    processExpression(expr.value, events, filePath, functionName, customFunction, depth + 1);
  }
  if (expr.lhs) {
    processExpression(expr.lhs, events, filePath, functionName, customFunction, depth + 1);
  }
  if (expr.rhs) {
    processExpression(expr.rhs, events, filePath, functionName, customFunction, depth + 1);
  }
}

function extractTrackingCall(callNode, filePath, functionName, customFunction) {
  const source = detectSource(callNode, customFunction);
  if (!source) return null;
  
  const eventName = extractEventName(callNode, source);
  if (!eventName) return null;
  
  const properties = extractProperties(callNode, source);
  
  // Use line number from AST node if available
  const line = callNode.line || 0;
  
  return {
    eventName,
    source,
    properties,
    filePath,
    line,
    functionName
  };
}

function detectSource(callNode, customFunction) {
  // Check for struct literals (Segment/Rudderstack/PostHog/Amplitude)
  if (callNode.tag === 'structlit') {
    if (callNode.struct) {
      if (callNode.struct.tag === 'access') {
        const structType = callNode.struct.member;
        const namespace = callNode.struct.struct?.value;
        
        // Check for specific struct types with their namespaces
        if (structType === 'Track' && namespace === 'analytics') return 'segment';
        if (structType === 'Capture' && namespace === 'posthog') return 'posthog';
        if (structType === 'Event' && namespace === 'amplitude') return 'amplitude';
        
        // Fallback for struct types without namespace check (backward compatibility)
        if (structType === 'Track') return 'segment';
        if (structType === 'Capture') return 'posthog';
      }
    }
    return null;
  }
  
  // For function calls, check if func property exists
  if (!callNode.func) return null;
  
  // Check for method calls (e.g., client.Track, mp.Track)
  if (callNode.func.tag === 'access') {
    const objName = callNode.func.struct?.tag === 'ident' ? callNode.func.struct.value : null;
    const methodName = callNode.func.member;
    
    if (!objName || !methodName) return null;
    
    // Check various analytics providers
    switch (true) {
      // Mixpanel: mp.Track(ctx, []*mixpanel.Event{...})
      case objName === 'mp' && methodName === 'Track':
        return 'mixpanel';
      
      // Amplitude: client.Track(amplitude.Event{...})
      case objName === 'client' && methodName === 'Track':
        return 'amplitude';
      
      // Snowplow: tracker.TrackStructEvent(...)
      case objName === 'tracker' && methodName === 'TrackStructEvent':
        return 'snowplow';
    }
  }
  
  // Check for custom function calls
  if (customFunction && callNode.func.tag === 'ident' && callNode.func.value === customFunction) {
    return 'custom';
  }
  
  return null;
}

function extractEventName(callNode, source) {
  if (!callNode.args || callNode.args.length === 0) {
    // For struct literals, we need to check fields instead of args
    if (!callNode.fields || callNode.fields.length === 0) {
      return null;
    }
  }
  
  switch (source) {
    case 'mixpanel':
      // mp.Track(ctx, []*mixpanel.Event{mp.NewEvent("event_name", "", props)})
      // Need to find the NewEvent call within the array
      if (callNode.args && callNode.args.length > 1) {
        const arrayArg = callNode.args[1];
        if (arrayArg.tag === 'expr' && arrayArg.body) {
          const arrayLit = arrayArg.body.find(item => item.tag === 'arraylit');
          if (arrayLit && arrayLit.items && arrayLit.items.length > 0) {
            // Each item is an array of tokens that needs to be parsed
            const firstItem = arrayLit.items[0];
            if (Array.isArray(firstItem)) {
              // Look for pattern: mp.NewEvent("event_name", ...)
              for (let i = 0; i < firstItem.length - 4; i++) {
                if (firstItem[i].tag === 'ident' && firstItem[i].value === 'mp' &&
                    firstItem[i+1].tag === 'sigil' && firstItem[i+1].value === '.' &&
                    firstItem[i+2].tag === 'ident' && firstItem[i+2].value === 'NewEvent' &&
                    firstItem[i+3].tag === 'sigil' && firstItem[i+3].value === '(') {
                  // Found mp.NewEvent( - next token should be the event name
                  if (firstItem[i+4] && firstItem[i+4].tag === 'string') {
                    return firstItem[i+4].value.slice(1, -1); // Remove quotes
                  }
                }
              }
            }
          }
        }
      }
      break;
      
    case 'segment':
    case 'posthog':
      // analytics.Track{Event: "event_name", ...} or posthog.Capture{Event: "event_name", ...}
      if (callNode.fields) {
        const eventField = findStructField(callNode, 'Event');
        if (eventField) {
          return extractStringValue(eventField.value);
        }
      }
      break;
      
    case 'amplitude':
      // For struct literals: amplitude.Event{EventType: "event_name", ...}
      if (callNode.tag === 'structlit' && callNode.fields) {
        const eventTypeField = findStructField(callNode, 'EventType');
        if (eventTypeField) {
          return extractStringValue(eventTypeField.value);
        }
      }
      // For function calls: client.Track(amplitude.Event{EventType: "event_name", ...})
      else if (callNode.args && callNode.args.length > 0) {
        const eventStruct = findStructLiteral(callNode.args[0]);
        if (eventStruct && eventStruct.fields) {
          const eventTypeField = findStructField(eventStruct, 'EventType');
          if (eventTypeField) {
            return extractStringValue(eventTypeField.value);
          }
        }
      }
      break;
      
    case 'snowplow':
      // tracker.TrackStructEvent(sp.StructuredEvent{Action: sphelp.NewString("event_name"), ...})
      if (callNode.args && callNode.args.length > 0) {
        const structEvent = findStructLiteral(callNode.args[0]);
        if (structEvent && structEvent.fields) {
          const actionField = findStructField(structEvent, 'Action');
          if (actionField) {
            // Snowplow uses sphelp.NewString("value")
            return extractSnowplowValue(actionField.value);
          }
        }
      }
      break;
      
    case 'custom':
      // customFunction("event_name", props)
      if (callNode.args && callNode.args.length > 0) {
        return extractStringValue(callNode.args[0]);
      }
      break;
  }
  
  return null;
}

function extractProperties(callNode, source) {
  const properties = {};
  
  switch (source) {
    case 'mixpanel':
      // mp.Track(ctx, []*mixpanel.Event{mp.NewEvent("event", "", map[string]any{...})})
      if (callNode.args && callNode.args.length > 1) {
        const arrayArg = callNode.args[1];
        if (arrayArg.tag === 'expr' && arrayArg.body) {
          const arrayLit = arrayArg.body.find(item => item.tag === 'arraylit');
          if (arrayLit && arrayLit.items && arrayLit.items.length > 0) {
            const firstItem = arrayLit.items[0];
            if (Array.isArray(firstItem)) {
              // Look for pattern: mp.NewEvent("event", "", map[string]any{...})
              // The third argument is the properties map
              let foundNewEvent = false;
              for (let i = 0; i < firstItem.length - 4; i++) {
                if (firstItem[i].tag === 'ident' && firstItem[i].value === 'mp' &&
                    firstItem[i+1].tag === 'sigil' && firstItem[i+1].value === '.' &&
                    firstItem[i+2].tag === 'ident' && firstItem[i+2].value === 'NewEvent' &&
                    firstItem[i+3].tag === 'sigil' && firstItem[i+3].value === '(') {
                  // Found mp.NewEvent( - skip event name and empty string to find the map
                  let j = i + 4;
                  let commaCount = 0;
                  
                  // Skip to the third argument (after 2 commas)
                  while (j < firstItem.length && commaCount < 2) {
                    if (firstItem[j].tag === 'sigil' && firstItem[j].value === ',') {
                      commaCount++;
                    }
                    j++;
                  }
                  
                  // Look for map[string]any{ pattern
                  while (j < firstItem.length - 2) {
                    if (firstItem[j].tag === 'ident' && firstItem[j].value === 'map' &&
                        firstItem[j+1].tag === 'sigil' && firstItem[j+1].value === '[') {
                      // Found the start of the map, now look for the opening brace
                      while (j < firstItem.length) {
                        if (firstItem[j].tag === 'sigil' && firstItem[j].value === '{') {
                          // Simple property extraction from tokens
                          // Look for pattern: "key": "value"
                          for (let k = j + 1; k < firstItem.length - 2; k++) {
                            if (firstItem[k].tag === 'string' && 
                                firstItem[k+1].tag === 'sigil' && firstItem[k+1].value === ':' &&
                                firstItem[k+2].tag === 'string') {
                              const key = firstItem[k].value.slice(1, -1);
                              properties[key] = { type: 'string' };
                            }
                          }
                          foundNewEvent = true;
                          break;
                        }
                        j++;
                      }
                      if (foundNewEvent) break;
                    }
                    j++;
                  }
                  if (foundNewEvent) break;
                }
              }
            }
          }
        }
      }
      break;
      
    case 'segment':
    case 'posthog':
      // analytics.Track{UserId: "...", Properties: analytics.NewProperties().Set(...)} or
      // posthog.Capture{DistinctId: "...", Properties: posthog.NewProperties().Set(...)}
      if (callNode.fields) {
        // Extract UserId/DistinctId
        const idField = findStructField(callNode, source === 'segment' ? 'UserId' : 'DistinctId');
        if (idField) {
          properties[source === 'segment' ? 'userId' : 'distinctId'] = { type: 'string' };
        }
        
        // Extract Properties
        const propsField = findStructField(callNode, 'Properties');
        if (propsField && propsField.value) {
          if (source === 'segment') {
            extractSegmentProperties(propsField.value, properties);
          } else {
            extractPostHogProperties(propsField.value, properties);
          }
        }
      }
      break;
      
    case 'amplitude':
      // For struct literals: amplitude.Event{UserID: "...", EventProperties: map[string]interface{}{...}}
      if (callNode.tag === 'structlit' && callNode.fields) {
        // Extract UserID
        const userIdField = findStructField(callNode, 'UserID');
        if (userIdField) {
          properties.userId = { type: 'string' };
        }
        
        // Extract EventProperties
        const eventPropsField = findStructField(callNode, 'EventProperties');
        if (eventPropsField) {
          extractPropertiesFromExpr(eventPropsField.value, properties, source);
        }
      }
      // For function calls: client.Track(amplitude.Event{UserID: "...", EventProperties: map[string]interface{}{...}})
      else if (callNode.args && callNode.args.length > 0) {
        const eventStruct = findStructLiteral(callNode.args[0]);
        if (eventStruct && eventStruct.fields) {
          // Extract UserID
          const userIdField = findStructField(eventStruct, 'UserID');
          if (userIdField) {
            properties.userId = { type: 'string' };
          }
          
          // Extract EventProperties
          const eventPropsField = findStructField(eventStruct, 'EventProperties');
          if (eventPropsField) {
            extractPropertiesFromExpr(eventPropsField.value, properties, source);
          }
        }
      }
      break;
      
    case 'snowplow':
      // tracker.TrackStructEvent(sp.StructuredEvent{Category: sphelp.NewString("..."), ...})
      if (callNode.args && callNode.args.length > 0) {
        const structEvent = findStructLiteral(callNode.args[0]);
        if (structEvent && structEvent.fields) {
          // Extract all fields except Action (which is the event name)
          for (const field of structEvent.fields) {
            const fieldName = extractFieldName(field);
            if (fieldName && fieldName !== 'Action') {
              const value = extractSnowplowValue(field.value);
              if (value !== null) {
                properties[fieldName] = { type: typeof value === 'number' ? 'number' : 'string' };
              }
            }
          }
        }
      }
      break;
      
    case 'custom':
      // customFunction("event", map[string]interface{}{...})
      if (callNode.args && callNode.args.length > 1) {
        extractPropertiesFromExpr(callNode.args[1], properties, source);
      }
      break;
  }
  
  return properties;
}

// Helper function to find a struct literal in an expression
function findStructLiteral(expr) {
  if (!expr) return null;
  
  if (expr.tag === 'structlit') {
    return expr;
  }
  
  if (expr.tag === 'expr' && expr.body) {
    for (const item of expr.body) {
      if (item.tag === 'structlit') {
        return item;
      }
    }
  }
  
  return null;
}

// Helper function to find a field in a struct by name
function findStructField(structlit, fieldName) {
  if (!structlit.fields) return null;
  
  for (const field of structlit.fields) {
    const name = extractFieldName(field);
    if (name === fieldName) {
      return field;
    }
  }
  
  return null;
}

// Helper function to extract field name from a struct field
function extractFieldName(field) {
  if (field.name) {
    return field.name;
  }
  
  if (field.value && field.value.tag === 'expr' && field.value.body && field.value.body.length >= 3) {
    const firstNode = field.value.body[0];
    const colonNode = field.value.body[1];
    if (firstNode && firstNode.tag === 'ident' && colonNode && colonNode.value === ':') {
      return firstNode.value;
    }
  }
  
  return null;
}

// Helper function to extract Segment/PostHog properties from NewProperties().Set() chain
function extractSegmentProperties(expr, properties) {
  if (!expr) return;
  
  // Look for method calls in the expression
  if (expr.tag === 'expr' && expr.body) {
    for (const item of expr.body) {
      if (item.tag === 'call' && item.func && item.func.tag === 'access') {
        if (item.func.member === 'Set' && item.args && item.args.length >= 2) {
          // Set("key", value)
          const key = extractStringValue(item.args[0]);
          if (key) {
            properties[key] = getPropertyInfo(item.args[1]);
          }
        }
      }
    }
  }
}

// Alias for PostHog since it uses the same pattern
const extractPostHogProperties = extractSegmentProperties;

// Helper function to extract Snowplow values from sphelp.NewString/NewFloat64
function extractSnowplowValue(expr) {
  if (!expr) return null;
  
  // Direct value
  if (expr.tag === 'string') {
    return expr.value.slice(1, -1);
  }
  if (expr.tag === 'number') {
    return parseFloat(expr.value);
  }
  
  // Look for sphelp.NewString("value") or sphelp.NewFloat64(value)
  if (expr.tag === 'expr' && expr.body) {
    for (const item of expr.body) {
      if (item.tag === 'call' && item.func && item.func.tag === 'access') {
        if (item.func.member === 'NewString' && item.args && item.args.length > 0) {
          return extractStringValue(item.args[0]);
        }
        if (item.func.member === 'NewFloat64' && item.args && item.args.length > 0) {
          const numExpr = item.args[0];
          if (numExpr.tag === 'number') {
            return parseFloat(numExpr.value);
          }
          if (numExpr.tag === 'expr' && numExpr.body && numExpr.body[0] && numExpr.body[0].tag === 'number') {
            return parseFloat(numExpr.body[0].value);
          }
        }
      }
    }
  }
  
  return null;
}

function extractStringValue(node) {
  if (!node) return null;
  
  // Handle direct string literals
  if (node.tag === 'string') {
    // Remove quotes from the value
    return node.value.slice(1, -1);
  }
  
  // Handle expressions that might contain a string
  if (node.tag === 'expr' && node.body && node.body.length > 0) {
    // Look for string literals in the expression body
    for (const item of node.body) {
      if (item.tag === 'string') {
        return item.value.slice(1, -1);
      }
    }
  }
  
  return null;
}

function extractPropertiesFromExpr(expr, properties, source) {
  // Handle struct literals (e.g., Type{field: value})
  if (expr.tag === 'structlit' && expr.fields) {
    for (const field of expr.fields) {
      if (field.name) {
        const propInfo = getPropertyInfo(field.value);
        properties[field.name] = propInfo;
      } else if (field.value && field.value.tag === 'expr' && field.value.body) {
        // Handle map literal fields that don't have explicit names
        // Format: "key": value
        const keyNode = field.value.body[0];
        const colonNode = field.value.body[1];
        const valueNode = field.value.body[2];
        
        if (keyNode && keyNode.tag === 'string' && colonNode && colonNode.value === ':') {
          const key = keyNode.value.slice(1, -1); // Remove quotes
          
          // For nested maps, the value might include the map type declaration AND the structlit
          if (valueNode && valueNode.tag === 'index' && valueNode.container && valueNode.container.value === 'map') {
            // Look for the structlit that follows in the body
            const remainingNodes = field.value.body.slice(3); // Skip key, :, and map declaration
            const structlit = remainingNodes.find(node => node.tag === 'structlit');
            if (structlit) {
              properties[key] = getPropertyInfo(structlit);
            } else {
              properties[key] = { type: 'object', properties: {} };
            }
          } else if (valueNode) {
            properties[key] = getPropertyInfo(valueNode);
          }
        }
      }
    }
  }
  
  // Handle expressions that might contain a composite literal
  if (expr.tag === 'expr' && expr.body) {
    for (const item of expr.body) {
      if (item.tag === 'structlit') {
        extractPropertiesFromExpr(item, properties, source);
      } else if (item.tag === 'index' && item.container && item.container.value === 'map') {
        // This is a map[string]interface{} type declaration
        // Look for the following structlit
        continue;
      }
    }
  }
}

function getPropertyInfo(value) {
  if (!value) return { type: 'any' };
  
  // Handle direct values
  if (value.tag === 'string') {
    return { type: 'string' };
  }
  
  if (value.tag === 'number') {
    return { type: 'number' };
  }
  
  if (value.tag === 'ident') {
    // Check for boolean constants
    if (value.value === 'true' || value.value === 'false') {
      return { type: 'boolean' };
    }
    if (value.value === 'nil') {
      return { type: 'null' };
    }
    // Otherwise it's a variable reference
    return { type: 'any' };
  }
  
  // Handle index nodes (map[string]interface{})
  if (value.tag === 'index' && value.container && value.container.value === 'map') {
    // This indicates the start of a map literal, look for following structlit
    return { type: 'object', properties: {} };
  }
  
  // Handle expressions
  if (value.tag === 'expr' && value.body && value.body.length > 0) {
    const firstItem = value.body[0];
    
    // Check for literals
    if (firstItem.tag === 'string') return { type: 'string' };
    if (firstItem.tag === 'number') return { type: 'number' };
    if (firstItem.tag === 'ident') {
      if (firstItem.value === 'true' || firstItem.value === 'false') return { type: 'boolean' };
      if (firstItem.value === 'nil') return { type: 'null' };
    }
    
    // Check for array literals
    if (firstItem.tag === 'arraylit') {
      return {
        type: 'array',
        items: { type: 'any' }
      };
    }
    
    // Check for map declarations followed by struct literals
    if (firstItem.tag === 'index' && firstItem.container && firstItem.container.value === 'map') {
      // Look for the structlit that follows
      const structlit = value.body.find(item => item.tag === 'structlit');
      if (structlit && structlit.fields) {
        const nestedProps = {};
        // Inline the property extraction for nested objects
        for (const field of structlit.fields) {
          if (field.name) {
            nestedProps[field.name] = getPropertyInfo(field.value);
          } else if (field.value && field.value.tag === 'expr' && field.value.body) {
            // Handle map literal fields
            const keyNode = field.value.body[0];
            const colonNode = field.value.body[1];
            const valueNode = field.value.body[2];
            
            if (keyNode && keyNode.tag === 'string' && colonNode && colonNode.value === ':') {
              const key = keyNode.value.slice(1, -1);
              
              // For nested maps, handle map declaration followed by structlit
              if (valueNode && valueNode.tag === 'index' && valueNode.container && valueNode.container.value === 'map') {
                const remainingNodes = field.value.body.slice(3);
                const structlit = remainingNodes.find(node => node.tag === 'structlit');
                if (structlit) {
                  nestedProps[key] = getPropertyInfo(structlit);
                } else {
                  nestedProps[key] = { type: 'object', properties: {} };
                }
              } else if (valueNode) {
                nestedProps[key] = getPropertyInfo(valueNode);
              }
            }
          }
        }
        return {
          type: 'object',
          properties: nestedProps
        };
      }
    }
    
    // Check for struct/map literals  
    if (firstItem.tag === 'structlit') {
      const nestedProps = {};
      if (firstItem.fields) {
        for (const field of firstItem.fields) {
          if (field.name) {
            nestedProps[field.name] = getPropertyInfo(field.value);
          } else if (field.value && field.value.tag === 'expr' && field.value.body) {
            // Handle map literal fields
            const keyNode = field.value.body[0];
            const colonNode = field.value.body[1];
            const valueNode = field.value.body[2];
            
            if (keyNode && keyNode.tag === 'string' && colonNode && colonNode.value === ':') {
              const key = keyNode.value.slice(1, -1);
              
              // For nested maps, handle map declaration followed by structlit
              if (valueNode && valueNode.tag === 'index' && valueNode.container && valueNode.container.value === 'map') {
                const remainingNodes = field.value.body.slice(3);
                const structlit = remainingNodes.find(node => node.tag === 'structlit');
                if (structlit) {
                  nestedProps[key] = getPropertyInfo(structlit);
                } else {
                  nestedProps[key] = { type: 'object', properties: {} };
                }
              } else if (valueNode) {
                nestedProps[key] = getPropertyInfo(valueNode);
              }
            }
          }
        }
      }
      return {
        type: 'object',
        properties: nestedProps
      };
    }
  }
  
  // Handle array literals
  if (value.tag === 'arraylit') {
    return {
      type: 'array',
      items: { type: 'any' }
    };
  }
  
  // Handle struct literals (nested objects)
  if (value.tag === 'structlit') {
    const nestedProps = {};
    if (value.fields) {
      for (const field of value.fields) {
        if (field.name) {
          nestedProps[field.name] = getPropertyInfo(field.value);
        } else if (field.value && field.value.tag === 'expr' && field.value.body) {
          // Handle map literal fields
          const keyNode = field.value.body[0];
          const colonNode = field.value.body[1];
          const valueNode = field.value.body[2];
          
          if (keyNode && keyNode.tag === 'string' && colonNode && colonNode.value === ':') {
            const key = keyNode.value.slice(1, -1);
            
            // For nested maps, handle map declaration followed by structlit
            if (valueNode && valueNode.tag === 'index' && valueNode.container && valueNode.container.value === 'map') {
              const remainingNodes = field.value.body.slice(3);
              const structlit = remainingNodes.find(node => node.tag === 'structlit');
              if (structlit) {
                nestedProps[key] = getPropertyInfo(structlit);
              } else {
                nestedProps[key] = { type: 'object', properties: {} };
              }
            } else if (valueNode) {
              nestedProps[key] = getPropertyInfo(valueNode);
            }
          }
        }
      }
    }
    return {
      type: 'object',
      properties: nestedProps
    };
  }
  
  // Default to any type
  return { type: 'any' };
}

module.exports = { analyzeGoFile };
