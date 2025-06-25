/**
 * @fileoverview Property extraction utilities for Go analytics tracking
 * @module analyze/go/propertyExtractor
 */

const { ANALYTICS_SOURCES } = require('./constants');
const { extractStringValue, findStructLiteral, findStructField, extractFieldName, mapGoTypeToSchemaType } = require('./utils');

/**
 * Extract properties from a tracking call based on the source
 * @param {Object} callNode - AST node representing a function call or struct literal
 * @param {string} source - Analytics source (e.g., 'segment', 'amplitude')
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 * @param {Object} customConfig - Custom configuration for property extraction
 * @returns {Object} Object containing extracted properties with their type information
 */
function extractProperties(callNode, source, typeContext, currentFunction, customConfig) {
  const properties = {};
  
  switch (source) {
    case ANALYTICS_SOURCES.MIXPANEL:
      extractMixpanelProperties(callNode, properties, typeContext, currentFunction);
      break;
      
    case ANALYTICS_SOURCES.SEGMENT:
    case ANALYTICS_SOURCES.POSTHOG:
      extractSegmentPosthogProperties(callNode, properties, source, typeContext, currentFunction);
      break;
      
    case ANALYTICS_SOURCES.AMPLITUDE:
      extractAmplitudeProperties(callNode, properties, typeContext, currentFunction);
      break;
      
    case ANALYTICS_SOURCES.SNOWPLOW:
      extractSnowplowProperties(callNode, properties, typeContext, currentFunction);
      break;
      
    case ANALYTICS_SOURCES.CUSTOM:
      extractCustomProperties(callNode, properties, typeContext, currentFunction, customConfig);
      break;
  }
  
  return properties;
}

