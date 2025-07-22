/**
 * @fileoverview Event extraction logic for different analytics providers
 * @module analyze/typescript/extractors/event-extractor
 */

const ts = require('typescript');
const { extractProperties } = require('./property-extractor');
const { resolveIdentifierToInitializer } = require('../utils/type-resolver');

/**
 * Event data structure
 * @typedef {Object} EventData
 * @property {string|null} eventName - The event name
 * @property {Object|null} propertiesNode - AST node containing event properties
 */

/**
 * Provider-specific extraction strategies
 */
const EXTRACTION_STRATEGIES = {
  googleanalytics: extractGoogleAnalyticsEvent,
  snowplow: extractSnowplowEvent,
  mparticle: extractMparticleEvent,
  gtm: extractGTMEvent,
  custom: extractCustomEvent,
  default: extractDefaultEvent
};

/**
 * Extracts event information from a CallExpression node
 * @param {Object} node - TypeScript CallExpression node
 * @param {string} source - Analytics provider source
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @param {Object} customConfig - Custom configuration for custom extraction
 * @returns {EventData} Extracted event data
 */
function extractEventData(node, source, checker, sourceFile, customConfig) {
  const strategy = EXTRACTION_STRATEGIES[source] || EXTRACTION_STRATEGIES.default;
  if (source === 'custom') {
    return strategy(node, checker, sourceFile, customConfig);
  }
  return strategy(node, checker, sourceFile);
}

/**
 * Extracts Google Analytics event data
 * @param {Object} node - CallExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {EventData}
 */
function extractGoogleAnalyticsEvent(node, checker, sourceFile) {
  if (!node.arguments || node.arguments.length < 3) {
    return { eventName: null, propertiesNode: null };
  }

  // gtag('event', 'event_name', { properties })
  const eventName = getStringValue(node.arguments[1], checker, sourceFile);
  const propertiesNode = node.arguments[2];

  return { eventName, propertiesNode };
}

/**
 * Extracts Snowplow event data
 * @param {Object} node - CallExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {EventData}
 */
function extractSnowplowEvent(node, checker, sourceFile) {
  if (!node.arguments || node.arguments.length === 0) {
    return { eventName: null, propertiesNode: null };
  }

  // tracker.track(buildStructEvent({ action: 'event_name', ... }))
  const firstArg = node.arguments[0];
  
  // Check if it's a direct buildStructEvent call
  if (ts.isCallExpression(firstArg) && 
      ts.isIdentifier(firstArg.expression) && 
      firstArg.expression.escapedText === 'buildStructEvent' &&
      firstArg.arguments.length > 0) {
    const structEventArg = firstArg.arguments[0];
    if (ts.isObjectLiteralExpression(structEventArg)) {
      const actionProperty = findPropertyByKey(structEventArg, 'action');
      const eventName = actionProperty ? getStringValue(actionProperty.initializer, checker, sourceFile) : null;
      return { eventName, propertiesNode: structEventArg };
    }
  }
  // Check if it's a variable reference
  else if (ts.isIdentifier(firstArg)) {
    const resolvedNode = resolveIdentifierToInitializer(checker, firstArg, sourceFile);
    if (resolvedNode && ts.isCallExpression(resolvedNode) &&
        ts.isIdentifier(resolvedNode.expression) &&
        resolvedNode.expression.escapedText === 'buildStructEvent' &&
        resolvedNode.arguments.length > 0) {
      const structEventArg = resolvedNode.arguments[0];
      if (ts.isObjectLiteralExpression(structEventArg)) {
        const actionProperty = findPropertyByKey(structEventArg, 'action');
        const eventName = actionProperty ? getStringValue(actionProperty.initializer, checker, sourceFile) : null;
        return { eventName, propertiesNode: structEventArg };
      }
    }
  }

  return { eventName: null, propertiesNode: null };
}

/**
 * Extracts mParticle event data
 * @param {Object} node - CallExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {EventData}
 */
function extractMparticleEvent(node, checker, sourceFile) {
  if (!node.arguments || node.arguments.length < 3) {
    return { eventName: null, propertiesNode: null };
  }

  // mParticle.logEvent('event_name', mParticle.EventType.Navigation, { properties })
  const eventName = getStringValue(node.arguments[0], checker, sourceFile);
  const propertiesNode = node.arguments[2];

  return { eventName, propertiesNode };
}

