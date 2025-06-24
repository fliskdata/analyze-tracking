/**
 * @fileoverview Utilities for resolving TypeScript types and identifiers
 * @module analyze/typescript/utils/type-resolver
 */

const ts = require('typescript');

/**
 * Resolves an identifier to its initializer node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} identifier - Identifier node to resolve
 * @param {Object} sourceFile - Source file containing the identifier
 * @returns {Object|null} Initializer node or null
 */
function resolveIdentifierToInitializer(checker, identifier, sourceFile) {
  try {
    const symbol = checker.getSymbolAtLocation(identifier);
    if (!symbol || !symbol.valueDeclaration) {
      return null;
    }
    
    const declaration = symbol.valueDeclaration;
    
    // Handle variable declarations
    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      return declaration.initializer;
    }
    
    // Handle property assignments
    if (ts.isPropertyAssignment(declaration) && declaration.initializer) {
      return declaration.initializer;
    }
    
    // Handle parameter with default value
    if (ts.isParameter(declaration) && declaration.initializer) {
      return declaration.initializer;
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Gets the type string for a node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} node - AST node
 * @returns {string} Type string
 */
function getTypeOfNode(checker, node) {
  try {
    const type = checker.getTypeAtLocation(node);
    return checker.typeToString(type);
  } catch (error) {
    return 'any';
  }
}

/**
 * Resolves a type string to its properties structure
 * @param {Object} checker - TypeScript type checker
 * @param {string} typeString - Type string to resolve
 * @param {Set} [visitedTypes] - Set of visited types to prevent cycles
 * @returns {Object} Resolved type structure
 */
function resolveTypeToProperties(checker, typeString, visitedTypes = new Set()) {
  // Prevent infinite recursion for circular references
  if (visitedTypes.has(typeString)) {
    return { type: 'object' };
  }
  
  // Handle primitive types
  if (['string', 'number', 'boolean', 'any', 'unknown', 'null', 'undefined', 'void', 'never'].includes(typeString)) {
    return { type: typeString };
  }
  
  // Handle array types: T[] or Array<T>
  const arrayMatch = typeString.match(/^(.+)\[\]$/) || typeString.match(/^Array<(.+)>$/);
  if (arrayMatch) {
    const elementType = arrayMatch[1].trim();
    visitedTypes.add(typeString);
    const elementProps = resolveTypeToProperties(checker, elementType, visitedTypes);
    return {
      type: 'array',
      items: elementProps
    };
  }
  
  // Handle readonly array types: readonly T[] or ReadonlyArray<T>
  const readonlyArrayMatch = typeString.match(/^readonly (.+)\[\]$/) || typeString.match(/^ReadonlyArray<(.+)>$/);
  if (readonlyArrayMatch) {
    const elementType = readonlyArrayMatch[1].trim();
    visitedTypes.add(typeString);
    const elementProps = resolveTypeToProperties(checker, elementType, visitedTypes);
    return {
      type: 'array',
      items: elementProps
    };
  }
  
  // Handle union types - preserve them as-is
  if (typeString.includes('|')) {
    return { type: typeString };
  }
  
  // Handle intersection types
  if (typeString.includes('&')) {
    // For simplicity, mark intersection types as 'object'
    return { type: 'object' };
  }
  
  // Check if it looks like a custom type/interface
  if (isCustomType(typeString)) {
    return {
      type: 'object',
      __unresolved: typeString
    };
  }
  
  // Default case - preserve the type string as-is
  return { type: typeString };
}

/**
 * Checks if a type string represents a custom type or interface
 * @param {string} typeString - Type string to check
 * @returns {boolean}
 */
function isCustomType(typeString) {
  // Custom types typically start with uppercase and don't contain certain characters
  return typeString[0] === typeString[0].toUpperCase() && 
         !typeString.includes('<') && 
         !typeString.includes('|') && 
         !typeString.includes('&') &&
         !typeString.includes('(') &&
         !typeString.includes('[');
}

/**
 * Gets the basic type of an array element
 * @param {Object} checker - TypeScript type checker
 * @param {Object} element - Array element node
 * @returns {string} Basic type string
 */
function getBasicTypeOfArrayElement(checker, element) {
  if (!element || typeof element.kind === 'undefined') return 'any';
  
  // Check for literal values first
  if (ts.isStringLiteral(element)) {
    return 'string';
  } else if (ts.isNumericLiteral(element)) {
    return 'number';
  } else if (element.kind === ts.SyntaxKind.TrueKeyword || element.kind === ts.SyntaxKind.FalseKeyword) {
    return 'boolean';
  } else if (ts.isObjectLiteralExpression(element)) {
    return 'object';
  } else if (ts.isArrayLiteralExpression(element)) {
    return 'array';
  } else if (element.kind === ts.SyntaxKind.NullKeyword) {
    return 'null';
  } else if (element.kind === ts.SyntaxKind.UndefinedKeyword) {
    return 'undefined';
  }
  
  // For identifiers and other expressions, try to get the type
  const typeString = getTypeOfNode(checker, element);
  
  // Extract basic type from TypeScript type string
  if (typeString.startsWith('"') || typeString.startsWith("'")) {
    return 'string'; // String literal type
  } else if (!isNaN(Number(typeString))) {
    return 'number'; // Numeric literal type
  } else if (typeString === 'true' || typeString === 'false') {
    return 'boolean'; // Boolean literal type
  } else if (typeString.includes('[]') || typeString.startsWith('Array<')) {
    return 'array';
  } else if (['string', 'number', 'boolean', 'object', 'null', 'undefined'].includes(typeString)) {
    return typeString;
  } else if (isCustomType(typeString)) {
    return 'object';
  }
  
  return 'any';
}

/**
 * Checks if a CallExpression is a React hook (useCallback, useState, etc)
 * @param {Object} node - CallExpression node
 * @param {string[]} hookNames - List of hook names to check
 * @returns {boolean}
 */
function isReactHookCall(node, hookNames = ['useCallback', 'useState', 'useEffect', 'useMemo', 'useReducer']) {
  if (!node || !node.expression) return false;
  if (ts.isIdentifier(node.expression)) {
    return hookNames.includes(node.expression.escapedText);
  }
  return false;
}

module.exports = {
  resolveIdentifierToInitializer,
  getTypeOfNode,
  resolveTypeToProperties,
  isCustomType,
  getBasicTypeOfArrayElement,
  isReactHookCall
};
