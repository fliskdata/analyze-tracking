const fs = require('fs');

let parse = null;

// Create a visitor to traverse the AST
class TrackingVisitor {
  constructor(code, filePath) {
    this.code = code;
    this.lines = code.split('\n');
    this.ancestors = [];
    this.events = [];
    this.filePath = filePath;
  }

  getLineNumber(location) {
    // Count the number of newlines before the start offset
    const beforeStart = this.code.slice(0, location.startOffset);
    return beforeStart.split('\n').length;
  }

  async findWrappingFunction(node, ancestors) {
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

  detectSource(node) {
    if (!node) return null;
  
    // Check for analytics libraries
    if (node.receiver) {
      const objectName = node.receiver.name;
      const methodName = node.name;

      // Segment
      if (objectName === 'Analytics' && methodName === 'track') return 'segment';
      
      // Mixpanel (Ruby SDK uses Mixpanel::Tracker instance)
      if (methodName === 'track' && node.receiver.type === 'CallNode' && 
          node.receiver.name === 'tracker') return 'mixpanel';
      
      // PostHog
      if (objectName === 'posthog' && methodName === 'capture') return 'posthog';
    }
    
    // Snowplow (typically tracker.track_struct_event)
    if (node.name === 'track_struct_event') return 'snowplow';
  
    return null;
  }

  extractEventName(node, source) {
    if (source === 'segment') {
      const params = node.arguments_.arguments_[0].elements;
      const eventProperty = params.find(param => param?.key?.unescaped?.value === 'event');
      return eventProperty?.value?.unescaped?.value || null;
    }

    if (source === 'mixpanel') {
      // Mixpanel Ruby SDK format: tracker.track('distinct_id', 'event_name', {...})
      const args = node.arguments_.arguments_;
      if (args && args.length > 1 && args[1]?.unescaped?.value) {
        return args[1].unescaped.value;
      }
    }

    if (source === 'posthog') {
      // PostHog Ruby SDK format: posthog.capture({distinct_id: '...', event: '...', properties: {...}})
      const hashArg = node.arguments_.arguments_[0];
      if (hashArg && hashArg.elements) {
        const eventProperty = hashArg.elements.find(elem => elem?.key?.unescaped?.value === 'event');
        return eventProperty?.value?.unescaped?.value || null;
      }
    }

    if (source === 'snowplow') {
      // Snowplow Ruby SDK: tracker.track_struct_event(category: '...', action: '...', ...)
      const params = node.arguments_.arguments_[0].elements;
      const actionProperty = params.find(param => param?.key?.unescaped?.value === 'action');
      return actionProperty?.value?.unescaped?.value || null;
    }

    return null;
  }

  async extractProperties(node, source) {
    const { HashNode, ArrayNode } = await import('@ruby/prism');

    if (source === 'segment') {
      const params = node.arguments_.arguments_[0].elements;
      const properties = {};

      // Process all top-level fields except 'event'
      for (const param of params) {
        const key = param?.key?.unescaped?.value;
        
        if (key && key !== 'event') {
          const value = param?.value;

          if (key === 'properties' && value instanceof HashNode) {
            // Merge properties from the 'properties' hash into the top level
            const nestedProperties = await this.extractHashProperties(value);
            Object.assign(properties, nestedProperties);
          } else if (value instanceof HashNode) {
            // Handle other nested hash objects
            const hashProperties = await this.extractHashProperties(value);
            properties[key] = {
              type: 'object',
              properties: hashProperties
            };
          } else if (value instanceof ArrayNode) {
            // Handle arrays
            const arrayItems = await this.extractArrayItemProperties(value);
            properties[key] = {
              type: 'array',
              items: arrayItems
            };
          } else {
            // Handle primitive values
            const valueType = await this.getValueType(value);
            properties[key] = {
              type: valueType
            };
          }
        }
      }

      return properties;
    }

    if (source === 'mixpanel') {
      // Mixpanel Ruby SDK: tracker.track('distinct_id', 'event_name', {properties})
      const args = node.arguments_.arguments_;
      const properties = {};
      
      // Add distinct_id as property
      if (args && args.length > 0 && args[0]?.unescaped?.value) {
        properties.distinct_id = {
          type: 'string'
        };
      }
      
      // Extract properties from third argument if it exists
      if (args && args.length > 2 && args[2] instanceof HashNode) {
        const propsHash = await this.extractHashProperties(args[2]);
        Object.assign(properties, propsHash);
      }
      
      return properties;
    }

    if (source === 'posthog') {
      // PostHog Ruby SDK: posthog.capture({distinct_id: '...', event: '...', properties: {...}})
      const hashArg = node.arguments_.arguments_[0];
      const properties = {};
      
      if (hashArg && hashArg.elements) {
        // Extract distinct_id if present
        const distinctIdProperty = hashArg.elements.find(elem => elem?.key?.unescaped?.value === 'distinct_id');
        if (distinctIdProperty?.value) {
          properties.distinct_id = {
            type: await this.getValueType(distinctIdProperty.value)
          };
        }
        
        // Extract properties
        const propsProperty = hashArg.elements.find(elem => elem?.key?.unescaped?.value === 'properties');
        if (propsProperty?.value instanceof HashNode) {
          const props = await this.extractHashProperties(propsProperty.value);
          Object.assign(properties, props);
        }
      }
      
      return properties;
    }

    if (source === 'snowplow') {
      // Snowplow Ruby SDK: tracker.track_struct_event(category: '...', action: '...', ...)
      const params = node.arguments_.arguments_[0].elements;
      const properties = {};
      
      // Extract all struct event parameters except 'action' (which is used as the event name)
      for (const param of params) {
        const key = param?.key?.unescaped?.value;
        if (key && key !== 'action') {
          properties[key] = {
            type: await this.getValueType(param.value)
          };
        }
      }
      
      return properties;
    }

    return null;
  }

  async extractHashProperties(hashNode) {
    const { AssocNode, HashNode, ArrayNode } = await import('@ruby/prism');
    const properties = {};
    
    for (const element of hashNode.elements) {
      if (element instanceof AssocNode) {
        const key = element.key.unescaped?.value;
        const value = element.value;

        if (key) {
          if (value instanceof HashNode) {
            // Handle nested hash objects
            const nestedProperties = await this.extractHashProperties(value);
            properties[key] = {
              type: 'object',
              properties: nestedProperties
            };
          } else if (value instanceof ArrayNode) {
            // Handle arrays
            const items = await this.extractArrayItemProperties(value);
            properties[key] = {
              type: 'array',
              items
            };
          } else {
            // Handle primitive values
            const valueType = await this.getValueType(value);
            properties[key] = {
              type: valueType
            };
          }
        }
      }
    }

    return properties;
  }

  async extractArrayItemProperties(arrayNode) {
    const { HashNode } = await import('@ruby/prism');

    if (arrayNode.elements.length === 0) {
      return { type: 'any' };
    }

    const firstItem = arrayNode.elements[0];
    if (firstItem instanceof HashNode) {
      return {
        type: 'object',
        properties: this.extractHashProperties(firstItem)
      };
    } else {
      const valueType = await this.getValueType(firstItem);
      return {
        type: valueType
      };
    }
  }

  async getValueType(node) {
    const { StringNode, IntegerNode, FloatNode, TrueNode, FalseNode, NilNode, SymbolNode, CallNode } = await import('@ruby/prism');

    if (node instanceof StringNode) return 'string';
    if (node instanceof IntegerNode || node instanceof FloatNode) return 'number';
    if (node instanceof TrueNode || node instanceof FalseNode) return 'boolean';
    if (node instanceof NilNode) return 'null';
    if (node instanceof SymbolNode) return 'string';
    if (node instanceof CallNode) return 'any'; // Dynamic values
    return 'any'; // Default type
  }

  async visit(node) {
    const { CallNode, ProgramNode, StatementsNode, DefNode, IfNode, BlockNode, ArgumentsNode, HashNode, AssocNode, ClassNode } = await import('@ruby/prism');
    if (!node) return;

    this.ancestors.push(node);

    // Check if this is a tracking call
    if (node instanceof CallNode) {
      try {
        const source = this.detectSource(node);
        const eventName = this.extractEventName(node, source);

        if (!source || !eventName) {
          this.ancestors.pop();
          return;
        }

        const line = this.getLineNumber(node.location);
        const functionName = await this.findWrappingFunction(node, this.ancestors);
        const properties = await this.extractProperties(node, source);

        this.events.push({
          eventName,
          source,
          properties,
          filePath: this.filePath,
          line,
          functionName
        });
      } catch (nodeError) {
        console.error(`Error processing node in ${this.filePath}`);
      }
    }

    // Visit all child nodes
    if (node instanceof ProgramNode) {
      await this.visit(node.statements);
    } else if (node instanceof StatementsNode) {
      for (const child of node.body) {
        await this.visit(child);
      }
    } else if (node instanceof ClassNode) {
      if (node.body) {
        await this.visit(node.body);
      }
    } else if (node instanceof DefNode) {
      if (node.body) {
        await this.visit(node.body);
      }
    } else if (node instanceof IfNode) {
      if (node.statements) {
        await this.visit(node.statements);
      }
      if (node.subsequent) {
        await this.visit(node.subsequent);
      }
    } else if (node instanceof BlockNode) {
      if (node.body) {
        await this.visit(node.body);
      }
    } else if (node instanceof ArgumentsNode) {
      for (const arg of node.arguments) {
        await this.visit(arg);
      }
    } else if (node instanceof HashNode) {
      for (const element of node.elements) {
        await this.visit(element);
      }
    } else if (node instanceof AssocNode) {
      await this.visit(node.key);
      await this.visit(node.value);
    }

    this.ancestors.pop();
  }
}

async function analyzeRubyFile(filePath) {
  // Lazy load the ruby prism parser
  if (!parse) {
    const { loadPrism } = await import('@ruby/prism');
    parse = await loadPrism();
  }

  try {
    const code = fs.readFileSync(filePath, 'utf8');
    let ast;
    try {
      ast = await parse(code);
    } catch (parseError) {
      console.error(`Error parsing file ${filePath}`);
      return []; // Return empty events array if parsing fails
    }

    // Traverse the AST starting from the program node
    const visitor = new TrackingVisitor(code, filePath);
    await visitor.visit(ast.value);

    return visitor.events;

  } catch (fileError) {
    console.error(`Error reading or processing file ${filePath}`);
  }

  return [];
}

module.exports = { analyzeRubyFile };
