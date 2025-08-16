// Create new file with parser implementation
function parseCustomFunctionSignature(signature) {
  if (!signature || typeof signature !== 'string') {
    return null;
  }

  const trimmed = signature.trim();

  // Two cases:
  // 1) Full signature with params at the end (e.g., Module.track(EVENT_NAME, PROPERTIES)) → parse params
  // 2) Name-only (including chains with internal calls, e.g., getService().track) → no params
  let functionName;
  let paramsPart = null;

  if (/\)\s*$/.test(trimmed)) {
    // Looks like it ends with a parameter list – extract the final (...) only
    const lastOpenIdx = trimmed.lastIndexOf('(');
    const lastCloseIdx = trimmed.lastIndexOf(')');
    if (lastOpenIdx === -1 || lastCloseIdx < lastOpenIdx) {
      return null;
    }
    functionName = trimmed.slice(0, lastOpenIdx).trim();
    paramsPart = trimmed.slice(lastOpenIdx + 1, lastCloseIdx);
  } else {
    // No trailing params – treat the whole string as the function name
    functionName = trimmed;
  }

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
