// Create new file with parser implementation
function parseCustomFunctionSignature(signature) {
  if (!signature || typeof signature !== 'string') {
    return null;
  }

  // Match function name and optional parameter list
  // Supports names with module prefix like Module.func
  const match = signature.match(/^\s*([A-Za-z0-9_.]+)\s*(?:\(([^)]*)\))?\s*$/);
  if (!match) {
    return null;
  }

  const functionName = match[1].trim();
  const paramsPart = match[2];

  // Default legacy behaviour: EVENT_NAME, PROPERTIES
  if (!paramsPart) {
    return {
      functionName,
      eventIndex: 0,
      propertiesIndex: 1,
      extraParams: []
    };
  }

  // Split params by comma, trimming whitespace
  const params = paramsPart.split(',').map(p => p.trim()).filter(Boolean);

  const eventIndex = params.findIndex(p => p.toUpperCase() === 'EVENT_NAME');
  let propertiesIndex = params.findIndex(p => p.toUpperCase() === 'PROPERTIES');

  if (eventIndex === -1) {
    throw new Error('EVENT_NAME is required in custom function signature');
  }

  if (propertiesIndex === -1) {
    // If PROPERTIES is missing, assume it's at the end of the parameters
    propertiesIndex = params.length;
  }

  const extraParams = params.map((name, idx) => ({ idx, name }))
    .filter(p => !(p.idx === eventIndex || p.idx === propertiesIndex));

  return {
    functionName,
    eventIndex,
    propertiesIndex,
    extraParams
  };
}

module.exports = {
  parseCustomFunctionSignature
};