/**
 * Extract Mixpanel properties
 * Pattern: mp.Track(ctx, []*mixpanel.Event{mp.NewEvent("event_name", "distinctId", map[string]any{...})})
 * @param {Object} callNode - AST node for Mixpanel tracking call
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractMixpanelProperties(callNode, properties, typeContext, currentFunction) {
  if (callNode.args && callNode.args.length > 1) {
    const arrayArg = callNode.args[1];
    if (arrayArg.tag === 'expr' && arrayArg.body) {
      const arrayLit = arrayArg.body.find(item => item.tag === 'arraylit');
      if (arrayLit && arrayLit.items && arrayLit.items.length > 0) {
        const firstItem = arrayLit.items[0];
        if (Array.isArray(firstItem)) {
          // Look for mp.NewEvent pattern and extract properties
          let foundNewEvent = false;
          for (let i = 0; i < firstItem.length - 4; i++) {
            if (firstItem[i].tag === 'ident' && firstItem[i].value === 'mp' &&
                firstItem[i+1].tag === 'sigil' && firstItem[i+1].value === '.' &&
                firstItem[i+2].tag === 'ident' && firstItem[i+2].value === 'NewEvent' &&
                firstItem[i+3].tag === 'sigil' && firstItem[i+3].value === '(') {
              // Found mp.NewEvent( - process arguments
              let j = i + 4;
              let commaCount = 0;
              
              // Skip the first argument (event name)
              while (j < firstItem.length && commaCount < 1) {
                if (firstItem[j].tag === 'sigil' && firstItem[j].value === ',') {
                  commaCount++;
                }
                j++;
              }
              
              // Extract the second argument (DistinctId)
              if (j < firstItem.length) {
                // Skip whitespace
                while (j < firstItem.length && firstItem[j].tag === 'newline') {
                  j++;
                }
                
                if (firstItem[j]) {
                  if (firstItem[j].tag === 'string') {
                    // It's a string literal
                    const distinctId = firstItem[j].value.slice(1, -1); // Remove quotes
                    if (distinctId !== '') { // Only add if not empty string
                      properties['DistinctId'] = { type: 'string' };
                    }
                  } else if (firstItem[j].tag === 'ident') {
                    // It's a variable reference - look up its type
                    properties['DistinctId'] = getPropertyInfo(firstItem[j], typeContext, currentFunction);
                  }
                }
              }
              
              // Continue to find the properties map (third argument)
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
                      // Look for pattern: "key": value
                      for (let k = j + 1; k < firstItem.length - 2; k++) {
                        if (firstItem[k].tag === 'string' && 
                            firstItem[k+1].tag === 'sigil' && firstItem[k+1].value === ':') {
                          const key = firstItem[k].value.slice(1, -1);
                          
                          // Use getPropertyInfo to determine the type
                          const valueToken = firstItem[k+2];
                          properties[key] = getPropertyInfo(valueToken, typeContext, currentFunction);
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
}

/**
 * Extract Segment/PostHog properties
 * Pattern: analytics.Track{UserId: "...", Properties: analytics.NewProperties().Set(...)}
 * @param {Object} callNode - AST node for Segment/PostHog struct literal
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {string} source - Either 'segment' or 'posthog'
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractSegmentPosthogProperties(callNode, properties, source, typeContext, currentFunction) {
  if (callNode.fields) {
    // Extract UserId/DistinctId
    const idField = findStructField(callNode, source === ANALYTICS_SOURCES.SEGMENT ? 'UserId' : 'DistinctId');
    if (idField) {
      properties[source === ANALYTICS_SOURCES.SEGMENT ? 'UserId' : 'DistinctId'] = { type: 'string' };
    }
    
    // Extract Properties
    const propsField = findStructField(callNode, 'Properties');
    if (propsField && propsField.value) {
      extractChainedProperties(propsField.value, properties, typeContext, currentFunction);
    }
  }
}

/**
 * Extract Amplitude properties
 * Pattern: amplitude.Event{UserID: "...", EventProperties: map[string]interface{}{...}}
 * @param {Object} callNode - AST node for Amplitude tracking call
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractAmplitudeProperties(callNode, properties, typeContext, currentFunction) {
  let fields = null;
  
  // For struct literals: amplitude.Event{UserID: "...", EventProperties: map[string]interface{}{...}}
  if (callNode.tag === 'structlit' && callNode.fields) {
    fields = callNode.fields;
  }
  // For function calls: client.Track(amplitude.Event{...})
  else if (callNode.args && callNode.args.length > 0) {
    const eventStruct = findStructLiteral(callNode.args[0]);
    if (eventStruct && eventStruct.fields) {
      fields = eventStruct.fields;
    }
  }
  
  if (fields) {
    // Extract UserID
    const userIdField = findStructField({ fields }, 'UserID');
    if (userIdField) {
      properties['UserID'] = { type: 'string' };
    }
    
    // Extract EventProperties
    const eventPropsField = findStructField({ fields }, 'EventProperties');
    if (eventPropsField) {
      extractPropertiesFromExpr(eventPropsField.value, properties, typeContext, currentFunction);
    }

    // Extract EventOptions
    const eventOptionsField = findStructField({ fields }, 'EventOptions');
    if (eventOptionsField && eventOptionsField.value) {
      extractEventOptions(eventOptionsField.value, properties, typeContext, currentFunction);
    }
  }
}

/**
 * Extract Snowplow properties
 * Pattern: tracker.TrackStructEvent(sp.StructuredEvent{Category: sphelp.NewString("..."), ...})
 * @param {Object} callNode - AST node for Snowplow tracking call
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractSnowplowProperties(callNode, properties, typeContext, currentFunction) {
  if (callNode.args && callNode.args.length > 0) {
    const structEvent = findStructLiteral(callNode.args[0]);
    if (structEvent && structEvent.fields) {
      // Extract all fields except Action (which is the event name)
      for (const field of structEvent.fields) {
        const fieldName = extractFieldName(field);
        if (fieldName && fieldName !== 'Action') {
          // Handle both direct values and sphelp.NewString/NewFloat64 calls
          if (field.value) {
            if (field.value.tag === 'expr' && field.value.body) {
              // Look for sphelp.NewString/NewFloat64 calls
              const callNode = field.value.body.find(item => 
                item.tag === 'call' && 
                item.func && 
                item.func.tag === 'access' && 
                (item.func.member === 'NewString' || item.func.member === 'NewFloat64')
              );
              
              if (callNode && callNode.args && callNode.args.length > 0) {
                const value = callNode.args[0];
                
                // Handle case where value is an expr with the actual value in body[0]
                let actualValue = value;
                if (value.tag === 'expr' && value.body && value.body.length > 0) {
                  actualValue = value.body[0];
                }
                
                // Use getPropertyInfo to handle all value types including variables
                properties[fieldName] = getPropertyInfo(actualValue, typeContext, currentFunction);
              }
            } else {
              // Handle direct values using getPropertyInfo
              properties[fieldName] = getPropertyInfo(field.value, typeContext, currentFunction);
            }
          }
        }
      }
    }
  }
}

/**
 * Extract custom properties
 * Pattern: customFunction("event_name", map[string]interface{}{...})
 * @param {Object} callNode - AST node for custom tracking function call
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 * @param {Object} customConfig - Custom configuration for property extraction
 */
