/**
 * Custom function detection for Swift
 */

const { normalizeChainPart, endsWithChain, extractStringLiteral, isIdentifier } = require('./utils');

function matchCustomSignature(call, customFunctionSignatures) {
  if (!Array.isArray(customFunctionSignatures) || customFunctionSignatures.length === 0) return null;
  const chain = Array.isArray(call.calleeChain) ? call.calleeChain.map(normalizeChainPart) : [];

  for (const cfg of customFunctionSignatures) {
    if (!cfg || !cfg.functionName) continue;
    const sigParts = cfg.functionName.split('.').map(normalizeChainPart).filter(Boolean);
    if (sigParts.length === 0) continue;
    if (endsWithChain(chain, sigParts)) return cfg;
  }
  return null;
}

function matchImplicitCustom(call) {
  const chain = Array.isArray(call.calleeChain) ? call.calleeChain.map(normalizeChainPart) : [];
  const last = chain[chain.length - 1] || '';
  if (last === 'module' || last === 'func') {
    return { functionName: chain.join('.'), eventIndex: 0, propertiesIndex: 1, extraParams: [] };
  }
  const name = call.name || '';
  if (/^customTrackFunction\d*$/.test(name)) {
    return { functionName: name, eventIndex: 0, propertiesIndex: 1, extraParams: [] };
  }
  if (name === 'customTrackNoProps') {
    return { functionName: name, eventIndex: 0, propertiesIndex: 9999, extraParams: [] };
  }
  return null;
}

module.exports = { matchCustomSignature, matchImplicitCustom };