/**
 * Extracts Google Tag Manager event data
 * @param {Object} node - CallExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {EventData}
 */
function extractGTMEvent(node, checker, sourceFile) {
  if (!node.arguments || node.arguments.length === 0) {
    return { eventName: null, propertiesNode: null };
  }

  // dataLayer.push({ event: 'event_name', property1: 'value1', property2: 'value2' })
  const firstArg = node.arguments[0];
  
  if (!ts.isObjectLiteralExpression(firstArg)) {
    return { eventName: null, propertiesNode: null };
  }

  // Find the 'event' property
  const eventProperty = findPropertyByKey(firstArg, 'event');
  if (!eventProperty) {
    return { eventName: null, propertiesNode: null };
  }

  const eventName = getStringValue(eventProperty.initializer, checker, sourceFile);
  
  // Create a modified properties node without the 'event' property
  const modifiedProperties = firstArg.properties.filter(prop => {
    if (ts.isPropertyAssignment(prop) && prop.name) {
      if (ts.isIdentifier(prop.name)) {
        return prop.name.escapedText !== 'event';
      }
      if (ts.isStringLiteral(prop.name)) {
        return prop.name.text !== 'event';
      }
    }
    return true;
  });

  // Create a synthetic object literal with the filtered properties
  const modifiedPropertiesNode = ts.factory.createObjectLiteralExpression(modifiedProperties);
  
  // Copy source positions for proper analysis
  if (firstArg.pos !== undefined) {
    modifiedPropertiesNode.pos = firstArg.pos;
  }
  if (firstArg.end !== undefined) {
    modifiedPropertiesNode.end = firstArg.end;
  }

  return { eventName, propertiesNode: modifiedPropertiesNode };
}

/**
 * Custom extraction
 * @param {Object} node - CallExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @param {Object} customConfig - Custom configuration for custom extraction
 * @returns {EventData}
 */
function extractCustomEvent(node, checker, sourceFile, customConfig) {
  const args = node.arguments || [];

  const eventArg = args[customConfig?.eventIndex ?? 0];
  const propertiesArg = args[customConfig?.propertiesIndex ?? 1];

  const eventName = getStringValue(eventArg, checker, sourceFile);

  const extraArgs = {};
  if (customConfig && customConfig.extraParams) {
    customConfig.extraParams.forEach(extra => {
      extraArgs[extra.name] = args[extra.idx];
    });
  }

  return { eventName, propertiesNode: propertiesArg, extraArgs };
}

/**
 * Default event extraction for standard providers
 * @param {Object} node - CallExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {EventData}
 */
function extractDefaultEvent(node, checker, sourceFile) {
  if (!node.arguments || node.arguments.length < 2) {
    return { eventName: null, propertiesNode: null };
  }

  // provider.track('event_name', { properties })
  const eventName = getStringValue(node.arguments[0], checker, sourceFile);
  const propertiesNode = node.arguments[1];

  return { eventName, propertiesNode };
}

/**
 * Processes extracted event data into final event object
 * @param {EventData} eventData - Raw event data
 * @param {string} source - Analytics source
 * @param {string} filePath - File path
 * @param {number} line - Line number
 * @param {string} functionName - Containing function name
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @param {Object} customConfig - Custom configuration for custom extraction
 * @returns {Object|null} Processed event object or null
 */
