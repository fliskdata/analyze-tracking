/**
 * @fileoverview Analytics source detection for Swift tracking calls
 * @module analyze/swift/detectors/analytics-source
 */

const { ANALYTICS_PROVIDERS } = require('../constants');

/**
 * Detects the analytics source from a Swift function call expression
 * @param {Object} callExpression - Swift AST call expression node
 * @param {string|null} customFunction - Optional custom function name to detect
 * @returns {string|null} - The detected source or null
 */
function detectAnalyticsSource(callExpression, customFunction = null) {
  if (!callExpression) return null;

  // Handle custom function detection first
  if (customFunction && isCustomFunction(callExpression, customFunction)) {
    return 'custom';
  }

  // Handle built-in analytics providers
  return detectBuiltinProvider(callExpression);
}

/**
 * Detects if a call expression matches a custom function
 * @param {Object} callExpression - Swift AST call expression node
 * @param {string} customFunction - Custom function name or pattern
 * @returns {boolean}
 */
function isCustomFunction(callExpression, customFunction) {
  if (!callExpression.calledExpression) return false;

  // Extract function name from call expression
  const functionName = extractFunctionName(callExpression.calledExpression);
  
  if (!functionName) return false;

  // Handle simple function names
  if (typeof customFunction === 'string') {
    return functionName === customFunction;
  }

  // Handle custom function object with functionName property
  if (customFunction.functionName) {
    return functionName === customFunction.functionName;
  }

  return false;
}

/**
 * Detects built-in analytics providers from a call expression
 * @param {Object} callExpression - Swift AST call expression node
 * @returns {string|null}
 */
function detectBuiltinProvider(callExpression) {
  if (!callExpression.calledExpression) return null;

  const expr = callExpression.calledExpression;

  // Handle method calls (object.method())
  if (expr.kind === 'MemberAccessExpr') {
    return detectMethodCall(expr);
  }

  // Handle direct function calls (functionName())
  if (expr.kind === 'UnresolvedDeclRefExpr' || expr.kind === 'DeclRefExpr') {
    return detectDirectFunctionCall(expr);
  }

  // Handle chained calls (Object.shared().method())
  if (expr.kind === 'DotSyntaxCallExpr') {
    return detectChainedCall(expr);
  }

  return null;
}

/**
 * Detects analytics provider from method call expressions
 * @param {Object} memberExpr - Swift AST member access expression
 * @returns {string|null}
 */
function detectMethodCall(memberExpr) {
  if (!memberExpr.member || !memberExpr.base) return null;

  const methodName = extractIdentifierName(memberExpr.member);
  const baseName = extractBaseName(memberExpr.base);

  // Check each provider
  for (const provider of Object.values(ANALYTICS_PROVIDERS)) {
    if (provider.methodName === methodName) {
      // Check if base matches the provider's object name
      if (baseName === provider.objectName) {
        return provider.name;
      }
      
      // Check for property access (e.g., PostHogSDK.shared.capture)
      if (provider.property && memberExpr.base.kind === 'MemberAccessExpr') {
        const baseBase = extractBaseName(memberExpr.base.base);
        const baseProperty = extractIdentifierName(memberExpr.base.member);
        
        if (baseBase === provider.objectName && baseProperty === provider.property) {
          return provider.name;
        }
      }
    }
  }

  return null;
}

/**
 * Detects analytics provider from direct function calls
 * @param {Object} declRefExpr - Swift AST declaration reference expression
 * @returns {string|null}
 */
function detectDirectFunctionCall(declRefExpr) {
  const functionName = extractIdentifierName(declRefExpr);
  
  // Check for Firebase Analytics.logEvent pattern
  if (functionName === 'logEvent') {
    return ANALYTICS_PROVIDERS.FIREBASE.name;
  }

  return null;
}

/**
 * Detects analytics provider from chained method calls
 * @param {Object} chainExpr - Swift AST chained call expression
 * @returns {string|null}
 */
function detectChainedCall(chainExpr) {
  // Handle patterns like Analytics.shared().track()
  if (!chainExpr.fn || !chainExpr.argument) return null;

  const methodName = extractFunctionName(chainExpr.fn);
  const chainBase = extractChainBase(chainExpr.argument);

  for (const provider of Object.values(ANALYTICS_PROVIDERS)) {
    if (provider.methodName === methodName && provider.chainMethods) {
      // Check if the chain matches the provider pattern
      if (chainBase === provider.objectName) {
        return provider.name;
      }
    }
  }

  return null;
}

/**
 * Extracts function name from various expression types
 * @param {Object} expr - Swift AST expression
 * @returns {string|null}
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
 * Extracts identifier name from declaration reference
 * @param {Object} declRef - Swift AST declaration reference
 * @returns {string|null}
 */
function extractIdentifierName(declRef) {
  if (!declRef) return null;

  // Handle different identifier structures
  if (declRef.identifier && declRef.identifier.name) {
    return declRef.identifier.name;
  }

  if (declRef.name) {
    return declRef.name;
  }

  if (typeof declRef === 'string') {
    return declRef;
  }

  return null;
}

/**
 * Extracts base name from expressions
 * @param {Object} base - Swift AST base expression
 * @returns {string|null}
 */
function extractBaseName(base) {
  if (!base) return null;

  if (base.kind === 'UnresolvedDeclRefExpr' || base.kind === 'DeclRefExpr') {
    return extractIdentifierName(base);
  }

  if (base.kind === 'MemberAccessExpr') {
    return extractBaseName(base.base);
  }

  return null;
}

/**
 * Extracts the base object from a chained call
 * @param {Object} chainArg - Swift AST chain argument
 * @returns {string|null}
 */
function extractChainBase(chainArg) {
  if (!chainArg) return null;

  if (chainArg.kind === 'UnresolvedDeclRefExpr' || chainArg.kind === 'DeclRefExpr') {
    return extractIdentifierName(chainArg);
  }

  if (chainArg.kind === 'MemberAccessExpr') {
    return extractBaseName(chainArg.base);
  }

  return null;
}

module.exports = {
  detectAnalyticsSource
};