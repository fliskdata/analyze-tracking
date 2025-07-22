/**
 * @fileoverview Property extraction utilities for Swift analytics tracking
 * @module analyze/swift/extractors/property-extractor
 */

const { SWIFT_TYPE_MAPPINGS, LITERAL_TYPE_PATTERNS } = require('../constants');

/**
 * Extracts properties from Swift tracking call arguments
 * @param {Array} args - Array of Swift AST argument expressions
 * @param {string} source - Analytics source (e.g., 'segment', 'mixpanel')
 * @param {Object} customConfig - Custom configuration for property extraction
 * @param {Object} variableContext - Context for variable resolution
 * @returns {Object} Object containing extracted properties with their type information
 */
function extractProperties(args, source, customConfig = null, variableContext = {}) {
  if (!Array.isArray(args) || args.length === 0) {
    return {};
  }

  // Different providers have properties in different argument positions
  const propertiesArg = findPropertiesArgument(args, source, customConfig);
  
  if (!propertiesArg) {
    return {};
  }

  return extractPropertiesFromDictionary(propertiesArg, variableContext);
}

/**
 * Finds the properties argument based on the analytics source
 * @param {Array} args - Array of Swift AST argument expressions
 * @param {string} source - Analytics source
 * @param {Object} customConfig - Custom configuration
 * @returns {Object|null} Properties argument AST node or null
 */
function findPropertiesArgument(args, source, customConfig) {
  // Handle custom functions with specific configurations
  if (source === 'custom' && customConfig) {
    const propertiesIndex = customConfig.propertiesIndex || 1;
    return args[propertiesIndex] || null;
  }

  // Handle built-in providers
  switch (source) {
    case 'segment':
    case 'rudderstack':
    case 'posthog':
    case 'pendo':
    case 'heap':
      // Analytics.shared().track("event", properties: [...])
      return findArgumentByLabel(args, 'properties') || args[1];
      
    case 'mixpanel':
      // Mixpanel.mainInstance().track(event: "event", properties: [...])
      return findArgumentByLabel(args, 'properties') || args[1];
      
    case 'amplitude':
      // amplitude.track(eventType: "event", eventProperties: [...])
      return findArgumentByLabel(args, 'eventProperties') || args[1];
      
    case 'mparticle':
      // MParticle.sharedInstance().logEvent("event", eventType: .other, eventInfo: [...])
      return findArgumentByLabel(args, 'eventInfo') || args[2];
      
    case 'snowplow':
      // Special handling for Snowplow structured events
      return extractSnowplowProperties(args);
      
    case 'firebase':
      // Analytics.logEvent("event", parameters: [...])
      return findArgumentByLabel(args, 'parameters') || args[1];
      
    default:
      // Default to second argument
      return args[1] || null;
  }
}

/**
 * Finds an argument by its label name
 * @param {Array} args - Array of Swift AST argument expressions
 * @param {string} label - Label name to search for
 * @returns {Object|null} Argument expression or null
 */
function findArgumentByLabel(args, label) {
  for (const arg of args) {
    if (arg.label && arg.label === label) {
      return arg.expression || arg.value;
    }
  }
  return null;
}

/**
 * Extracts properties from a dictionary literal expression
 * @param {Object} dictExpr - Swift AST dictionary expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {Object} Extracted properties with type information
 */
function extractPropertiesFromDictionary(dictExpr, variableContext = {}) {
  const properties = {};
  
  if (!dictExpr) return properties;

  // Handle dictionary literal expressions
  if (dictExpr.kind === 'DictionaryExpr') {
    return extractFromDictionaryLiteral(dictExpr, variableContext);
  }

  // Handle variable references
  if (dictExpr.kind === 'UnresolvedDeclRefExpr' || dictExpr.kind === 'DeclRefExpr') {
    const varName = extractIdentifierName(dictExpr);
    if (varName && variableContext[varName]) {
      return extractPropertiesFromDictionary(variableContext[varName], variableContext);
    }
  }

  // Handle member access (e.g., self.properties)
  if (dictExpr.kind === 'MemberAccessExpr') {
    return handleMemberAccess(dictExpr, variableContext);
  }

  return properties;
}

/**
 * Extracts properties from a dictionary literal
 * @param {Object} dictLiteral - Swift AST dictionary literal
 * @param {Object} variableContext - Context for variable resolution
 * @returns {Object} Extracted properties
 */
function extractFromDictionaryLiteral(dictLiteral, variableContext) {
  const properties = {};
  
  if (!dictLiteral.elements || !Array.isArray(dictLiteral.elements)) {
    return properties;
  }

  for (const element of dictLiteral.elements) {
    const entry = extractDictionaryEntry(element, variableContext);
    if (entry && entry.key && entry.value) {
      properties[entry.key] = entry.value;
    }
  }

  return properties;
}

/**
 * Extracts a key-value pair from a dictionary element
 * @param {Object} element - Swift AST dictionary element
 * @param {Object} variableContext - Context for variable resolution
 * @returns {Object|null} Key-value pair or null
 */
