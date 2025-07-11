/**
 * @fileoverview Ruby analytics tracking analyzer - main entry point
 * @module analyze/ruby
 */

const fs = require('fs');
const path = require('path');
const TrackingVisitor = require('./visitor');

// New: cache constant maps so we don't rebuild for every file in the same directory
const constantMapCache = {};

// Lazy-loaded parse function from Ruby Prism
let parse = null;

/**
 * Extracts the string literal value from an AST node, ignoring a trailing `.freeze` call.
 * Supports:
 *   - StringNode
 *   - CallNode with receiver StringNode and method `freeze`
 *
 * @param {import('@ruby/prism').PrismNode} node
 * @returns {string|null}
 */
async function extractStringLiteral(node) {
  if (!node) return null;

  const {
    StringNode,
    CallNode
  } = await import('@ruby/prism');

  if (node instanceof StringNode) {
    return node.unescaped?.value ?? null;
  }

  // Handle "_Section".freeze pattern
  if (node instanceof CallNode && node.name === 'freeze' && node.receiver) {
    return extractStringLiteral(node.receiver);
  }

  return null;
}

/**
 * Recursively traverses an AST to collect constant assignments and build a map
 * of fully-qualified constant names (e.g. "TelemetryHelper::FINISHED_SECTION")
 * to their string literal values.
 *
 * @param {import('@ruby/prism').PrismNode} node - current AST node
 * @param {string[]} namespaceStack - stack of module/class names
 * @param {Object} constantMap - accumulator map of constant path -> string value
 */
async function collectConstants(node, namespaceStack, constantMap) {
  if (!node) return;

  const {
    ModuleNode,
    ClassNode,
    StatementsNode,
    ConstantWriteNode,
    ConstantPathWriteNode,
    ConstantPathNode
  } = await import('@ruby/prism');

  // Helper to build constant path from ConstantPathNode
  const buildConstPath = (pathNode) => {
    if (!pathNode) return '';
    if (pathNode.type === 'ConstantReadNode') {
      return pathNode.name;
    }
    if (pathNode.type === 'ConstantPathNode') {
      const parent = buildConstPath(pathNode.parent);
      return parent ? `${parent}::${pathNode.name}` : pathNode.name;
    }
    return '';
  };

  // Process constant assignments
  if (node instanceof ConstantWriteNode) {
    const fullName = [...namespaceStack, node.name].join('::');
    const literal = await extractStringLiteral(node.value);
    if (literal !== null) {
      constantMap[fullName] = literal;
    }
  } else if (node instanceof ConstantPathWriteNode) {
    const fullName = buildConstPath(node.target);
    const literal = await extractStringLiteral(node.value);
    if (fullName && literal !== null) {
      constantMap[fullName] = literal;
    }
  }

  // Recurse into children depending on node type
  if (node instanceof ModuleNode || node instanceof ClassNode) {
    // Enter namespace
    const name = node.constantPath?.name || node.name; // ModuleNode has constantPath
    const childNamespaceStack = name ? [...namespaceStack, name] : namespaceStack;

    if (node.body) {
      await collectConstants(node.body, childNamespaceStack, constantMap);
    }
    return;
  }

  // Generic traversal for other nodes
  if (node instanceof StatementsNode) {
    for (const child of node.body) {
      await collectConstants(child, namespaceStack, constantMap);
    }
    return;
  }

  // Fallback: iterate over enumerable properties to find nested nodes
  for (const key of Object.keys(node)) {
    const val = node[key];
    if (!val) continue;

    const traverseChild = async (child) => {
      if (child && typeof child === 'object' && (child.location || child.constructor?.name?.endsWith('Node'))) {
        await collectConstants(child, namespaceStack, constantMap);
      }
    };

    if (Array.isArray(val)) {
      for (const c of val) {
        await traverseChild(c);
      }
    } else {
      await traverseChild(val);
    }
  }
}

/**
 * Builds a map of constant names to their literal string values for all .rb
 * files in the given directory. This is a best-effort resolver intended for
 * test fixtures and small projects and is not a fully-fledged Ruby constant
 * resolver.
 *
 * @param {string} directory
 * @returns {Promise<Object<string,string>>}
 */
async function buildConstantMapForDirectory(directory) {
  const constantMap = {};

  if (!fs.existsSync(directory)) return constantMap;

  // Return cached version if we've already built the map for this directory
  if (constantMapCache[directory]) {
    return constantMapCache[directory];
  }

  const files = fs.readdirSync(directory).filter(f => f.endsWith('.rb'));

  for (const file of files) {
    const fullPath = path.join(directory, file);
    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (!parse) {
        const { loadPrism } = await import('@ruby/prism');
        parse = await loadPrism();
      }
      const ast = await parse(content);
      await collectConstants(ast.value, [], constantMap);
    } catch (err) {
      // Ignore parse errors for unrelated files
      continue;
    }
  }

  // Cache the result before returning so subsequent look-ups are instantaneous
  constantMapCache[directory] = constantMap;
  return constantMap;
}

