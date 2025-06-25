/**
 * @fileoverview AST traversal utilities for Go code analysis
 * @module analyze/go/astTraversal
 */

const { MAX_RECURSION_DEPTH } = require('./constants');
const { extractTrackingEvent } = require('./trackingExtractor');

/**
 * Extract events from a body of statements
 * @param {Array<Object>} body - Array of AST statement nodes to process
 * @param {Array<Object>} events - Array to collect found tracking events (modified in place)
 * @param {string} filePath - Path to the file being analyzed
 * @param {string} functionName - Name of the current function being processed
 * @param {Object|null} customConfig - Parsed custom function configuration (or null)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 */
function extractEventsFromBody(body, events, filePath, functionName, customConfig, typeContext, currentFunction) {
  for (const stmt of body) {
    if (stmt.tag === 'exec' && stmt.expr) {
      processExpression(stmt.expr, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'declare' && stmt.value) {
      // Handle variable declarations with tracking calls
      processExpression(stmt.value, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'assign' && stmt.rhs) {
      // Handle assignments with tracking calls
      processExpression(stmt.rhs, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'if' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'elseif' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'else' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'for' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'foreach' && stmt.body) {
      extractEventsFromBody(stmt.body, events, filePath, functionName, customConfig, typeContext, currentFunction);
    } else if (stmt.tag === 'switch' && stmt.cases) {
      for (const caseNode of stmt.cases) {
        if (caseNode.body) {
          extractEventsFromBody(caseNode.body, events, filePath, functionName, customConfig, typeContext, currentFunction);
        }
      }
    }
  }
}

/**
 * Process an expression to find tracking calls
 * @param {Object} expr - AST expression node to process
 * @param {Array<Object>} events - Array to collect found tracking events (modified in place)
 * @param {string} filePath - Path to the file being analyzed
 * @param {string} functionName - Name of the current function being processed
 * @param {Object|null} customConfig - Parsed custom function configuration (or null)
 * @param {Object} typeContext - Type information context for variable resolution
 * @param {string} currentFunction - Current function context for type lookups
 * @param {number} [depth=0] - Current recursion depth (used to prevent infinite recursion)
 */
function processExpression(expr, events, filePath, functionName, customConfig, typeContext, currentFunction, depth = 0) {
  if (!expr || depth > MAX_RECURSION_DEPTH) return; // Prevent infinite recursion with depth limit
  
  // Handle array of expressions
  if (Array.isArray(expr)) {
    for (const item of expr) {
      processExpression(item, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
    }
    return;
  }
  
  // Handle single expression with body
  if (expr.body) {
    for (const item of expr.body) {
      processExpression(item, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
    }
    return;
  }
  
  // Handle specific node types
  if (expr.tag === 'call') {
    const trackingCall = extractTrackingEvent(expr, filePath, functionName, customConfig, typeContext, currentFunction);
    if (trackingCall) {
      events.push(trackingCall);
    }
    
    // Also process call arguments
    if (expr.args) {
      processExpression(expr.args, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
    }
  } else if (expr.tag === 'structlit') {
    // Check if this struct literal is a tracking event
    const trackingCall = extractTrackingEvent(expr, filePath, functionName, customConfig, typeContext, currentFunction);
    if (trackingCall) {
      events.push(trackingCall);
    }
    
    // Process fields (but don't recurse into field values for tracking structs)
    if (!trackingCall && expr.fields) {
      for (const field of expr.fields) {
        if (field.value) {
          processExpression(field.value, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
        }
      }
    }
  }
  
  // Process other common properties that might contain expressions
  if (expr.value && expr.tag !== 'structlit') {
    processExpression(expr.value, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
  }
  if (expr.lhs) {
    processExpression(expr.lhs, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
  }
  if (expr.rhs) {
    processExpression(expr.rhs, events, filePath, functionName, customConfig, typeContext, currentFunction, depth + 1);
  }
}

module.exports = {
  extractEventsFromBody
};
