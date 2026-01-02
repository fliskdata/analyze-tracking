/**
 * @fileoverview Property extraction from TypeScript AST nodes
 * @module analyze/typescript/extractors/property-extractor
 */

const ts = require('typescript');
const {
  getTypeOfNode,
  resolveTypeToProperties,
  getBasicTypeOfArrayElement,
  isCustomType,
  isEnumType,
  getEnumValues,
  resolveTypeObjectToSchema,
  extractTypeProperties
} = require('../utils/type-resolver');

/**
 * Property structure representation
 * @typedef {Object} PropertySchema
 * @property {string} type - The property type (string, number, boolean, object, array, any)
 * @property {PropertySchema} [properties] - Nested properties for objects
 * @property {Object} [items] - Item type information for arrays
 * @property {string} [__unresolved] - Unresolved type name marker
 */

/**
 * Extracts properties from a TypeScript ObjectLiteralExpression node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} node - ObjectLiteralExpression node
 * @returns {Object.<string, PropertySchema>} Extracted properties with their schemas
 */
function extractProperties(checker, node) {
  if (!node || !ts.isObjectLiteralExpression(node)) {
    return {};
  }

  const properties = {};

  for (const prop of node.properties) {
    // Handle spread assignments like {...object}
    if (ts.isSpreadAssignment(prop)) {
      const spreadProperties = extractSpreadProperties(checker, prop);
      Object.assign(properties, spreadProperties);
      continue;
    }

    const key = getPropertyKey(prop);
    if (!key) continue;

    const schema = extractPropertySchema(checker, prop);
    if (schema) {
      properties[key] = schema;
    }
  }

  return properties;
}

/**
 * Gets the key name from a property node
 * @param {Object} prop - Property node
 * @returns {string|null} Property key or null
 */
function getPropertyKey(prop) {
  if (!prop.name) {
    // Shorthand property assignment
    if (ts.isShorthandPropertyAssignment(prop)) {
      return prop.name.escapedText;
    }
    return null;
  }

  // Regular property with name
  if (ts.isIdentifier(prop.name)) {
    return prop.name.escapedText;
  }

  if (ts.isStringLiteral(prop.name)) {
    return prop.name.text;
  }

  return null;
}

/**
 * Extracts schema information from a property
 * @param {Object} checker - TypeScript type checker
 * @param {Object} prop - Property node
 * @returns {PropertySchema|null} Property schema or null
 */
function extractPropertySchema(checker, prop) {
  // Handle shorthand property assignments
  if (ts.isShorthandPropertyAssignment(prop)) {
    return extractShorthandPropertySchema(checker, prop);
  }

  // Handle property assignments with initializers
  if (ts.isPropertyAssignment(prop)) {
    if (prop.initializer) {
      return extractValueSchema(checker, prop.initializer);
    }

    // Property with type annotation but no initializer
    if (prop.type) {
      const typeString = checker.typeToString(checker.getTypeFromTypeNode(prop.type));
      return resolveTypeSchema(checker, typeString);
    }
  }

  // Handle method declarations
  if (ts.isMethodDeclaration(prop)) {
    return { type: 'function' };
  }

  return null;
}

/**
 * Extracts schema for shorthand property assignments
 * @param {Object} checker - TypeScript type checker
 * @param {Object} prop - ShorthandPropertyAssignment node
 * @returns {PropertySchema}
 */
function extractShorthandPropertySchema(checker, prop) {
  const symbol = checker.getSymbolAtLocation(prop.name);
  if (!symbol) {
    return { type: 'any' };
  }
  const declarations = symbol.declarations || [];
  for (const decl of declarations) {
    // Detect destructuring from useState: const [state, setState] = useState<Type>(...)
    if (
      ts.isBindingElement(decl) &&
      decl.parent &&
      ts.isArrayBindingPattern(decl.parent) &&
      decl.parent.parent &&
      ts.isVariableDeclaration(decl.parent.parent) &&
      decl.parent.parent.initializer &&
      ts.isCallExpression(decl.parent.parent.initializer) &&
      ts.isIdentifier(decl.parent.parent.initializer.expression) &&
      decl.parent.parent.initializer.expression.escapedText === 'useState'
    ) {
      // Try to get type from generic argument
      const callExpr = decl.parent.parent.initializer;
      if (callExpr.typeArguments && callExpr.typeArguments.length > 0) {
        const typeNode = callExpr.typeArguments[0];
        const type = checker.getTypeFromTypeNode(typeNode);
        const typeString = checker.typeToString(type);
        return resolveTypeToProperties(checker, typeString);
      }
      // Fallback: get type from initial value
      if (callExpr.arguments && callExpr.arguments.length > 0) {
        const initType = checker.getTypeAtLocation(callExpr.arguments[0]);
        const typeString = checker.typeToString(initType);
        return resolveTypeToProperties(checker, typeString);
      }
      // Default to any
      return { type: 'any' };
    }
  }

  const propType = checker.getTypeAtLocation(prop.name);

  // Use the type object resolver for better accuracy
  return resolveTypeObjectToSchema(checker, propType);
}

