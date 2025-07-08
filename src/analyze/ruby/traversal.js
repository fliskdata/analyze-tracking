/**
 * @fileoverview AST traversal utilities for Ruby code analysis
 * @module analyze/ruby/traversal
 */


// Prevent infinite recursion in AST traversal
const MAX_RECURSION_DEPTH = 20;

/**
 * Finds the wrapping function for a given node
 * @param {Object} node - The current AST node
 * @param {Array} ancestors - The ancestor nodes stack
 * @returns {string} - The function name or 'global'/'block'
 */
async function findWrappingFunction(node, ancestors) {
  const { DefNode, BlockNode, LambdaNode } = await import('@ruby/prism');

  for (let i = ancestors.length - 1; i >= 0; i--) {
    const current = ancestors[i];

    // Handle method definitions
    if (current instanceof DefNode) {
      return current.name;
    }

    // Handle blocks and lambdas
    if (current instanceof BlockNode || current instanceof LambdaNode) {
      return 'block';
    }
  }
  return 'global';
}

/**
 * Recursively traverses the AST tree
 * @param {Object} node - The current AST node
 * @param {Function} nodeVisitor - Function to call for each node
 * @param {Array} ancestors - The ancestor nodes stack
 * @param {number} depth - Current recursion depth to prevent infinite loops
 */
async function traverseNode(node, nodeVisitor, ancestors = [], depth = 0) {
  const { 
    ProgramNode, 
    StatementsNode, 
    DefNode, 
    IfNode, 
    BlockNode, 
    ArgumentsNode, 
    HashNode, 
    AssocNode, 
    ClassNode, 
    ModuleNode,
    CallNode,
    CaseNode,
    WhenNode
  } = await import('@ruby/prism');

  if (!node) return;

  // Prevent infinite recursion with depth limit
  if (depth > MAX_RECURSION_DEPTH) {
    return;
  }

  // Check for circular references - if this node is already in ancestors, skip it
  if (ancestors.includes(node)) {
    return;
  }

  ancestors.push(node);

  // Call the visitor for this node
  if (node instanceof CallNode) {
    await nodeVisitor(node, ancestors);
  }

  // Visit all child nodes based on node type
  if (node instanceof ProgramNode) {
    await traverseNode(node.statements, nodeVisitor, ancestors, depth + 1);
  } else if (node instanceof StatementsNode) {
    for (const child of node.body) {
      await traverseNode(child, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof ClassNode) {
    if (node.body) {
      await traverseNode(node.body, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof ModuleNode) {
    if (node.body) {
      await traverseNode(node.body, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof DefNode) {
    if (node.body) {
      await traverseNode(node.body, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof IfNode) {
    if (node.statements) {
      await traverseNode(node.statements, nodeVisitor, ancestors, depth + 1);
    }
    if (node.subsequent) {
      await traverseNode(node.subsequent, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof BlockNode) {
    if (node.body) {
      await traverseNode(node.body, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof ArgumentsNode) {
    const argsList = node.arguments || [];
    for (const arg of argsList) {
      await traverseNode(arg, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof HashNode) {
    for (const element of node.elements) {
      await traverseNode(element, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof AssocNode) {
    await traverseNode(node.key, nodeVisitor, ancestors, depth + 1);
    await traverseNode(node.value, nodeVisitor, ancestors, depth + 1);
  } else if (node instanceof CaseNode) {
    // Traverse through each 'when' clause and the optional else clause
    const whenClauses = node.whens || node.conditions || node.when_bodies || [];
    for (const when of whenClauses) {
      await traverseNode(when, nodeVisitor, ancestors, depth + 1);
    }
    if (node.else_) {
      await traverseNode(node.else_, nodeVisitor, ancestors, depth + 1);
    } else if (node.elseBody) {
      await traverseNode(node.elseBody, nodeVisitor, ancestors, depth + 1);
    }
  } else if (node instanceof WhenNode) {
    // Handle a single when clause: traverse its condition(s) and body
    if (Array.isArray(node.conditions)) {
      for (const cond of node.conditions) {
        await traverseNode(cond, nodeVisitor, ancestors, depth + 1);
      }
    } else if (node.conditions) {
      await traverseNode(node.conditions, nodeVisitor, ancestors, depth + 1);
    }
    if (node.statements) {
      await traverseNode(node.statements, nodeVisitor, ancestors, depth + 1);
    }
    if (node.next) {
      await traverseNode(node.next, nodeVisitor, ancestors, depth + 1);
    }
  } else {
    // Generic fallback: iterate over enumerable properties to find nested nodes
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (!val) continue;

      const visitChild = async (child) => {
        if (child && typeof child === 'object') {
          // More restrictive check: ensure it's actually a Prism AST node
          // Check for specific Prism node indicators and avoid circular references
          if (
            child.location && 
            child.constructor && 
            child.constructor.name && 
            child.constructor.name.endsWith('Node') &&
            !ancestors.includes(child)
          ) {
            await traverseNode(child, nodeVisitor, ancestors, depth + 1);
          }
        }
      };

      if (Array.isArray(val)) {
        for (const c of val) {
          await visitChild(c);
        }
      } else {
        await visitChild(val);
      }
    }
  }

  ancestors.pop();
}

/**
 * Gets the line number for a given location in the code
 * @param {string} code - The full source code
 * @param {Object} location - The location object with startOffset
 * @returns {number} - The line number (1-indexed)
 */
function getLineNumber(code, location) {
  // Count the number of newlines before the start offset
  const beforeStart = code.slice(0, location.startOffset);
  return beforeStart.split('\n').length;
}

module.exports = {
  findWrappingFunction,
  traverseNode,
  getLineNumber
};