function processEventData(eventData, source, filePath, line, functionName, checker, sourceFile, customConfig) {
  const { eventName, propertiesNode } = eventData;

  // Require an event name – properties are optional.
  if (!eventName) {
    return null;
  }

  let properties = {};

  if (propertiesNode) {
    // Check if properties is an object literal
    if (ts.isObjectLiteralExpression(propertiesNode)) {
      properties = extractProperties(checker, propertiesNode);
    }
    // Check if properties is an identifier (variable reference)
    else if (ts.isIdentifier(propertiesNode)) {
      const resolvedNode = resolveIdentifierToInitializer(checker, propertiesNode, sourceFile);
      if (resolvedNode && ts.isObjectLiteralExpression(resolvedNode)) {
        properties = extractProperties(checker, resolvedNode);
      }
    }
  }

  // Special handling for Snowplow: remove 'action' from properties
  if (source === 'snowplow' && properties.action) {
    delete properties.action;
  }

  // Clean up any unresolved type markers
  const cleanedProperties = cleanupProperties(properties);

  // Handle custom extra params
  if (source === 'custom' && customConfig && eventData.extraArgs) {
    for (const [paramName, argNode] of Object.entries(eventData.extraArgs)) {
      if (argNode && ts.isObjectLiteralExpression(argNode)) {
        // Extract detailed properties from object literal expression
        cleanedProperties[paramName] = {
          type: 'object',
          properties: extractProperties(checker, argNode)
        };
      } else if (argNode && ts.isIdentifier(argNode)) {
        // Handle identifier references to objects
        const resolvedNode = resolveIdentifierToInitializer(checker, argNode, sourceFile);
        if (resolvedNode && ts.isObjectLiteralExpression(resolvedNode)) {
          cleanedProperties[paramName] = {
            type: 'object',
            properties: extractProperties(checker, resolvedNode)
          };
        } else {
          cleanedProperties[paramName] = {
            type: inferNodeValueType(argNode)
          };
        }
      } else {
        // For non-object arguments, use simple type inference
        cleanedProperties[paramName] = {
          type: inferNodeValueType(argNode)
        };
      }
    }
  }

  return {
    eventName,
    source,
    properties: cleanedProperties,
    filePath,
    line,
    functionName
  };
}

/**
 * Gets string value from a TypeScript AST node
 * @param {Object} node - TypeScript AST node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {string|null} String value or null
 */
function getStringValue(node, checker, sourceFile) {
  if (!node) return null;
  
  // Handle string literals (existing behavior)
  if (ts.isStringLiteral(node)) {
    return node.text;
  }
  
  // Handle property access expressions like TRACKING_EVENTS.ECOMMERCE_PURCHASE
  if (ts.isPropertyAccessExpression(node)) {
    return resolvePropertyAccessToString(node, checker, sourceFile);
  }
  
  // Handle identifiers that might reference constants
  if (ts.isIdentifier(node)) {
    return resolveIdentifierToString(node, checker, sourceFile);
  }
  
  return null;
}

/**
 * Resolves a property access expression to its string value
 * @param {Object} node - PropertyAccessExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {string|null} String value or null
 */
function resolvePropertyAccessToString(node, checker, sourceFile) {
  try {
    // Get the symbol for the property access
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol && symbol.valueDeclaration) {
      // Check if it's a property assignment with a string initializer
      if (ts.isPropertyAssignment(symbol.valueDeclaration) &&
          symbol.valueDeclaration.initializer &&
          ts.isStringLiteral(symbol.valueDeclaration.initializer)) {
        return symbol.valueDeclaration.initializer.text;
      }

      // Check if it's a variable declaration property (string literal type)
      if (ts.isPropertySignature(symbol.valueDeclaration) ||
          ts.isMethodSignature(symbol.valueDeclaration)) {
        const type = checker.getTypeAtLocation(node);
        if (type && type.isStringLiteral && type.isStringLiteral()) {
          return type.value;
        }
      }
    }

    // ---------------------------------------------------------------------
    // Fallback – manually resolve patterns like:
    //   const CONST = { KEY: 'value' };
    //   const CONST = Object.freeze({ KEY: 'value' });
    // And later used as CONST.KEY
    // ---------------------------------------------------------------------
    if (ts.isIdentifier(node.expression)) {
      const objIdentifier = node.expression;
      const initializer = resolveIdentifierToInitializer(checker, objIdentifier, sourceFile);
      if (initializer) {
        let objectLiteral = null;

        // Handle direct object literal initializers
        if (ts.isObjectLiteralExpression(initializer)) {
          objectLiteral = initializer;
        }
        // Handle Object.freeze({ ... }) pattern
        else if (ts.isCallExpression(initializer)) {
          const callee = initializer.expression;
          if (
            ts.isPropertyAccessExpression(callee) &&
            ts.isIdentifier(callee.expression) &&
            callee.expression.escapedText === 'Object' &&
            callee.name.escapedText === 'freeze' &&
            initializer.arguments.length > 0 &&
            ts.isObjectLiteralExpression(initializer.arguments[0])
          ) {
            objectLiteral = initializer.arguments[0];
          }
        }

        if (objectLiteral) {
          const propNode = findPropertyByKey(objectLiteral, node.name.escapedText || node.name.text);
          if (propNode && propNode.initializer && ts.isStringLiteral(propNode.initializer)) {
            return propNode.initializer.text;
          }
        }
      }
    }

    // Final fallback – use type information at location (works for imported Object.freeze constants)
    try {
      const t = checker.getTypeAtLocation(node);
      if (t && t.isStringLiteral && typeof t.isStringLiteral === 'function' && t.isStringLiteral()) {
        return t.value;
      }
      if (t && t.flags && (t.flags & ts.TypeFlags.StringLiteral)) {
        return t.value;
      }
    } catch (_) {/* ignore */}

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Resolves an identifier to its string value
 * @param {Object} node - Identifier node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} sourceFile - TypeScript source file
 * @returns {string|null} String value or null
 */