function extractCustomProperties(callNode, properties, typeContext, currentFunction, customConfig) {
  if (!callNode.args || callNode.args.length === 0) return;

  const args = callNode.args;

  const propsIdx = customConfig?.propertiesIndex ?? 1;

  // Extract extra params first (those not event or properties)
  if (customConfig && Array.isArray(customConfig.extraParams)) {
    customConfig.extraParams.forEach(param => {
      const argNode = args[param.idx];
      if (argNode) {
        properties[param.name] = getPropertyInfo(argNode, typeContext, currentFunction);
      }
    });
  }

  // Extract properties map/object (if provided)
  const propsArg = args[propsIdx];
  if (propsArg) {
    extractPropertiesFromExpr(propsArg, properties, typeContext, currentFunction);
  }
}

/**
 * Extract properties from chained method calls (e.g., NewProperties().Set())
 * @param {Object} expr - Expression containing chained method calls
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractChainedProperties(expr, properties, typeContext, currentFunction) {
  if (!expr) return;
  
  // Look for method calls in the expression
  if (expr.tag === 'expr' && expr.body) {
    // Find the NewProperties() call in the chain
    const newPropsCall = expr.body.find(item => 
      item.tag === 'access' && 
      item.struct && 
      item.struct.tag === 'call' && 
      item.struct.func && 
      item.struct.func.tag === 'access' && 
      item.struct.func.member === 'NewProperties'
    );
    
    if (newPropsCall) {
      // Process all items in the body to find Set() calls
      for (const item of expr.body) {
        // Handle both direct Set() calls and Set() calls in access nodes
        if (item.tag === 'call' && item.func) {
          const funcName = item.func.tag === 'ident' ? item.func.value : 
                          (item.func.tag === 'access' ? item.func.member : null);
          
          if (funcName === 'Set' && item.args && item.args.length >= 2) {
            const key = extractStringValue(item.args[0]);
            if (key) {
              const value = item.args[1];
              // Handle different value types
              if (value.tag === 'expr' && value.body) {
                const firstItem = value.body[0];
                properties[key] = getPropertyInfo(firstItem, typeContext, currentFunction);
              } else {
                properties[key] = getPropertyInfo(value, typeContext, currentFunction);
              }
            }
          }
        } else if (item.tag === 'access' && item.struct && item.struct.tag === 'call') {
          // Handle chained Set() calls
          const call = item.struct;
          if (call.func && call.func.tag === 'ident' && call.func.value === 'Set' && call.args && call.args.length >= 2) {
            const key = extractStringValue(call.args[0]);
            if (key) {
              const value = call.args[1];
              // Handle different value types
              if (value.tag === 'expr' && value.body) {
                const firstItem = value.body[0];
                properties[key] = getPropertyInfo(firstItem, typeContext, currentFunction);
              } else {
                properties[key] = getPropertyInfo(value, typeContext, currentFunction);
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Extract EventOptions from Amplitude events
 * @param {Object} eventOptionsValue - AST node for EventOptions value
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractEventOptions(eventOptionsValue, properties, typeContext, currentFunction) {
  // Handle the EventOptions struct literal directly
  if (eventOptionsValue.tag === 'structlit' && eventOptionsValue.fields) {
    // Process each field in EventOptions
    for (const field of eventOptionsValue.fields) {
      if (field.name) {
        properties[field.name] = getPropertyInfo(field.value, typeContext, currentFunction);
      }
    }
    return;
  }
  
  // Navigate through the expression body to find the structlit (old structure)
  if (eventOptionsValue.tag === 'expr' && eventOptionsValue.body) {
    const exprBody = eventOptionsValue.body;
    
    // Look for a structlit in the expression body
    const structlit = exprBody.find(item => item.tag === 'structlit');
    if (structlit && structlit.fields) {
      // Process each field in EventOptions
      for (const field of structlit.fields) {
        if (field.name) {
          properties[field.name] = getPropertyInfo(field.value, typeContext, currentFunction);
        } else if (field.value && field.value.tag === 'expr' && field.value.body) {
          const body = field.value.body;
          if (body.length >= 3 && 
              body[0].tag === 'ident' && 
              body[1].tag === 'op' && 
              body[1].value === ':') {
            const fieldName = body[0].value;
            const value = body[2];
            properties[fieldName] = getPropertyInfo(value, typeContext, currentFunction);
          }
        }
      }
    }
  }
}

/**
 * Extract properties from an expression (handles various forms of property definitions)
 * @param {Object} expr - Expression containing property definitions
 * @param {Object} properties - Object to store extracted properties (modified in place)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractPropertiesFromExpr(expr, properties, typeContext, currentFunction) {
  // Handle struct literals (e.g., Type{field: value})
  if (expr.tag === 'structlit' && expr.fields) {
    for (const field of expr.fields) {
      if (field.name) {
        const propInfo = getPropertyInfo(field.value, typeContext, currentFunction);
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
              properties[key] = getPropertyInfo(structlit, typeContext, currentFunction);
            } else {
              properties[key] = { type: 'object', properties: {} };
            }
          } else if (valueNode) {
            properties[key] = getPropertyInfo(valueNode, typeContext, currentFunction);
          }
        }
      }
    }
  }
  
  // Handle expressions that might contain a composite literal
  if (expr.tag === 'expr' && expr.body) {
    for (const item of expr.body) {
      if (item.tag === 'structlit') {
        extractPropertiesFromExpr(item, properties, typeContext, currentFunction);
      } else if (item.tag === 'index' && item.container && item.container.value === 'map') {
        // This is a map[string]interface{} type declaration
        // Look for the following structlit
        continue;
      }
    }
  }
}

/**
 * Get property information from a value node
 * @param {Object} value - AST value node to analyze
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 * @returns {Object} Type information object with 'type' and optionally 'properties' or 'items'
 */
