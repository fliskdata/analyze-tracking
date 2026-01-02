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

  // Handle union types
  if (typeString.includes('|')) {
    // Try to extract the non-undefined/non-null type from the union
    const resolvedUnion = resolveUnionType(checker, typeString, visitedTypes);
    if (resolvedUnion) {
      return resolvedUnion;
    }
    // Fallback: preserve as-is
    return { type: typeString };
  }

  // Handle intersection types
  if (typeString.includes('&')) {
    // For simplicity, mark intersection types as 'object'
    return { type: 'object' };
  }

  // Check if it's an enum type - don't try to expand enum members
  if (checker && isEnumType(checker, typeString)) {
    const enumValues = getEnumValues(checker, typeString);
    if (enumValues && enumValues.length > 0) {
      return {
        type: 'enum',
        values: enumValues
      };
    }
    // Fallback for string enums
    return { type: 'string' };
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
 * Resolves a union type by extracting the meaningful type (ignoring undefined/null)
 * @param {Object} checker - TypeScript type checker
 * @param {string} typeString - Union type string
 * @param {Set} visitedTypes - Set of visited types
 * @returns {Object|null} Resolved type or null
 */
function resolveUnionType(checker, typeString, visitedTypes) {
  // Split by | and trim each part
  const parts = splitUnionType(typeString);

  // Filter out undefined and null
  const meaningfulParts = parts.filter(p =>
    p !== 'undefined' && p !== 'null' && p.trim() !== ''
  );

  if (meaningfulParts.length === 0) {
    return { type: 'null' };
  }

  if (meaningfulParts.length === 1) {
    const part = meaningfulParts[0].trim();

    // Check if it's an object literal type like { id: string; name: string }
    if (part.startsWith('{') && part.endsWith('}')) {
      const properties = parseObjectLiteralType(part);
      if (Object.keys(properties).length > 0) {
        return {
          type: 'object',
          properties
        };
      }
    }

    // Recursively resolve the meaningful part
    return resolveTypeToProperties(checker, part, visitedTypes);
  }

  // Multiple meaningful parts - try to find the most specific one
  // Prefer object types over primitives
  for (const part of meaningfulParts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const properties = parseObjectLiteralType(trimmed);
      if (Object.keys(properties).length > 0) {
        return {
          type: 'object',
          properties
        };
      }
    }
  }

  // Return null to indicate we couldn't resolve it
  return null;
}

/**
 * Splits a union type string into its constituent parts, handling nested braces
 * @param {string} typeString - Union type string
 * @returns {string[]} Array of type parts
 */
