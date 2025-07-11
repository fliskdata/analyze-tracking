/**
 * @fileoverview Event and property extraction utilities for Ruby analytics
 * @module analyze/ruby/extractors
 */

const { getValueType } = require('./types');
const prismPromise = import('@ruby/prism');

/**
 * Extracts the event name from a tracking call based on the source
 * @param {Object} node - The AST CallNode
 * @param {string} source - The detected analytics source
 * @param {Object} customConfig - Custom configuration for custom functions
 * @param {Object} constantMap - Map of constants to resolve constant paths
 * @returns {string|null} - The extracted event name or null
 */
async function extractEventName(node, source, customConfig = null, constantMap = {}) {
  if (source === 'segment' || source === 'rudderstack') {
    // Both Segment and Rudderstack use the same format
    const params = node.arguments_?.arguments_?.[0]?.elements;
    if (!params || !Array.isArray(params)) {
      return null;
    }
    const eventProperty = params.find(param => param?.key?.unescaped?.value === 'event');
    return eventProperty?.value?.unescaped?.value || null;
  }

  if (source === 'mixpanel') {
    // Mixpanel Ruby SDK format: tracker.track('distinct_id', 'event_name', {...})
    const args = node.arguments_?.arguments_;
    if (args && args.length > 1 && args[1]?.unescaped?.value) {
      return args[1].unescaped.value;
    }
  }

  if (source === 'posthog') {
    // PostHog Ruby SDK format: posthog.capture({distinct_id: '...', event: '...', properties: {...}})
    const hashArg = node.arguments_?.arguments_?.[0];
    if (hashArg && hashArg.elements && Array.isArray(hashArg.elements)) {
      const eventProperty = hashArg.elements.find(elem => elem?.key?.unescaped?.value === 'event');
      return eventProperty?.value?.unescaped?.value || null;
    }
  }

  if (source === 'snowplow') {
    // Snowplow Ruby SDK: tracker.track_struct_event(category: '...', action: '...', ...)
    const params = node.arguments_?.arguments_?.[0]?.elements;
    if (!params || !Array.isArray(params)) {
      return null;
    }
    const actionProperty = params.find(param => param?.key?.unescaped?.value === 'action');
    return actionProperty?.value?.unescaped?.value || null;
  }
  
  if (source === 'custom') {
    const args = node.arguments_?.arguments_ || [];

    if (!customConfig) {
      // Fallback: first argument string literal event name
      if (args[0]?.unescaped?.value) {
        return args[0].unescaped.value;
      }
      return null;
    }

    const eventArg = args[customConfig.eventIndex];
    if (eventArg) {
      // String literal
      if (eventArg.unescaped?.value) {
        return eventArg.unescaped.value;
      }

      // Constant references
      const { ConstantReadNode, ConstantPathNode } = await prismPromise;
      const buildConstPath = (n) => {
        if (!n) return '';
        if (n instanceof ConstantReadNode) return n.name;
        if (n instanceof ConstantPathNode) {
          const parent = buildConstPath(n.parent);
          return parent ? `${parent}::${n.name}` : n.name;
        }
        return '';
      };

      if (eventArg instanceof ConstantReadNode) {
        const name = eventArg.name;
        // Try to resolve with current constant map, else return name
        return constantMap[name] || name;
      }
      if (eventArg instanceof ConstantPathNode) {
        const pathStr = buildConstPath(eventArg);
        return constantMap[pathStr] || pathStr;
      }
    }
    return null;
  }

  return null;
}

/**
 * Extracts properties from a tracking call based on the source
 * @param {Object} node - The AST CallNode
 * @param {string} source - The detected analytics source
 * @param {Object} customConfig - Custom configuration for custom functions
 * @returns {Object|null} - The extracted properties or null
 */