/**
 * Extracts schema from a value node
 * @param {Object} checker - TypeScript type checker
 * @param {Object} valueNode - Value node to extract schema from
 * @returns {PropertySchema}
 */
function extractValueSchema(checker, valueNode) {
  // Object literal - extract inline properties
  if (ts.isObjectLiteralExpression(valueNode)) {
    return {
      type: 'object',
      properties: extractProperties(checker, valueNode)
    };
  }

  // Array literal
  if (ts.isArrayLiteralExpression(valueNode)) {
    return extractArrayLiteralSchema(checker, valueNode);
  }

  // Literal values
  const literalType = getLiteralType(valueNode);
  if (literalType) {
    return { type: literalType };
  }

  // For all other expressions (identifiers, property access, etc.),
  // use the type object resolver for accurate type resolution
  const valueType = checker.getTypeAtLocation(valueNode);
  return resolveTypeObjectToSchema(checker, valueType);
}

/**
 * Extracts schema for array literals
 * @param {Object} checker - TypeScript type checker
 * @param {Object} node - ArrayLiteralExpression node
 * @returns {PropertySchema}
 */
function extractArrayLiteralSchema(checker, node) {
  if (node.elements.length === 0) {
    return {
      type: 'array',
      items: { type: 'any' }
    };
  }

  // Check types of all elements
  const elementTypes = new Set();
  for (const element of node.elements) {
    const elemType = getBasicTypeOfArrayElement(checker, element);
    elementTypes.add(elemType);
  }

  // If all elements are the same type, use that type
  const itemType = elementTypes.size === 1 ? Array.from(elementTypes)[0] : 'any';

  return {
    type: 'array',
    items: { type: itemType }
  };
}

/**
 * Extracts schema for identifier references
 * @param {Object} checker - TypeScript type checker
 * @param {Object} identifier - Identifier node
 * @returns {PropertySchema}
 */
function extractIdentifierSchema(checker, identifier) {
  const identifierType = checker.getTypeAtLocation(identifier);

  // Use the new type object resolver for better accuracy
  return resolveTypeObjectToSchema(checker, identifierType);
}

/**
 * Extracts schema for array types
 * @param {Object} checker - TypeScript type checker
 * @param {Object} type - TypeScript Type object
 * @param {string} typeString - String representation of the type
 * @returns {PropertySchema}
 */
function extractArrayTypeSchema(checker, type, typeString) {
  let elementType = null;

  // Try to get type arguments for generic types
  if (type.target && type.typeArguments && type.typeArguments.length > 0) {
    elementType = type.typeArguments[0];
  }
  // Try indexed access for array types
  else {
    try {
      const numberType = checker.getNumberType();
      elementType = checker.getIndexedAccessType(type, numberType);
    } catch (e) {
      // Indexed access failed
    }
  }

  if (elementType) {
    const elementInterfaceProps = extractInterfaceProperties(checker, elementType);
    if (Object.keys(elementInterfaceProps).length > 0) {
      return {
        type: 'array',
        items: {
          type: 'object',
          properties: elementInterfaceProps
        }
      };
    } else {
      const elementTypeString = checker.typeToString(elementType);
      if (isCustomType(elementTypeString)) {
        return {
          type: 'array',
          items: { type: 'object' }
        };
      }
      return {
        type: 'array',
        items: resolveTypeToProperties(checker, elementTypeString)
      };
    }
  }

  return {
    type: 'array',
    items: { type: 'any' }
  };
}

/**
 * Resolves a type string to a schema
 * @param {Object} checker - TypeScript type checker
 * @param {string} typeString - Type string
 * @returns {PropertySchema}
 */
function resolveTypeSchema(checker, typeString) {
  const resolvedType = resolveTypeToProperties(checker, typeString);

  // Clean up any unresolved markers for simple types
  if (resolvedType.__unresolved) {
    delete resolvedType.__unresolved;
  }

  return resolvedType;
}

/**
 * Gets the literal type of a node
 * @param {Object} node - AST node
 * @returns {string|null} Literal type or null
 */
function getLiteralType(node) {
  if (!node || typeof node.kind === 'undefined') return null;
  if (ts.isStringLiteral(node)) return 'string';
  if (ts.isNumericLiteral(node)) return 'number';
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword) return 'boolean';
  if (node.kind === ts.SyntaxKind.NullKeyword) return 'null';
  if (node.kind === ts.SyntaxKind.UndefinedKeyword) return 'undefined';
  return null;
}

/**
 * Checks if a type string represents an array type
 * @param {string} typeString - Type string to check
 * @returns {boolean}
 */
function isArrayType(typeString) {
  return typeString.includes('[]') ||
         typeString.startsWith('Array<') ||
         typeString.startsWith('ReadonlyArray<') ||
         typeString.startsWith('readonly ');
}