function resolveIdentifierToString(node, checker, sourceFile) {
  try {
    const symbol = checker.getSymbolAtLocation(node);
    if (!symbol) {
      return null;
    }
    
    // First try to resolve through value declaration
    if (symbol.valueDeclaration) {
      const declaration = symbol.valueDeclaration;
      
      // Handle variable declarations with string literal initializers
      if (ts.isVariableDeclaration(declaration) && 
          declaration.initializer &&
          ts.isStringLiteral(declaration.initializer)) {
        return declaration.initializer.text;
      }
      
      // Handle const declarations with object literals containing string properties
      if (ts.isVariableDeclaration(declaration) && 
          declaration.initializer &&
          ts.isObjectLiteralExpression(declaration.initializer)) {
        // This case is handled by property access resolution
        return null;
      }
    }
    
    // If value declaration doesn't exist or doesn't help, try type resolution
    // This handles imported constants that are resolved through TypeScript's type system
    const type = checker.getTypeOfSymbolAtLocation(symbol, node);
    if (type && type.isStringLiteral && typeof type.isStringLiteral === 'function' && type.isStringLiteral()) {
      return type.value;
    }
    
    // Alternative approach for string literal types (different TypeScript versions)
    if (type && type.flags && (type.flags & ts.TypeFlags.StringLiteral)) {
      return type.value;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Finds a property by key in an ObjectLiteralExpression
 * @param {Object} objectNode - ObjectLiteralExpression node
 * @param {string} key - Property key to find
 * @returns {Object|null} Property node or null
 */
function findPropertyByKey(objectNode, key) {
  if (!objectNode.properties) return null;
  
  return objectNode.properties.find(prop => {
    if (prop.name) {
      if (ts.isIdentifier(prop.name)) {
        return prop.name.escapedText === key;
      }
      if (ts.isStringLiteral(prop.name)) {
        return prop.name.text === key;
      }
    }
    return false;
  });
}

/**
 * Cleans up properties by removing unresolved type markers
 * @param {Object} properties - Properties object
 * @returns {Object} Cleaned properties
 */
function cleanupProperties(properties) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(properties)) {
    if (value && typeof value === 'object') {
      // Remove __unresolved marker
      if (value.__unresolved) {
        delete value.__unresolved;
      }
      
      // Recursively clean nested properties
      if (value.properties) {
        value.properties = cleanupProperties(value.properties);
      }
      
      // Clean array item properties
      if (value.type === 'array' && value.items && value.items.properties) {
        value.items.properties = cleanupProperties(value.items.properties);
      }
      
      cleaned[key] = value;
    } else {
      cleaned[key] = value;
    }
  }
  
  return cleaned;
}

function inferNodeValueType(node) {
  if (!node) return 'any';
  if (ts.isStringLiteral(node)) return 'string';
  if (ts.isNumericLiteral(node)) return 'number';
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return 'boolean';
  if (ts.isArrayLiteralExpression(node)) return 'array';
  if (ts.isObjectLiteralExpression(node)) return 'object';
  return 'any';
}

module.exports = {
  extractEventData,
  processEventData
};