function getPropertyInfo(value, typeContext, currentFunction) {
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
    // Look up the variable type in the context
    const varName = value.value;
    let varInfo = null;
    
    // Check function parameters first
    if (typeContext && currentFunction && typeContext.functions[currentFunction]) {
      const funcContext = typeContext.functions[currentFunction];
      if (funcContext.params[varName]) {
        varInfo = funcContext.params[varName];
      } else if (funcContext.locals[varName]) {
        varInfo = funcContext.locals[varName];
      }
    }
    
    // Check global variables
    if (!varInfo && typeContext && typeContext.globals[varName]) {
      varInfo = typeContext.globals[varName];
    }
    
    if (varInfo) {
      // If we have a value stored for this variable, analyze it to get nested properties
      if (varInfo.value && varInfo.type && varInfo.type.tag === 'map') {
        // The variable has a map type and a value, extract properties from the value
        const nestedProps = {};
        extractPropertiesFromExpr(varInfo.value, nestedProps, typeContext, currentFunction);
        return {
          type: 'object',
          properties: nestedProps
        };
      }
      // Otherwise just return the type
      return mapGoTypeToSchemaType(varInfo.type);
    }
    
    // Otherwise it's an unknown variable reference
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
            nestedProps[field.name] = getPropertyInfo(field.value, typeContext, currentFunction);
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
                  nestedProps[key] = getPropertyInfo(structlit, typeContext, currentFunction);
                } else {
                  nestedProps[key] = { type: 'object', properties: {} };
                }
              } else if (valueNode) {
                nestedProps[key] = getPropertyInfo(valueNode, typeContext, currentFunction);
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
            nestedProps[field.name] = getPropertyInfo(field.value, typeContext, currentFunction);
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
                  nestedProps[key] = getPropertyInfo(structlit, typeContext, currentFunction);
                } else {
                  nestedProps[key] = { type: 'object', properties: {} };
                }
              } else if (valueNode) {
                nestedProps[key] = getPropertyInfo(valueNode, typeContext, currentFunction);
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
          nestedProps[field.name] = getPropertyInfo(field.value, typeContext, currentFunction);
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
                nestedProps[key] = getPropertyInfo(structlit, typeContext, currentFunction);
              } else {
                nestedProps[key] = { type: 'object', properties: {} };
              }
            } else if (valueNode) {
              nestedProps[key] = getPropertyInfo(valueNode, typeContext, currentFunction);
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

module.exports = {
  extractProperties
};