function splitUnionType(typeString) {
  const parts = [];
  let current = '';
  let depth = 0;
  let parenDepth = 0;
  let angleDepth = 0;

  for (let i = 0; i < typeString.length; i++) {
    const char = typeString[i];

    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === '<') angleDepth++;
    else if (char === '>') angleDepth--;

    if (char === '|' && depth === 0 && parenDepth === 0 && angleDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Parses an object literal type string like "{ id: string; name: string }"
 * @param {string} typeString - Object literal type string
 * @returns {Object} Parsed properties
 */
function parseObjectLiteralType(typeString) {
  const properties = {};

  // Remove outer braces and trim
  let inner = typeString.slice(1, -1).trim();
  if (!inner) return properties;

  // Split by semicolons (property separators), handling nested braces
  const propStrings = splitBySemicolon(inner);

  for (const propString of propStrings) {
    const trimmed = propString.trim();
    if (!trimmed) continue;

    // Parse "key: type" or "key?: type"
    const colonIndex = findPropertyColonIndex(trimmed);
    if (colonIndex === -1) continue;

    let key = trimmed.slice(0, colonIndex).trim();
    const typeStr = trimmed.slice(colonIndex + 1).trim();

    // Handle optional properties (key?)
    if (key.endsWith('?')) {
      key = key.slice(0, -1);
    }

    if (!key) continue;

    // Resolve the property type
    properties[key] = resolvePropertyType(typeStr);
  }

  return properties;
}

/**
 * Splits a string by semicolons, respecting nested structures
 * @param {string} str - String to split
 * @returns {string[]} Array of parts
 */
function splitBySemicolon(str) {
  const parts = [];
  let current = '';
  let depth = 0;
  let parenDepth = 0;
  let angleDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === '<') angleDepth++;
    else if (char === '>') angleDepth--;

    if (char === ';' && depth === 0 && parenDepth === 0 && angleDepth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

/**
 * Finds the index of the colon separating property name from type
 * @param {string} str - Property string
 * @returns {number} Index of the colon or -1
 */
function findPropertyColonIndex(str) {
  // Find the first colon that's not inside nested structures
  let depth = 0;
  let parenDepth = 0;
  let angleDepth = 0;

  for (let i = 0; i < str.length; i++) {
    const char = str[i];

    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '(') parenDepth++;
    else if (char === ')') parenDepth--;
    else if (char === '<') angleDepth++;
    else if (char === '>') angleDepth--;
    else if (char === ':' && depth === 0 && parenDepth === 0 && angleDepth === 0) {
      return i;
    }
  }

  return -1;
}

/**
 * Resolves a property type string to a schema
 * @param {string} typeStr - Type string
 * @returns {Object} Property schema
 */
function resolvePropertyType(typeStr) {
  const trimmed = typeStr.trim();

  // Handle primitive types
  if (['string', 'number', 'boolean', 'any', 'unknown', 'null', 'undefined'].includes(trimmed)) {
    return { type: trimmed };
  }

  // Handle array types
  if (trimmed.endsWith('[]')) {
    const elementType = trimmed.slice(0, -2).trim();
    return {
      type: 'array',
      items: resolvePropertyType(elementType)
    };
  }

  // Handle nested object types
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    const nestedProps = parseObjectLiteralType(trimmed);
    return {
      type: 'object',
      properties: nestedProps
    };
  }

  // For other types, return as-is
  return { type: trimmed };
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

/**
 * Checks if a type is an enum type by examining its symbol
 * @param {Object} checker - TypeScript type checker
 * @param {string} typeString - Type string to check
 * @param {Object} [type] - Optional TypeScript type object
 * @returns {boolean}
 */
function isEnumType(checker, typeString, type = null) {
  if (!checker || !typeString) return false;

  // Check if it's a simple enum type name (not a union)
  if (typeString.includes('|') || typeString.includes('&')) {
    return false;
  }

  // Skip primitive types
  if (['string', 'number', 'boolean', 'any', 'unknown', 'null', 'undefined', 'void'].includes(typeString)) {
    return false;
  }

  // If we have a type object, check its symbol flags
  if (type && type.symbol) {
    // Check if the symbol has the Enum flag
    if (type.symbol.flags & ts.SymbolFlags.Enum) {
      return true;
    }
    // Check if the symbol has the EnumMember flag (for individual enum values)
    if (type.symbol.flags & ts.SymbolFlags.EnumMember) {
      return true;
    }
  }

  return false;
}

/**
 * Gets the values of an enum type from its type object
 * @param {Object} checker - TypeScript type checker
 * @param {string} typeString - Enum type name
 * @param {Object} [type] - Optional TypeScript type object
 * @returns {string[]|null} Array of enum values or null
 */
function getEnumValues(checker, typeString, type = null) {
  if (!checker || !typeString) return null;

  try {
    let enumSymbol = null;

    if (type && type.symbol) {
      // Check if this is an enum member (e.g., SubscriptionType.MONTHLY)
      if (type.symbol.flags & ts.SymbolFlags.EnumMember) {
        // Get the parent enum
        enumSymbol = type.symbol.parent;
      }
      // Check if this is the enum type itself
      else if (type.symbol.flags & ts.SymbolFlags.Enum) {
        enumSymbol = type.symbol;
      }
    }

    if (enumSymbol && enumSymbol.exports) {
      const values = [];
      enumSymbol.exports.forEach((member, name) => {
        // Get the value of each enum member
        if (member.declarations && member.declarations.length > 0) {
          const decl = member.declarations[0];
          if (ts.isEnumMember(decl) && decl.initializer) {
            if (ts.isStringLiteral(decl.initializer)) {
              values.push(decl.initializer.text);
            } else if (ts.isNumericLiteral(decl.initializer)) {
              values.push(Number(decl.initializer.text));
            }
          }
        }
      });
      if (values.length > 0) {
        return values;
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return null;
}

/**
 * Resolves a TypeScript type object to a property schema
 * This is more accurate than resolving from type strings
 * @param {Object} checker - TypeScript type checker
 * @param {Object} type - TypeScript Type object
 * @param {Set} [visitedTypes] - Set of visited types to prevent cycles
 * @returns {Object} Property schema
 */
function resolveTypeObjectToSchema(checker, type, visitedTypes = new Set()) {
  if (!type) return { type: 'any' };

  const typeString = checker.typeToString(type);

  // Prevent infinite recursion
  if (visitedTypes.has(typeString)) {
    return { type: 'object' };
  }

  // Handle union types
  if (type.isUnion?.()) {
    return resolveUnionTypeObject(checker, type, visitedTypes);
  }

  // Handle enum types (actual enum declarations)
  if (isEnumType(checker, typeString, type)) {
    const enumValues = getEnumValues(checker, typeString, type);
    if (enumValues && enumValues.length > 0) {
      return { type: 'enum', values: enumValues };
    }
    return { type: 'string' };
  }

  // Handle primitive types
  const flags = type.flags;
  if (flags & ts.TypeFlags.String || flags & ts.TypeFlags.StringLiteral) {
    return { type: 'string' };
  }
  if (flags & ts.TypeFlags.Number || flags & ts.TypeFlags.NumberLiteral) {
    return { type: 'number' };
  }
  if (flags & ts.TypeFlags.Boolean || flags & ts.TypeFlags.BooleanLiteral) {
    return { type: 'boolean' };
  }
  if (flags & ts.TypeFlags.Undefined) {
    return { type: 'undefined' };
  }
  if (flags & ts.TypeFlags.Null) {
    return { type: 'null' };
  }

  // Handle array types
  if (checker.isArrayType?.(type) || typeString.endsWith('[]') || typeString.startsWith('Array<')) {
    let elementType = null;
    if (type.typeArguments && type.typeArguments.length > 0) {
      elementType = type.typeArguments[0];
    }
    if (elementType) {
      visitedTypes.add(typeString);
      return {
        type: 'array',
        items: resolveTypeObjectToSchema(checker, elementType, visitedTypes)
      };
    }
    return { type: 'array', items: { type: 'any' } };
  }

  // Handle object types - try to extract properties
  if (flags & ts.TypeFlags.Object) {
    visitedTypes.add(typeString);
    const properties = extractTypeProperties(checker, type, visitedTypes);
    if (Object.keys(properties).length > 0) {
      return { type: 'object', properties };
    }
    return { type: 'object' };
  }

  // Fallback
  return resolveTypeToProperties(checker, typeString, visitedTypes);
}

/**
 * Resolves a union type object to a property schema
 * Handles string literal unions and optional types
 * @param {Object} checker - TypeScript type checker
 * @param {Object} type - Union type object
 * @param {Set} visitedTypes - Set of visited types
 * @returns {Object} Property schema
 */
function resolveUnionTypeObject(checker, type, visitedTypes) {
  const types = type.types || [];

  // Filter out undefined and null
  const meaningfulTypes = types.filter(t => {
    const str = checker.typeToString(t);
    return str !== 'undefined' && str !== 'null';
  });

  if (meaningfulTypes.length === 0) {
    return { type: 'null' };
  }

  // Check if all remaining types are string literals -> treat as enum
  const allStringLiterals = meaningfulTypes.every(t => t.isStringLiteral?.());
  if (allStringLiterals) {
    const values = meaningfulTypes.map(t => getStringLiteralValue(t, checker));
    return { type: 'enum', values };
  }

  // Check if all remaining types are number literals -> treat as enum
  const allNumberLiterals = meaningfulTypes.every(t => t.isNumberLiteral?.());
  if (allNumberLiterals) {
    const values = meaningfulTypes.map(t => getNumberLiteralValue(t, checker));
    return { type: 'enum', values };
  }

  // If only one meaningful type remains, resolve it
  if (meaningfulTypes.length === 1) {
    return resolveTypeObjectToSchema(checker, meaningfulTypes[0], visitedTypes);
  }

  // Multiple complex types - try to find the most specific one
  // Prefer object types
  for (const t of meaningfulTypes) {
    if (t.flags & ts.TypeFlags.Object) {
      return resolveTypeObjectToSchema(checker, t, visitedTypes);
    }
  }

  // Fallback to type string
  const typeString = checker.typeToString(type);
  return { type: typeString };
}

/**
 * Gets the actual string value from a string literal type
 * Handles both regular string literals and enum member string literals
 * @param {Object} type - TypeScript type
 * @param {Object} checker - TypeScript type checker
 * @returns {string} The actual string value
 */
function getStringLiteralValue(type, checker) {
  // Check if this is an enum member - get the actual value from the initializer
  if (type.symbol && (type.symbol.flags & ts.SymbolFlags.EnumMember)) {
    const valueDecl = type.symbol.valueDeclaration;
    if (valueDecl && ts.isEnumMember(valueDecl) && valueDecl.initializer) {
      if (ts.isStringLiteral(valueDecl.initializer)) {
        return valueDecl.initializer.text;
      }
    }
  }

  // For regular string literals, remove quotes from the type string
  const str = checker.typeToString(type);
  return str.replace(/^["']|["']$/g, '');
}

/**
 * Gets the actual number value from a number literal type
 * @param {Object} type - TypeScript type
 * @param {Object} checker - TypeScript type checker
 * @returns {number} The actual number value
 */
function getNumberLiteralValue(type, checker) {
  // Check if this is an enum member - get the actual value from the initializer
  if (type.symbol && (type.symbol.flags & ts.SymbolFlags.EnumMember)) {
    const valueDecl = type.symbol.valueDeclaration;
    if (valueDecl && ts.isEnumMember(valueDecl) && valueDecl.initializer) {
      if (ts.isNumericLiteral(valueDecl.initializer)) {
        return Number(valueDecl.initializer.text);
      }
    }
  }

  return Number(checker.typeToString(type));
}

/**
 * Extracts properties from a TypeScript type object
 * @param {Object} checker - TypeScript type checker
 * @param {Object} type - TypeScript Type object
 * @param {Set} visitedTypes - Set of visited types
 * @returns {Object} Properties map
 */
function extractTypeProperties(checker, type, visitedTypes) {
  const properties = {};

  try {
    const members = checker.getPropertiesOfType(type);

    for (const member of members) {
      const name = member.name;

      // Skip functions and common built-in methods
      if (STRING_PROTOTYPE_METHODS.has(name) || name.startsWith('__@')) {
        continue;
      }

      try {
        const memberType = checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
        const memberTypeString = checker.typeToString(memberType);

        // Skip function types
        if (memberTypeString.includes('=>') || memberTypeString.startsWith('(')) {
          continue;
        }

        // Recursively resolve the member type
        const resolved = resolveTypeObjectToSchema(checker, memberType, visitedTypes);
        properties[name] = resolved;
      } catch (e) {
        properties[name] = { type: 'any' };
      }
    }
  } catch (e) {
    // Ignore errors
  }

  return properties;
}

/**
 * Set of string prototype methods to filter out
 */
const STRING_PROTOTYPE_METHODS = new Set([
  'toString', 'charAt', 'charCodeAt', 'concat', 'indexOf', 'lastIndexOf',
  'localeCompare', 'match', 'replace', 'search', 'slice', 'split',
  'substring', 'toLowerCase', 'toLocaleLowerCase', 'toUpperCase',
  'toLocaleUpperCase', 'trim', 'length', 'substr', 'valueOf',
  'codePointAt', 'includes', 'endsWith', 'normalize', 'repeat',
  'startsWith', 'anchor', 'big', 'blink', 'bold', 'fixed',
  'fontcolor', 'fontsize', 'italics', 'link', 'small', 'strike',
  'sub', 'sup', 'padStart', 'padEnd', 'trimEnd', 'trimStart',
  'trimLeft', 'trimRight', 'matchAll', 'replaceAll', 'at',
  'isWellFormed', 'toWellFormed'
]);

module.exports = {
  resolveIdentifierToInitializer,
  getTypeOfNode,
  resolveTypeToProperties,
  isCustomType,
  getBasicTypeOfArrayElement,
  isReactHookCall,
  isEnumType,
  getEnumValues,
  resolveTypeObjectToSchema,
  extractTypeProperties
};