/**
 * Extracts properties from a spread assignment
 * @param {Object} checker - TypeScript type checker
 * @param {Object} spreadNode - SpreadAssignment node
 * @returns {Object.<string, PropertySchema>}
 */
function extractSpreadProperties(checker, spreadNode) {
  if (!spreadNode.expression) {
    return {};
  }

  // If the spread is an identifier, resolve it to its declaration
  if (ts.isIdentifier(spreadNode.expression)) {
    const symbol = checker.getSymbolAtLocation(spreadNode.expression);
    if (symbol && symbol.declarations && symbol.declarations.length > 0) {
      const declaration = symbol.declarations[0];

      // If it's a variable declaration with an object literal initializer
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        if (ts.isObjectLiteralExpression(declaration.initializer)) {
          // Extract properties directly from the object literal
          return extractProperties(checker, declaration.initializer);
        }
      }
    }

    // Fallback to the original identifier schema extraction
    const identifierSchema = extractIdentifierSchema(checker, spreadNode.expression);
    return identifierSchema.properties || {};
  }

  // If the spread is an object literal, extract its properties
  if (ts.isObjectLiteralExpression(spreadNode.expression)) {
    return extractProperties(checker, spreadNode.expression);
  }

  // For other expressions, try to get the type and extract properties from it
  try {
    const spreadType = checker.getTypeAtLocation(spreadNode.expression);
    return extractInterfaceProperties(checker, spreadType);
  } catch (error) {
    return {};
  }
}

/**
 * Extracts properties from a TypeScript interface or type
 * @param {Object} checker - TypeScript type checker
 * @param {Object} type - TypeScript Type object
 * @returns {Object.<string, PropertySchema>}
 */
function extractInterfaceProperties(checker, type) {
  const properties = {};
  const typeSymbol = type.getSymbol();

  if (!typeSymbol) return properties;

  // Check if this is an enum type - don't expand enum string methods
  const typeString = checker.typeToString(type);
  if (isEnumType(checker, typeString)) {
    // Return empty - the caller should handle enum types specially
    return properties;
  }

  // Check if this looks like a string primitive with methods - skip it
  if (isStringPrototype(type, checker)) {
    return properties;
  }

  // Get all properties of the type
  const members = checker.getPropertiesOfType(type);

  // Filter out built-in methods (string prototype methods, etc.)
  const userDefinedMembers = members.filter(member => {
    const name = member.name;
    // Skip common built-in method names
    if (STRING_PROTOTYPE_METHODS.has(name)) {
      return false;
    }
    // Skip symbols
    if (name.startsWith('__@')) {
      return false;
    }
    return true;
  });

  for (const member of userDefinedMembers) {
    try {
      const memberType = checker.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
      const memberTypeString = checker.typeToString(memberType);

      // Skip function types
      if (memberTypeString.includes('=>') || memberTypeString.startsWith('(')) {
        continue;
      }

      // Check if member type is an enum
      if (isEnumType(checker, memberTypeString, memberType)) {
        const enumValues = getEnumValues(checker, memberTypeString, memberType);
        if (enumValues && enumValues.length > 0) {
          properties[member.name] = {
            type: 'enum',
            values: enumValues
          };
        } else {
          properties[member.name] = { type: 'string' };
        }
        continue;
      }

      // Recursively resolve the member type
      const resolvedType = resolveTypeToProperties(checker, memberTypeString);

      // If it's an unresolved object type, try to extract its properties
      if (resolvedType.__unresolved) {
        const nestedProperties = extractInterfaceProperties(checker, memberType);
        if (Object.keys(nestedProperties).length > 0) {
          properties[member.name] = {
            type: 'object',
            properties: nestedProperties
          };
        } else {
          properties[member.name] = resolvedType;
          delete properties[member.name].__unresolved;
        }
      } else if (resolvedType.type === 'array' && memberType.target) {
        // Handle array types in interfaces
        const arraySchema = extractArrayTypeSchema(checker, memberType, memberTypeString);
        properties[member.name] = arraySchema;
      } else {
        properties[member.name] = resolvedType;
      }
    } catch (error) {
      // Skip properties that cause errors
      properties[member.name] = { type: 'any' };
    }
  }

  return properties;
}

/**
 * Set of common string prototype method names to filter out
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

/**
 * Checks if a type is a string primitive that would have prototype methods
 * @param {Object} type - TypeScript Type object
 * @param {Object} checker - TypeScript type checker
 * @returns {boolean}
 */
function isStringPrototype(type, checker) {
  if (!type) return false;
  const members = checker.getPropertiesOfType(type);
  // If the type has common string methods, it's likely a string
  const stringMethodCount = members.filter(m => STRING_PROTOTYPE_METHODS.has(m.name)).length;
  // If more than half of the members are string methods, treat as string
  return stringMethodCount > 10 && stringMethodCount > members.length / 2;
}

module.exports = {
  extractProperties,
  extractInterfaceProperties
};
