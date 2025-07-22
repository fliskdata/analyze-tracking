/**
 * @fileoverview Event extraction utilities for Swift analytics tracking
 * @module analyze/swift/extractors/event-extractor
 */

/**
 * Extracts event name from Swift tracking call arguments
 * @param {Array} args - Array of Swift AST argument expressions
 * @param {string} source - Analytics source (e.g., 'segment', 'mixpanel')
 * @param {Object} customConfig - Custom configuration for event extraction
 * @param {Object} variableContext - Context for variable resolution
 * @returns {string|null} Event name or null
 */
function extractEventName(args, source, customConfig = null, variableContext = {}) {
  if (!Array.isArray(args) || args.length === 0) {
    return null;
  }

  // Find the event name argument based on the analytics source
  const eventArg = findEventArgument(args, source, customConfig);
  
  if (!eventArg) {
    return null;
  }

  return extractStringFromExpression(eventArg, variableContext);
}

/**
 * Finds the event name argument based on the analytics source
 * @param {Array} args - Array of Swift AST argument expressions
 * @param {string} source - Analytics source
 * @param {Object} customConfig - Custom configuration
 * @returns {Object|null} Event argument AST node or null
 */
function findEventArgument(args, source, customConfig) {
  // Handle custom functions with specific configurations
  if (source === 'custom' && customConfig) {
    const eventIndex = customConfig.eventIndex || 0;
    return args[eventIndex] || null;
  }

  // Handle built-in providers
  switch (source) {
    case 'segment':
    case 'rudderstack':
    case 'posthog':
    case 'pendo':
    case 'heap':
      // Analytics.shared().track("event", properties: [...])
      return args[0];
      
    case 'mixpanel':
      // Mixpanel.mainInstance().track(event: "event", properties: [...])
      return findArgumentByLabel(args, 'event') || args[0];
      
    case 'amplitude':
      // amplitude.track(eventType: "event", eventProperties: [...])
      return findArgumentByLabel(args, 'eventType') || args[0];
      
    case 'mparticle':
      // MParticle.sharedInstance().logEvent("event", eventType: .other, eventInfo: [...])
      return args[0];
      
    case 'snowplow':
      // Special handling for Snowplow structured events - action is the event name
      return findArgumentByLabel(args, 'action') || extractSnowplowAction(args);
      
    case 'firebase':
      // Analytics.logEvent("event", parameters: [...])
      return args[0];
      
    default:
      // Default to first argument
      return args[0] || null;
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
 * Extracts string value from various Swift expression types
 * @param {Object} expr - Swift AST expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {string|null} String value or null
 */
function extractStringFromExpression(expr, variableContext = {}) {
  if (!expr) return null;

  // Handle string literals
  if (expr.kind === 'StringLiteralExpr') {
    return extractStringLiteral(expr);
  }

  // Handle variable references
  if (expr.kind === 'UnresolvedDeclRefExpr' || expr.kind === 'DeclRefExpr') {
    const varName = extractIdentifierName(expr);
    if (varName && variableContext[varName]) {
      return extractStringFromExpression(variableContext[varName], variableContext);
    }
    // Return variable name if not resolved
    return varName;
  }

  // Handle member access (e.g., Constants.EVENT_NAME)
  if (expr.kind === 'MemberAccessExpr') {
    return handleMemberAccess(expr, variableContext);
  }

  // Handle function call expressions
  if (expr.kind === 'CallExpr') {
    return handleFunctionCall(expr, variableContext);
  }

  // Handle interpolated string expressions
  if (expr.kind === 'InterpolatedStringLiteralExpr') {
    return handleInterpolatedString(expr, variableContext);
  }

  // For other expression types, try to extract any literal value
  return extractLiteralValue(expr);
}

/**
 * Extracts string value from string literal expressions
 * @param {Object} stringLiteral - Swift AST string literal expression
 * @returns {string|null} String value or null
 */
function extractStringLiteral(stringLiteral) {
  if (!stringLiteral) return null;

  // Try different properties where string value might be stored
  if (stringLiteral.value) {
    return stringLiteral.value;
  }

  if (stringLiteral.text) {
    // Remove quotes if present
    const text = stringLiteral.text;
    if (text.startsWith('"') && text.endsWith('"')) {
      return text.slice(1, -1);
    }
    return text;
  }

  if (stringLiteral.segments && Array.isArray(stringLiteral.segments)) {
    // Handle string segments
    return stringLiteral.segments
      .map(segment => segment.text || segment.value || '')
      .join('');
  }

  return null;
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

  if (declRef.baseName && declRef.baseName.identifier) {
    return declRef.baseName.identifier.name;
  }

  return null;
}

/**
 * Handles member access expressions (e.g., Constants.EVENT_NAME)
 * @param {Object} memberExpr - Swift AST member access expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {string|null} Resolved value or constructed member access string
 */
function handleMemberAccess(memberExpr, variableContext) {
  if (!memberExpr.member || !memberExpr.base) return null;

  const baseName = extractBaseName(memberExpr.base);
  const memberName = extractIdentifierName(memberExpr.member);

  if (baseName && memberName) {
    // Check if we can resolve this from variable context
    const fullPath = `${baseName}.${memberName}`;
    if (variableContext[fullPath]) {
      return extractStringFromExpression(variableContext[fullPath], variableContext);
    }

    // Check if base is in variable context
    if (variableContext[baseName] && variableContext[baseName][memberName]) {
      return extractStringFromExpression(variableContext[baseName][memberName], variableContext);
    }

    // Return the member access as a string for unresolved cases
    return fullPath;
  }

  return null;
}

/**
 * Extracts base name from various expression types
 * @param {Object} base - Swift AST base expression
 * @returns {string|null} Base name or null
 */
function extractBaseName(base) {
  if (!base) return null;

  if (base.kind === 'UnresolvedDeclRefExpr' || base.kind === 'DeclRefExpr') {
    return extractIdentifierName(base);
  }

  if (base.kind === 'MemberAccessExpr') {
    // For nested member access, get the full path
    const baseName = extractBaseName(base.base);
    const memberName = extractIdentifierName(base.member);
    if (baseName && memberName) {
      return `${baseName}.${memberName}`;
    }
  }

  return null;
}

/**
 * Handles function call expressions
 * @param {Object} callExpr - Swift AST call expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {string|null} Function call result or null
 */
function handleFunctionCall(callExpr, variableContext) {
  // For now, return a generic representation
  // Could be enhanced to handle specific function patterns
  const functionName = extractFunctionName(callExpr.calledExpression);
  return functionName ? `${functionName}()` : null;
}

/**
 * Extracts function name from call expression
 * @param {Object} expr - Swift AST expression
 * @returns {string|null} Function name or null
 */
function extractFunctionName(expr) {
  if (!expr) return null;

  if (expr.kind === 'UnresolvedDeclRefExpr' || expr.kind === 'DeclRefExpr') {
    return extractIdentifierName(expr);
  }

  if (expr.kind === 'MemberAccessExpr') {
    return extractIdentifierName(expr.member);
  }

  return null;
}

/**
 * Handles interpolated string expressions
 * @param {Object} interpolatedExpr - Swift AST interpolated string expression
 * @param {Object} variableContext - Context for variable resolution
 * @returns {string|null} Interpolated string value or null
 */
function handleInterpolatedString(interpolatedExpr, variableContext) {
  if (!interpolatedExpr.segments || !Array.isArray(interpolatedExpr.segments)) {
    return null;
  }

  // Try to construct the interpolated string
  let result = '';
  for (const segment of interpolatedExpr.segments) {
    if (segment.kind === 'StringSegment') {
      result += segment.content || segment.text || '';
    } else if (segment.kind === 'ExpressionSegment') {
      const exprValue = extractStringFromExpression(segment.expression, variableContext);
      result += exprValue || '${...}';
    }
  }

  return result || null;
}

/**
 * Extracts literal value from expression
 * @param {Object} expr - Swift AST expression
 * @returns {string|null} Literal value or null
 */
function extractLiteralValue(expr) {
  if (!expr) return null;

  // Try to get any text or value property
  if (expr.value) {
    return String(expr.value);
  }

  if (expr.text) {
    return expr.text;
  }

  return null;
}

/**
 * Special handling for Snowplow action extraction
 * @param {Array} args - Array of Swift AST argument expressions
 * @returns {Object|null} Action argument or null
 */
function extractSnowplowAction(args) {
  // For Snowplow, we look for struct initialization with action field
  for (const arg of args) {
    if (arg.label === 'action') {
      return arg.expression || arg.value;
    }
  }
  return null;
}

/**
 * Processes event data and creates event object
 * @param {string} eventName - Extracted event name
 * @param {Object} properties - Extracted properties
 * @param {string} source - Analytics source
 * @param {string} filePath - Path to the Swift file
 * @param {number} line - Line number of the tracking call
 * @param {string} functionName - Function name containing the tracking call
 * @returns {Object} Event object
 */
function processEventData(eventName, properties, source, filePath, line, functionName) {
  return {
    eventName,
    source,
    properties,
    filePath: filePath,
    line,
    functionName
  };
}

module.exports = {
  extractEventName,
  processEventData
};