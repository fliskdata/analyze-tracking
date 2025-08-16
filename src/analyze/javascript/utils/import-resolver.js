const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const { PARSER_OPTIONS, NODE_TYPES } = require('../constants');

const JS_EXTENSIONS = ['.js', '.mjs', '.cjs', '.jsx'];
const TS_EXTENSIONS = ['.ts', '.tsx'];
const ALL_EXTENSIONS = [...JS_EXTENSIONS, ...TS_EXTENSIONS, '.json'];

function tryFileWithExtensions(basePath) {
  for (const ext of ALL_EXTENSIONS) {
    const full = basePath + ext;
    if (fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  // index.* inside directory
  if (fs.existsSync(basePath) && fs.statSync(basePath).isDirectory()) {
    for (const ext of ALL_EXTENSIONS) {
      const idx = path.join(basePath, 'index' + ext);
      if (fs.existsSync(idx) && fs.statSync(idx).isFile()) return idx;
    }
  }
  return null;
}

function resolveModulePath(specifier, fromDir) {
  // Relative or absolute
  if (specifier.startsWith('.') || specifier.startsWith('/')) {
    const abs = path.resolve(fromDir, specifier);
    const direct = tryFileWithExtensions(abs);
    if (direct) return direct;
  } else {
    // Bare or aliased import – search upwards for a matching folder for first segment
    const parts = specifier.split('/');
    let current = fromDir;
    while (true) {
      const candidateRoot = path.join(current, parts[0]);
      if (fs.existsSync(candidateRoot) && fs.statSync(candidateRoot).isDirectory()) {
        const fullBase = path.join(current, specifier);
        const resolved = tryFileWithExtensions(fullBase);
        if (resolved) return resolved;
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return null;
}

// Extracts exported constant object maps from a JS/TS file.
// Returns: { ExportName: { KEY: 'value', ... }, ... }
function extractExportedConstStringMap(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const map = {};
  const ext = path.extname(filePath).toLowerCase();

  if (TS_EXTENSIONS.includes(ext)) {
    const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true);
    for (const stmt of sourceFile.statements) {
      if (ts.isVariableStatement(stmt) && stmt.modifiers && stmt.modifiers.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
        for (const decl of stmt.declarationList.declarations) {
          if (ts.isIdentifier(decl.name) && decl.initializer) {
            const exportName = decl.name.escapedText;
            const obj = unwrapFreezeToObjectLiteral(decl.initializer);
            if (obj) {
              const entries = objectLiteralToStringMapTS(obj);
              if (Object.keys(entries).length > 0) {
                map[exportName] = entries;
              }
            }
          }
        }
      }
    }
    return map;
  }

  // JS/JSX – parse with acorn + JSX
  const parser = acorn.Parser.extend(jsx());
  let ast;
  try {
    ast = parser.parse(code, { ...PARSER_OPTIONS, sourceType: 'module' });
  } catch (_) {
    return map;
  }
  // Look for export named declarations with const object or Object.freeze
  ast.body.forEach(node => {
    if (node.type === 'ExportNamedDeclaration' && node.declaration && node.declaration.type === 'VariableDeclaration') {
      node.declaration.declarations.forEach(decl => {
        if (decl.id && decl.id.type === NODE_TYPES.IDENTIFIER && decl.init) {
          const exportName = decl.id.name;
          const obj = unwrapFreezeToObjectLiteralJS(decl.init);
          if (obj && obj.type === NODE_TYPES.OBJECT_EXPRESSION) {
            const entries = objectExpressionToStringMapJS(obj);
            if (Object.keys(entries).length > 0) {
              map[exportName] = entries;
            }
          }
        }
      });
    }
  });

  return map;
}

function unwrapFreezeToObjectLiteral(initializer) {
  if (ts.isObjectLiteralExpression(initializer)) return initializer;
  if (ts.isCallExpression(initializer)) {
    const callee = initializer.expression;
    if (
      ts.isPropertyAccessExpression(callee) &&
      ts.isIdentifier(callee.expression) && callee.expression.escapedText === 'Object' &&
      callee.name.escapedText === 'freeze' &&
      initializer.arguments.length > 0 && ts.isObjectLiteralExpression(initializer.arguments[0])
    ) {
      return initializer.arguments[0];
    }
  }
  return null;
}

function objectLiteralToStringMapTS(obj) {
  const out = {};
  for (const prop of obj.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = ts.isIdentifier(prop.name) ? prop.name.escapedText : ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (!key) continue;
    if (prop.initializer && ts.isStringLiteral(prop.initializer)) {
      out[key] = prop.initializer.text;
    }
  }
  return out;
}

function unwrapFreezeToObjectLiteralJS(init) {
  if (init.type === NODE_TYPES.OBJECT_EXPRESSION) return init;
  if (init.type === 'CallExpression') {
    const callee = init.callee;
    if (
      callee && callee.type === NODE_TYPES.MEMBER_EXPRESSION &&
      callee.object && callee.object.type === NODE_TYPES.IDENTIFIER && callee.object.name === 'Object' &&
      callee.property && callee.property.type === NODE_TYPES.IDENTIFIER && callee.property.name === 'freeze' &&
      init.arguments && init.arguments.length > 0 && init.arguments[0].type === NODE_TYPES.OBJECT_EXPRESSION
    ) {
      return init.arguments[0];
    }
  }
  return null;
}

function objectExpressionToStringMapJS(obj) {
  const out = {};
  obj.properties.forEach(prop => {
    if (!prop.key || !prop.value) return;
    const key = prop.key.name || prop.key.value;
    if (prop.value.type === NODE_TYPES.LITERAL && typeof prop.value.value === 'string') {
      out[key] = prop.value.value;
    }
  });
  return out;
}

// Collect imported constant string maps used by this file
function collectImportedConstantStringMap(filePath, ast) {
  const fromDir = path.dirname(filePath);
  const imports = [];

  // ES imports
  ast.body.forEach(node => {
    if (node.type === 'ImportDeclaration' && node.source && typeof node.source.value === 'string') {
      const spec = node.source.value;
      node.specifiers.forEach(s => {
        if (s.type === 'ImportSpecifier' && s.imported && s.local) {
          imports.push({ local: s.local.name, exported: s.imported.name, spec });
        }
      });
    }
  });

  // CommonJS requires: const { X } = require('mod')
  ast.body.forEach(node => {
    if (node.type === 'VariableDeclaration') {
      node.declarations.forEach(decl => {
        if (
          decl.init && decl.init.type === 'CallExpression' &&
          decl.init.callee && decl.init.callee.type === NODE_TYPES.IDENTIFIER && decl.init.callee.name === 'require' &&
          decl.init.arguments && decl.init.arguments[0] && decl.init.arguments[0].type === NODE_TYPES.LITERAL
        ) {
          const spec = String(decl.init.arguments[0].value);
          if (decl.id && decl.id.type === 'ObjectPattern') {
            decl.id.properties.forEach(p => {
              if (p.key && p.value && p.key.type === NODE_TYPES.IDENTIFIER && p.value.type === NODE_TYPES.IDENTIFIER) {
                imports.push({ local: p.value.name, exported: p.key.name, spec });
              }
            });
          }
        }
      });
    }
  });

  const constantMap = {};
  const bySpec = new Map();
  for (const imp of imports) {
    let resolved = bySpec.get(imp.spec);
    if (!resolved) {
      const file = resolveModulePath(imp.spec, fromDir);
      bySpec.set(imp.spec, file || null);
      resolved = file || null;
    }
    if (!resolved) continue;
    try {
      const exported = extractExportedConstStringMap(resolved);
      const entries = exported[imp.exported];
      if (entries && typeof entries === 'object') {
        constantMap[imp.local] = entries;
      }
    } catch (_) { /* ignore resolution errors */ }
  }

  return constantMap;
}

module.exports = {
  resolveModulePath,
  extractExportedConstStringMap,
  collectImportedConstantStringMap
};