/**
 * Analyzes a Ruby file for analytics tracking calls
 * @param {string} filePath - Path to the Ruby file to analyze
 * @param {string} customFunction - Optional custom tracking function name
 * @returns {Promise<Array>} Array of tracking events found in the file
 * @throws {Error} If the file cannot be read or parsed
 */
async function analyzeRubyFile(filePath, customFunctionSignatures = null) {
  // Lazy load the Ruby Prism parser
  if (!parse) {
    const { loadPrism } = await import('@ruby/prism');
    parse = await loadPrism();
  }

  try {
    // Read the file content
    const code = fs.readFileSync(filePath, 'utf8');

    // Build constant map for current directory (sibling .rb files)
    const currentDir = path.dirname(filePath);
    const constantMap = await buildConstantMapForDirectory(currentDir);

    // Merge constants from all cached maps (to allow cross-directory resolution)
    for (const dir in constantMapCache) {
      if (dir !== currentDir) {
        Object.assign(constantMap, constantMapCache[dir]);
      }
    }

    // Parse the Ruby code into an AST once
    let ast;
    try {
      ast = await parse(code);
    } catch (parseError) {
      console.error(`Error parsing file ${filePath}:`, parseError.message);
      return [];
    }

    // Collect variable assignments to hash literals within the file
    const variableMap = {};
    try {
      await collectVariableAssignments(ast.value, variableMap);
    } catch (_) {}

    // Single visitor pass covering all custom configs, with constant map and variable map for resolution
    const visitor = new TrackingVisitor(code, filePath, customFunctionSignatures || [], constantMap, variableMap);
    const events = await visitor.analyze(ast);

    // Deduplicate events
    const unique = new Map();
    for (const evt of events) {
      const key = `${evt.source}|${evt.eventName}|${evt.line}|${evt.functionName}`;
      if (!unique.has(key)) unique.set(key, evt);
    }

    return Array.from(unique.values());

  } catch (fileError) {
    console.error(`Error reading or processing file ${filePath}:`, fileError.message);
    return [];
  }
}

// New utility: collect local variable assignments that point to hash literals
async function collectVariableAssignments(node, variableMap) {
  if (!node) return;

  const prism = await import('@ruby/prism');
  const LocalVariableWriteNode = prism.LocalVariableWriteNode;
  const HashNode = prism.HashNode;
  const CallNode = prism.CallNode;

  if (LocalVariableWriteNode && node instanceof LocalVariableWriteNode) {
    if (node.value instanceof HashNode) {
      const varName = node.name;
      // Reuse existing extractor to turn HashNode into properties object
      const { extractHashProperties } = require('./extractors');
      const props = await extractHashProperties(node.value);
      variableMap[varName] = props;
    } else if (node.value instanceof CallNode) {
      // Handle patterns like { ... }.compact or { ... }.compact!
      const callNode = node.value;
      const methodName = callNode.name;

      // Check if the call is a compact/compact! call with a Hash receiver
      if ((methodName === 'compact' || methodName === 'compact!') && callNode.receiver instanceof HashNode) {
        const varName = node.name;
        const { extractHashProperties } = require('./extractors');
        const props = await extractHashProperties(callNode.receiver);
        variableMap[varName] = props;
      }
    }
  }

  // Recurse similarly to collectConstants generic traversal
  const keys = Object.keys(node);
  for (const key of keys) {
    const val = node[key];
    if (!val) continue;

    const traverseChild = async (child) => {
      if (child && typeof child === 'object' && (child.location || child.constructor?.name?.endsWith('Node'))) {
        await collectVariableAssignments(child, variableMap);
      }
    };

    if (Array.isArray(val)) {
      for (const c of val) {
        await traverseChild(c);
      }
    } else {
      await traverseChild(val);
    }
  }
}

// Helper to prebuild constant maps for all discovered ruby directories in a project
async function prebuildConstantMaps(rubyFiles) {
  const dirs = new Set(rubyFiles.map(f => path.dirname(f)));
  for (const dir of dirs) {
    try {
      await buildConstantMapForDirectory(dir);
    } catch (_) {
      // ignore
    }
  }
}

module.exports = { 
  analyzeRubyFile,
  buildConstantMapForDirectory,
  prebuildConstantMaps
};