function extractDictionaryEntry(element, variableContext) {
  if (!element) return null;

  // Handle tuple expressions (key: value)
  if (element.kind === 'TupleExpr' && element.elements && element.elements.length >= 2) {
    const keyExpr = element.elements[0];
    const valueExpr = element.elements[1];
    
    const key = extractStringValue(keyExpr, variableContext);
    const value = extractPropertyValue(valueExpr, variableContext);
    
    if (key && value) {
      return { key, value };
    }
  }

  // Handle labeled expressions
  if (element.label && element.expression) {
    const key = element.label;
    const value = extractPropertyValue(element.expression, variableContext);
    
    if (key && value) {
      return { key, value };
    }
  }

  return null;
}

/**
 * Extracts property value and determines its type
 * @param {Object} valueExpr - Swift AST value expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {Object|null} Property value with type information
 */
function extractPropertyValue(valueExpr, variableContext) {
  if (!valueExpr) return null;

  // Handle literals
  const literalValue = extractLiteralValue(valueExpr);
  if (literalValue !== null) {
    return literalValue;
  }

  // Handle variable references
  if (valueExpr.kind === 'UnresolvedDeclRefExpr' || valueExpr.kind === 'DeclRefExpr') {
    const varName = extractIdentifierName(valueExpr);
    if (varName && variableContext[varName]) {
      return extractPropertyValue(variableContext[varName], variableContext);
    }
    // Return 'any' for unresolved variables
    return { type: 'any' };
  }

  // Handle member access
  if (valueExpr.kind === 'MemberAccessExpr') {
    return handleMemberAccess(valueExpr, variableContext);
  }

  // Handle function calls
  if (valueExpr.kind === 'CallExpr') {
    return { type: 'any' }; // Function call results are 'any'
  }

  // Handle array expressions
  if (valueExpr.kind === 'ArrayExpr') {
    return { type: 'array' };
  }

  // Handle dictionary expressions
  if (valueExpr.kind === 'DictionaryExpr') {
    const nestedProperties = extractFromDictionaryLiteral(valueExpr, variableContext);
    return {
      type: 'object',
      properties: nestedProperties
    };
  }

  // Default to 'any' for unknown expressions
  return { type: 'any' };
}

/**
 * Extracts literal values and determines their types
 * @param {Object} literalExpr - Swift AST literal expression
 * @returns {Object|null} Literal value with type or null
 */
function extractLiteralValue(literalExpr) {
  if (!literalExpr) return null;

  // Handle string literals
  if (literalExpr.kind === 'StringLiteralExpr') {
    return { type: 'string' };
  }

  // Handle integer literals
  if (literalExpr.kind === 'IntegerLiteralExpr') {
    return { type: 'number' };
  }

  // Handle float literals
  if (literalExpr.kind === 'FloatLiteralExpr') {
    return { type: 'number' };
  }

  // Handle boolean literals
  if (literalExpr.kind === 'BooleanLiteralExpr') {
    return { type: 'boolean' };
  }

  // Handle nil literals
  if (literalExpr.kind === 'NilLiteralExpr') {
    return { type: 'null' };
  }

  // Check for literal patterns in raw text
  if (literalExpr.value || literalExpr.text) {
    const text = literalExpr.value || literalExpr.text;
    
    for (const [type, pattern] of Object.entries(LITERAL_TYPE_PATTERNS)) {
      if (pattern.test(text)) {
        return { type };
      }
    }
  }

  return null;
}

/**
 * Extracts string value from various expression types
 * @param {Object} expr - Swift AST expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {string|null} String value or null
 */
function extractStringValue(expr, variableContext) {
  if (!expr) return null;

  // Handle string literals
  if (expr.kind === 'StringLiteralExpr') {
    return expr.value || expr.text;
  }

  // Handle variable references
  if (expr.kind === 'UnresolvedDeclRefExpr' || expr.kind === 'DeclRefExpr') {
    const varName = extractIdentifierName(expr);
    if (varName && variableContext[varName]) {
      return extractStringValue(variableContext[varName], variableContext);
    }
  }

  return null;
}

/**
 * Handles member access expressions
 * @param {Object} memberExpr - Swift AST member access expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {Object} Property value with type information
 */
function handleMemberAccess(memberExpr, variableContext) {
  // For now, treat member access as 'any' type
  // Could be enhanced to resolve member types from context
  return { type: 'any' };
}

/**
 * Extracts identifier name from declaration reference
 * @param {Object} declRef - Swift AST declaration reference
 * @returns {string|null} Identifier name or null
 */
function extractIdentifierName(declRef) {
  if (!declRef) return null;

  if (declRef.identifier && declRef.identifier.name) {
    return declRef.identifier.name;
  }

  if (declRef.name) {
    return declRef.name;
  }

  return null;
}

/**
 * Special handling for Snowplow structured events
 * @param {Array} args - Array of Swift AST argument expressions
 * @returns {Object|null} Snowplow properties or null
 */
function extractSnowplowProperties(args) {
  // Snowplow uses structured events with named properties
  // Look for struct initialization arguments
  const properties = {};
  
  for (const arg of args) {
    if (arg.label) {
      const value = extractPropertyValue(arg.expression || arg.value, {});
      if (value) {
        properties[arg.label] = value;
      }
    }
  }

  return Object.keys(properties).length > 0 ? { type: 'object', properties } : null;
}

module.exports = {
  extractProperties
};