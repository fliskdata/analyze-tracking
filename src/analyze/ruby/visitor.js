/**
 * @fileoverview AST visitor for analyzing Ruby tracking events
 * @module analyze/ruby/visitor
 */

const { detectSource } = require('./detectors');
const { extractEventName, extractProperties } = require('./extractors');
const { findWrappingFunction, traverseNode, getLineNumber } = require('./traversal');

class TrackingVisitor {
  constructor(code, filePath, customConfigs = [], constantMap = {}, variableMap = {}) {
    this.code = code;
    this.filePath = filePath;
    this.customConfigs = Array.isArray(customConfigs) ? customConfigs : [];
    this.constantMap = constantMap || {};
    this.variableMap = variableMap || {};
    this.events = [];
  }

  /**
   * Processes a call node to extract tracking event information
   * @param {Object} node - The CallNode to process
   * @param {Array} ancestors - The ancestor nodes stack
   */
  async processCallNode(node, ancestors) {
    try {
      let matchedConfig = null;
      let source = null;

      // Try to match any custom config first
      for (const cfg of this.customConfigs) {
        if (!cfg) continue;
        if (detectSource(node, cfg.functionName) === 'custom') {
          matchedConfig = cfg;
          source = 'custom';
          break;
        }
      }

      // If no custom match, attempt built-in providers
      if (!source) {
        source = detectSource(node, null);
      }

      if (!source) return;

      const eventName = await extractEventName(node, source, matchedConfig, this.constantMap);
      if (!eventName) return;

      const line = getLineNumber(this.code, node.location);
      
      // Always use the enclosing method/block/global context for the function name
      const functionName = await findWrappingFunction(node, ancestors);
      
      const properties = await extractProperties(node, source, matchedConfig, this.variableMap);

      this.events.push({
        eventName,
        source,
        properties,
        filePath: this.filePath,
        line,
        functionName
      });
    } catch (nodeError) {
      console.error(`Error processing node in ${this.filePath}:`, nodeError.message);
    }
  }

  /**
   * Analyzes the AST to find tracking events
   * @param {Object} ast - The parsed AST
   * @returns {Array} - Array of tracking events found
   */
  async analyze(ast) {
    // Create a visitor function that will be called for each CallNode
    const nodeVisitor = async (node, ancestors) => {
      await this.processCallNode(node, ancestors);
    };

    // Traverse the AST starting from the program node
    await traverseNode(ast.value, nodeVisitor);

    return this.events;
  }
}

module.exports = TrackingVisitor;