async function extractProperties(node, source, customConfig = null, variableMap = null) {
  const { HashNode, ArrayNode } = await prismPromise;

  if (source === 'segment' || source === 'rudderstack') {
    // Both Segment and Rudderstack use the same format
    const params = node.arguments_?.arguments_?.[0]?.elements;
    if (!params || !Array.isArray(params)) {
      return null;
    }
    const properties = {};

    // Process all top-level fields except 'event'
    for (const param of params) {
      const key = param?.key?.unescaped?.value;
      
      if (key && key !== 'event') {
        const value = param?.value;

        if (key === 'properties' && value instanceof HashNode) {
          // Merge properties from the 'properties' hash into the top level
          const nestedProperties = await extractHashProperties(value);
          Object.assign(properties, nestedProperties);
        } else if (value instanceof HashNode) {
          // Handle other nested hash objects
          const hashProperties = await extractHashProperties(value);
          properties[key] = {
            type: 'object',
            properties: hashProperties
          };
        } else if (value instanceof ArrayNode) {
          // Handle arrays
          const arrayItems = await extractArrayItemProperties(value);
          properties[key] = {
            type: 'array',
            items: arrayItems
          };
        } else {
          // Handle primitive values
          const valueType = await getValueType(value);
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
    const args = node.arguments_?.arguments_;
    const properties = {};
    
    // Add distinct_id as property (even if it's a variable)
    if (args && args.length > 0) {
      properties.distinct_id = {
        type: await getValueType(args[0])
      };
    }
    
    // Extract properties from third argument if it exists
    if (args && args.length > 2 && args[2] instanceof HashNode) {
      const propsHash = await extractHashProperties(args[2]);
      Object.assign(properties, propsHash);
    }
    
    return properties;
  }

  if (source === 'posthog') {
    // PostHog Ruby SDK: posthog.capture({distinct_id: '...', event: '...', properties: {...}})
    const hashArg = node.arguments_?.arguments_?.[0];
    const properties = {};
    
    if (hashArg && hashArg.elements && Array.isArray(hashArg.elements)) {
      // Extract distinct_id if present
      const distinctIdProperty = hashArg.elements.find(elem => elem?.key?.unescaped?.value === 'distinct_id');
      if (distinctIdProperty?.value) {
        properties.distinct_id = {
          type: await getValueType(distinctIdProperty.value)
        };
      }
      
      // Extract properties
      const propsProperty = hashArg.elements.find(elem => elem?.key?.unescaped?.value === 'properties');
      if (propsProperty?.value instanceof HashNode) {
        const props = await extractHashProperties(propsProperty.value);
        Object.assign(properties, props);
      }
    }
    
    return properties;
  }

  if (source === 'snowplow') {
    // Snowplow Ruby SDK: tracker.track_struct_event(category: '...', action: '...', ...)
    const params = node.arguments_?.arguments_?.[0]?.elements;
    if (!params || !Array.isArray(params)) {
      return null;
    }
    const properties = {};
    
    // Extract all struct event parameters except 'action' (which is used as the event name)
    for (const param of params) {
      const key = param?.key?.unescaped?.value;
      if (key && key !== 'action') {
        properties[key] = {
          type: await getValueType(param.value)
        };
      }
    }
    
    return properties;
  }
  
  if (source === 'custom') {
    const args = node.arguments_?.arguments_ || [];

    if (!customConfig) {
      // Legacy fallback behavior
      if (args.length > 1 && args[1] instanceof HashNode) {
        return await extractHashProperties(args[1]);
      }
      return null;
    }

    const properties = {};

    // Handle extra params first
    for (const extra of customConfig.extraParams) {
      const argNode = args[extra.idx];
      if (!argNode) continue;
      properties[extra.name] = {
        type: await getValueType(argNode)
      };
    }

    // Handle properties object
    const propsArg = args[customConfig.propertiesIndex];
    if (propsArg instanceof HashNode) {
      const hashProps = await extractHashProperties(propsArg);
      Object.assign(properties, hashProps);
    } else {
      // Attempt to resolve variable references (e.g., a local variable containing a hash)
      const prism = await prismPromise;
      const LocalVariableReadNode = prism.LocalVariableReadNode;

      if (variableMap && LocalVariableReadNode && propsArg instanceof LocalVariableReadNode) {
        const varName = propsArg.name;
        if (variableMap[varName]) {
          Object.assign(properties, variableMap[varName]);
        }
      } else if (variableMap && propsArg && typeof propsArg.name === 'string' && variableMap[propsArg.name]) {
        // Fallback: match by variable name when node type isn't LocalVariableReadNode
        Object.assign(properties, variableMap[propsArg.name]);
      }
    }

    return Object.keys(properties).length > 0 ? properties : null;
  }

  return null;
}

/**
 * Extracts properties from a HashNode
 * @param {Object} hashNode - The HashNode to extract properties from
 * @returns {Object} - The extracted properties
 */
async function extractHashProperties(hashNode) {
  const { AssocNode, HashNode, ArrayNode } = await prismPromise;
  const properties = {};
  
  for (const element of hashNode.elements) {
    if (element instanceof AssocNode) {
      const key = element.key.unescaped?.value;
      const value = element.value;

      if (key) {
        if (value instanceof HashNode) {
          // Handle nested hash objects
          const nestedProperties = await extractHashProperties(value);
          properties[key] = {
            type: 'object',
            properties: nestedProperties
          };
        } else if (value instanceof ArrayNode) {
          // Handle arrays
          const items = await extractArrayItemProperties(value);
          properties[key] = {
            type: 'array',
            items
          };
        } else {
          // Handle primitive values
          const valueType = await getValueType(value);
          properties[key] = {
            type: valueType
          };
        }
      }
    }
  }

  return properties;
}

/**
 * Extracts property information from array items
 * @param {Object} arrayNode - The ArrayNode to analyze
 * @returns {Object} - Type information for array items
 */
async function extractArrayItemProperties(arrayNode) {
  const { HashNode } = await prismPromise;

  if (arrayNode.elements.length === 0) {
    return { type: 'any' };
  }

  const firstItem = arrayNode.elements[0];
  if (firstItem instanceof HashNode) {
    return {
      type: 'object',
      properties: await extractHashProperties(firstItem)
    };
  } else {
    const valueType = await getValueType(firstItem);
    return {
      type: valueType
    };
  }
}

module.exports = {
  extractEventName,
  extractProperties,
  extractHashProperties,
  extractArrayItemProperties
};
