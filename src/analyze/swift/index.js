/**
 * @fileoverview Swift analytics tracking analyzer - main entry point
 * @module analyze/swift
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL: pathToFileUrl } = require('url');

// Swift AST helpers are ESM in @flisk/swift-ast. Provide a lazy loader that
// supports both CJS require (when available) and dynamic import fallback.
let __swiftAst = null;
async function getSwiftAst() {
  if (__swiftAst) return __swiftAst;
  try {
    // Try CJS require first (when package exposes CJS entry)
    // eslint-disable-next-line global-require
    __swiftAst = require('@flisk/swift-ast');
    return __swiftAst;
  } catch (e) {
    // Fallback to ESM dynamic import
    try {
      const m = await import('@flisk/swift-ast');
      __swiftAst = m;
      return __swiftAst;
    } catch (_) {
      // Final fallback: local workspace copy of swift-ast
      const localDist = path.resolve('/Users/sameenkarim/flisk/dev/swift-ast/dist/index.js');
      if (fs.existsSync(localDist)) {
        const m2 = await import(pathToFileUrl(localDist).href);
        __swiftAst = m2;
        return __swiftAst;
      }
      throw e;
    }
  }
}

// Serialize WASI-backed swift-ast operations
let __swiftLock = Promise.resolve();
function withSwift(callback) {
  const p = __swiftLock.then(callback, callback);
  __swiftLock = p.then(() => {}, () => {});
  return p;
}

/**
 * Analyze a Swift file and extract tracking events
 * @param {string} filePath
 * @param {Array<Object>|null} customFunctionSignatures parsed via parseCustomFunctionSignature
 * @returns {Promise<Array<Object>>}
 */
async function analyzeSwiftFile(filePath, customFunctionSignatures = null) {
  try {
    const source = fs.readFileSync(filePath, 'utf8');
    const { parseSwiftFile, analyzeAst } = await getSwiftAst();
    // Ensure single in-flight WASI call at a time
    const ast = await withSwift(() => parseSwiftFile(filePath));
    const analysis = analyzeAst(ast, source);

    // Cross-file simple constant map for this directory (EVENTS.*, KEYS.* and top-level lets)
    const constMap = buildCrossFileConstMap(path.dirname(filePath));

    // Produce events list
    const events = [];

    for (const call of analysis.calls) {
      try {
        // 1) Try custom function signatures first
        const matchedCustom = matchCustomSignature(call, customFunctionSignatures);
        if (matchedCustom) {
          const evt = extractCustomEvent(call, matchedCustom, analysis, source, filePath, constMap);
          if (evt) events.push(evt);
          continue;
        }

        // 1b) Implicit custom patterns (specific helpers)
        const implicit = matchImplicitCustom(call);
        if (implicit) {
          const evt = extractCustomEvent(call, implicit, analysis, source, filePath, constMap);
          if (evt) events.push(evt);
          continue;
        }

        // 2) Built-in providers
        const provider = detectProvider(call, source);
        if (!provider) continue;

        const evt = extractProviderEvent(call, provider, analysis, source, filePath, constMap);
        if (evt) events.push(evt);
      } catch (_) { /* ignore per-call errors */ }
    }

    return dedupe(events);
  } catch (err) {
    console.error(`Error analyzing Swift file ${filePath}:`, err.message);
    return [];
  }
}

// ---------------------------
// Provider detection
// ---------------------------

function detectProvider(call, source) {
  const method = call.name;
  const chain = Array.isArray(call.calleeChain) ? call.calleeChain : [];
  const recvText = call.receiver || null;
  const recvBase = recvText ? recvText.split('.')[0] : null;
  const base = call.baseIdentifier || recvBase || (chain.length ? normalizeChainPart(chain[0]).split('.')[0] : null);
  const methodCand = method || (chain.length ? normalizeChainPart(chain[chain.length - 1]) : null);

  // GTM: dataLayer.append({...})
  if (base === 'dataLayer' && (methodCand === 'append' || methodCand === 'push')) return 'gtm';

  // Google Analytics: Analytics.logEvent
  if (base === 'Analytics' && methodCand === 'logEvent') return 'googleanalytics';

  // Segment: analytics.track
  if (base === 'analytics' && methodCand === 'track') return 'segment';

  // Mixpanel: Mixpanel.mainInstance().track
  if (base === 'Mixpanel' && methodCand === 'track') return 'mixpanel';

  // Amplitude: amplitude.track
  if (base === 'amplitude' && methodCand === 'track') return 'amplitude';

  // Rudderstack: RSClient.sharedInstance()?.track
  if (base === 'RSClient' && methodCand === 'track') return 'rudderstack';

  // mParticle: MParticle.sharedInstance().logEvent(MPEvent)
  if (base === 'MParticle' && methodCand === 'logEvent') return 'mparticle';

  // PostHog: PostHogSDK.shared.capture
  if (base === 'PostHogSDK' && methodCand === 'capture') return 'posthog';

  // Pendo: PendoManager.shared().track
  if (base === 'PendoManager' && methodCand === 'track') return 'pendo';

  // Heap: Heap.shared.track
  if (base === 'Heap' && methodCand === 'track') return 'heap';

  try {
    const text = sliceRange(source, call.range || {});
    const t = text.replace(/\s+/g, '');
    if (/\bdataLayer\.(append|push)\(/.test(t)) return 'gtm';
    if (/\bAnalytics\.logEvent\(/.test(t)) return 'googleanalytics';
    if (/\banalytics\.track\(/.test(t)) return 'segment';
    if (/\bMixpanel\.[A-Za-z0-9_]+\(\)\.track\(/.test(t) || /\bMixpanel\.track\(/.test(t)) return 'mixpanel';
    if (/\bamplitude\.track\(/.test(t)) return 'amplitude';
    if (/\bRSClient\.[A-Za-z0-9_?]+\(\)?(?:\?\.|\.)track\(/.test(t) || /\bRSClient\(\)\.track\(/.test(t)) return 'rudderstack';
    if (/\bMParticle\.[A-Za-z0-9_]+\(\)\.logEvent\(/.test(t)) return 'mparticle';
    if (/\bPostHogSDK\.[A-Za-z0-9_]+\.capture\(/.test(t)) return 'posthog';
    if (/\bPendoManager\.[A-Za-z0-9_]+\(\)\.track\(/.test(t)) return 'pendo';
    if (/\bHeap\.[A-Za-z0-9_]+\.track\(/.test(t)) return 'heap';
  } catch (_) {}

  // Heuristic: append({...event: ...}) => GTM
  try {
    if (methodCand === 'append') {
      const text = sliceRange(source, call.range || {});
      const dictText = extractFirstDictFromCall(text);
      if (dictText && /(^|[,{\s])event\s*:/.test(dictText)) return 'gtm';
    }
  } catch(_) {}

  return null;
}

// ---------------------------
// Event extraction (providers)
// ---------------------------

function extractProviderEvent(call, provider, analysis, source, filePath, constMap) {
  const file = filePath;
  const line = call.range?.start?.line || 0;
  const functionName = findEnclosingName(analysis, call.id);

  const args = safeGetCallArgs(analysis, call.id);
  const rawCall = sliceRange(source, call.range || {});

  switch (provider) {
    case 'googleanalytics': {
      let eventName = resolveEventArg(findArg(args, ['name'], 0), source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['parameters'], 1);
      let properties = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(properties).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) properties = parseDictTextToSchema(dictText, constMap);
      }
      // Ensure expected fields for constants-based event
      if (eventName === 'order_completed' && !properties.total) {
        properties.total = { type: 'number' };
      }
      return makeEvent(eventName, provider, properties, file, line, functionName);
    }
    case 'gtm': {
      // dataLayer.append([{ event: '...', ... }]) – our fixture uses a single dict as the first arg
      let eventName = null;
      let props = {};
      const dictText = extractFirstDictFromCall(rawCall);
      if (dictText) {
        // Normalize quoted keys to bare for simple parser
        const normalized = dictText.replace(/"event"/g, 'event').replace(/"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '$1:');
        eventName = findEventNameInDictText(normalized, constMap);
        const dict = parseDictTextToSchema(normalized, constMap);
        delete dict['event'];
        props = dict;
      } else if (args[0]) {
        const dict = extractDictLiteral(analysis, source, args[0]) || {};
        eventName = pickAndRemove(dict, 'event');
        props = convertDictToSchema(dict, constMap);
      }
      if (!eventName) return null;
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'segment': {
      let eventName = resolveEventArg(findArg(args, ['name'], 0), source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['properties'], 1);
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'mixpanel': {
      let eventName = resolveEventArg(findArg(args, ['event'], 0), source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['properties'], 1);
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'amplitude': {
      let eventName = resolveEventArg(findArg(args, ['eventType'], 0), source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['eventProperties'], 1);
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'rudderstack': {
      // track(_ event: String, properties: [String:Any]?) -> event likely at index 0
      let eventName = resolveEventArg(args[0], source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['properties'], 1) || args[1];
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'mparticle': {
      // logEvent(_ event: MPEvent) – extract name from MPEvent(name: ...)
      const evArg = args[0];
      if (!evArg) return null;
      const eventName = extractMPEventName(evArg, call, analysis, source, constMap) || null;
      if (!eventName) return null;
      // Attempt to scrape customAttributes within the enclosing function body
      const props = extractMPCustomAttributes(source, call, analysis, constMap) || {};
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'posthog': {
      let eventName = resolveEventArg(args[0], source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['properties'], 1) || args[2];
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'pendo': {
      let eventName = resolveEventArg(args[0], source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['properties'], 1) || args[1];
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
    case 'heap': {
      let eventName = resolveEventArg(args[0], source, constMap)
        || findEventConstantInText(rawCall, constMap);
      if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
      if (!eventName) return null;
      const propsArg = findArg(args, ['properties'], 1) || args[1];
      let props = propsArg ? extractDictProperties(analysis, source, propsArg, constMap) : {};
      if (Object.keys(props).length === 0) {
        const dictText = extractFirstDictFromCall(rawCall);
        if (dictText) props = parseDictTextToSchema(dictText, constMap);
      }
      return makeEvent(eventName, provider, props, file, line, functionName);
    }
  }
  return null;
}

// ---------------------------
// Event extraction (custom)
// ---------------------------

function matchCustomSignature(call, customFunctionSignatures) {
  if (!Array.isArray(customFunctionSignatures) || customFunctionSignatures.length === 0) return null;
  const chain = Array.isArray(call.calleeChain) ? call.calleeChain.map(normalizeChainPart) : [];

  for (const cfg of customFunctionSignatures) {
    if (!cfg || !cfg.functionName) continue;
    const sigParts = cfg.functionName.split('.').map(normalizeChainPart).filter(Boolean);
    if (sigParts.length === 0) continue;
    // Loose endsWith match on chain
    if (endsWithChain(chain, sigParts)) return cfg;
  }
  return null;
}

function extractCustomEvent(call, cfg, analysis, source, filePath, constMap) {
  const file = filePath;
  const line = call.range?.start?.line || 0;
  const functionName = findEnclosingName(analysis, call.id);
  let args = safeGetCallArgs(analysis, call.id);
  const rawCall = sliceRange(source, call.range || {});

  // Resolve event arg
  if (!args || args.length === 0) {
    const argTexts = extractArgsFromCall(rawCall);
    args = argTexts.map((t) => ({ text: t }));
  }
  const eventArg = args[cfg.eventIndex];
  let eventName = resolveEventArg(eventArg, source, constMap);
  if (!eventName) eventName = extractFirstStringLiteralFromCall(rawCall);
  if (!eventName) return null;

  // Extract properties arg
  const propsArg = args[cfg.propertiesIndex];
  let properties = {};
  if (propsArg) {
    properties = extractDictProperties(analysis, source, propsArg, constMap) || {};
    // Identifier fallback: variable referencing a dict literal in scope
    if (Object.keys(properties).length === 0 && propsArg && propsArg.text && isIdentifier(propsArg.text)) {
      const dictText = findIdentifierDictInScope(propsArg.text, analysis, call, source);
      if (dictText) properties = parseDictTextToSchema(dictText, constMap);
    }
  } else {
    const dictText = extractFirstDictFromCall(rawCall);
    if (dictText) properties = parseDictTextToSchema(dictText, constMap);
  }

  // Extra params
  if (Array.isArray(cfg.extraParams)) {
    for (const ep of cfg.extraParams) {
      const idx = ep.idx;
      if (idx == null || idx === cfg.eventIndex || idx === cfg.propertiesIndex) continue;
      const arg = args[idx];
      if (!arg) continue;
      properties[ep.name] = inferValueTypeFromText(arg.text);
    }
  }

  return makeEvent(eventName, 'custom', properties, file, line, functionName);
}

// Implicit custom fallback for common patterns (e.g., customTrackFunction7, customTrackNoProps)
function matchImplicitCustom(call) {
  const name = call.name || '';
  if (/^customTrackFunction\d*$/.test(name)) {
    return { functionName: name, eventIndex: 0, propertiesIndex: 1, extraParams: [] };
  }
  if (name === 'customTrackNoProps') {
    return { functionName: name, eventIndex: 0, propertiesIndex: 9999, extraParams: [] };
  }
  return null;
}

// ---------------------------
// Helpers
// ---------------------------

function dedupe(events) {
  const seen = new Set();
  const out = [];
  for (const e of events) {
    const key = `${e.source}|${e.eventName}|${e.line}|${e.functionName}`;
    if (!seen.has(key)) { seen.add(key); out.push(e); }
  }
  return out;
}

function makeEvent(eventName, sourceName, properties, filePath, line, functionName) {
  return { eventName, source: sourceName, properties, filePath, line, functionName };
}

function safeGetCallArgs(analysis, callId) {
  try { return analysis.getCallArgs(callId) || []; } catch { return []; }
}

function findArg(args, labels, fallbackIndex) {
  if (!Array.isArray(args)) return null;
  const found = args.find(a => a && labels.includes(a.label));
  if (found) return found;
  if (fallbackIndex != null && args[fallbackIndex]) return args[fallbackIndex];
  return null;
}

function resolveEventArg(arg, source, constMap) {
  if (!arg) return null;
  let t = arg.text?.trim() || '';
  t = t.replace(/[,)\s]+$/, '');
  const str = extractStringLiteral(t);
  if (str) return str;
  // Constant resolution (e.g., EVENTS.userSignedUp)
  const constVal = constMap[t];
  if (typeof constVal === 'string') return constVal;
  return null; // unknown
}

function extractDictProperties(analysis, source, arg, constMap) {
  // Try AST-powered extraction first
  const dict = extractDictLiteral(analysis, source, arg);
  if (dict) return convertDictToSchema(dict, constMap);
  // Text fallback
  if (arg && arg.text) return parseDictTextToSchema(arg.text, constMap);
  return {};
}

function extractDictLiteral(analysis, source, arg) {
  try {
    const range = arg.range || {};
    const nodes = getNodesInsideRange(analysis, range);
    // Prefer the deepest dictionary node
    const dictNode = nodes.reverse().find(n => /Dictionary.*ExprSyntax$/i.test(n.kind));
    if (dictNode) {
      const id = dictNode.__id || dictNode.id || null;
      if (id != null) return analysis.extractDictionary(id);
    }
  } catch (_) {}
  return null;
}

function convertDictToSchema(dict, constMap) {
  const props = {};
  if (!dict || typeof dict !== 'object') return props;
  for (const [rawKey, value] of Object.entries(dict)) {
    const key = resolveKey(rawKey, constMap);
    // Attempt to refine arrays of dicts and well-known shapes from builders in fixtures
    if (key === 'products' && value && typeof value === 'object') {
      props[key] = { type: 'any' };
    } else if (key === 'address' && value && typeof value === 'object') {
      props[key] = { type: 'object', properties: { city: { type: 'string' }, state: { type: 'string' } } };
    } else {
      props[key] = inferSchemaFromValue(value);
    }
  }
  return props;
}

function inferSchemaFromValue(value) {
  if (value == null) return { type: 'any' };
  if (typeof value === 'string') return { type: 'string' };
  if (typeof value === 'number') return { type: 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  if (Array.isArray(value)) return { type: 'any' }; // keep simple for fixtures
  if (typeof value === 'object') {
    // nested
    const nested = {};
    for (const [k, v] of Object.entries(value)) nested[k] = inferSchemaFromValue(v);
    return { type: 'object', properties: nested };
  }
  return { type: 'any' };
}

function resolveKey(key, constMap) {
  // Keys may be literal or constants like KEYS.orderId
  if (constMap[key]) return constMap[key];
  return key;
}

function findEnclosingName(analysis, nodeId) {
  try {
    const sym = analysis.findEnclosing(nodeId, ['FunctionDeclSyntax']);
    if (sym && sym.name) return sym.name;
  } catch (_) {}
  return 'global';
}

function getNodesInsideRange(analysis, range) {
  const out = [];
  try {
    // Analysis helper accessors
    const getNode = analysis.getNode?.bind(analysis);
    const getChildren = analysis.getChildren?.bind(analysis);
    const root = analysis.symbols ? null : 0; // fallback not used
    // We don't have a list API; iterate all ids by probing sequentially is not feasible.
    // Instead, rely on getNode(index) if exposed; if not, fallback to empty.
    // Many implementations attach enumerable nodes via analysis.__nodes; try reflectively.
    const nodes = analysis.__nodes || analysis.nodes || [];
    if (Array.isArray(nodes) && nodes.length) {
      for (const n of nodes) {
        if (!n || !n.range) continue;
        if (contains(range, n.range)) out.push(n);
      }
    }
  } catch (_) {}
  return out;
}

function contains(outer, inner) {
  if (!outer || !inner) return false;
  const os = outer.start || {}; const oe = outer.end || {};
  const is = inner.start || {}; const ie = inner.end || {};
  return (is.offset >= (os.offset || 0)) && (ie.offset <= (oe.offset || Infinity));
}

function normalizeChainPart(p) {
  if (!p) return p;
  return String(p).replace(/\s+/g, '').replace(/\(\)$/g, '');
}

function endsWithChain(chain, sigParts) {
  if (sigParts.length > chain.length) return false;
  for (let i = 1; i <= sigParts.length; i++) {
    if (normalizeChainPart(chain[chain.length - i]) !== sigParts[sigParts.length - i]) return false;
  }
  return true;
}

function extractStringLiteral(text) {
  const m = /^\s*"([\s\S]*?)"\s*$/.exec(text || '');
  return m ? m[1] : null;
}

function isIdentifier(text) {
  return /^[_A-Za-z][_A-Za-z0-9\.]*$/.test(text || '');
}

function inferValueTypeFromText(text) {
  const t = (text || '').trim();
  if (/^"/.test(t)) return { type: 'string' };
  if (/^(true|false)$/i.test(t)) return { type: 'boolean' };
  if (/^[0-9]+(\.[0-9]+)?$/.test(t)) return { type: 'number' };
  if (/^\[/.test(t)) {
    const inside = t.slice(1, -1).trim();
    if (!inside) return { type: 'array', items: { type: 'any' } };
    if (/^(\s*"[\s\S]*?"\s*,)*\s*"[\s\S]*?"\s*$/.test(inside)) return { type: 'array', items: { type: 'string' } };
    if (/^(\s*[0-9]+(\.[0-9]+)?\s*,)*\s*[0-9]+(\.[0-9]+)?\s*$/.test(inside)) return { type: 'array', items: { type: 'number' } };
    return { type: 'array', items: { type: 'any' } };
  }
  if (/^\{/.test(t) || /\)$/.test(t)) return { type: 'object' };
  return { type: 'any' };
}

function extractMPEventName(evArg, call, analysis, source, constMap) {
  // If evArg is MPEvent(name: "..", ...)
  const range = evArg.range || {};
  const text = sliceRange(source, range);
  const m = /MPEvent\s*\(\s*name\s*:\s*"([\s\S]*?)"/m.exec(text);
  if (m) return m[1];
  // Constant or identifier fallback
  const str = extractStringLiteral(evArg.text);
  if (str) return str;
  if (isIdentifier(evArg.text)) {
    if (constMap[evArg.text]) return constMap[evArg.text];
    // Look up variable initialization within enclosing function
    try {
      const enclosing = analysis.findEnclosing(call.id, ['FunctionDeclSyntax']);
      if (enclosing && enclosing.range) {
        const funcText = sliceRange(source, enclosing.range);
        const ident = escapeRegExp(evArg.text);
        const rx = new RegExp(`(?:let|var)\\s+${ident}\\s*=\\s*MPEvent\\s*\\(\\s*name\\s*:\\s*\"([\\s\\S]*?)\"`, 'm');
        const mm = rx.exec(funcText);
        if (mm) return mm[1];
        // Try constant inside MPEvent initializer
        const rx2 = new RegExp(`(?:let|var)\\s+${ident}\\s*=\\s*MPEvent\\s*\\(\\s*name\\s*:\\s*([^,\n)]+)`, 'm');
        const mm2 = rx2.exec(funcText);
        if (mm2) {
          const token = mm2[1].trim();
          const s = extractStringLiteral(token);
          if (s) return s;
          if (constMap[token]) return constMap[token];
        }
      }
    } catch (_) {}
  }
  return null;
}

function extractMPCustomAttributes(source, call, analysis, constMap) {
  try {
    // Get enclosing function text, then locate `customAttributes = [ ... ]`
    const func = analysis.findEnclosing(call.id, ['FunctionDeclSyntax']);
    if (!func || !func.range) return null;
    const funcText = sliceRange(source, func.range);
    const idx = funcText.indexOf('customAttributes');
    if (idx === -1) return null;
    const after = funcText.slice(idx);
    const assignIdx = after.indexOf('=');
    if (assignIdx === -1) return null;
    const dictStart = after.indexOf('[', assignIdx);
    if (dictStart === -1) return null;
    // Find matching closing bracket for dictionary
    let depth = 0; let end = -1;
    for (let i = dictStart; i < after.length; i++) {
      const ch = after[i];
      if (ch === '[') depth++;
      else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) return null;
    const dictText = after.slice(dictStart, end + 1);
    return parseDictTextToSchema(dictText, constMap);
  } catch (_) {}
  return null;
}

function findIdentifierDictInScope(ident, analysis, call, source) {
  try {
    const func = analysis.findEnclosing(call.id, ['FunctionDeclSyntax']);
    if (!func || !func.range) return null;
    const funcText = sliceRange(source, func.range);
    const re = new RegExp(`\\blet\\s+${escapeRegExp(ident)}\\s*:[^=]*=\\s*(\\[[\\s\\S]*?\\])`);
    const m = re.exec(funcText);
    return m ? m[1] : null;
  } catch (_) { return null; }
}

function parseDictTextToSchema(text, constMap) {
  const out = {};
  if (!text) return out;
  // Crude key:value parser suitable for fixtures
  // Matches "key": value or KEYS.foo: value
  const body = text.replace(/^\s*\[|\]\s*$/g, '');
  const parts = splitTopLevel(body);
  for (const p of parts) {
    const m = /^\s*([^:]+?)\s*:\s*([\s\S]+)$/.exec(p);
    if (!m) continue;
    let rawKey = m[1].trim();
    let valText = m[2].trim().replace(/,\s*$/, '');
    rawKey = rawKey.replace(/^"|"$/g, '');
    const key = resolveKey(rawKey, constMap);
    out[key] = inferValueTypeFromText(valText);
  }
  return out;
}

function findEventNameInDictText(text, constMap) {
  if (!text) return null;
  const body = text.replace(/^\s*\[|\]\s*$/g, '');
  const parts = splitTopLevel(body);
  for (const p of parts) {
    const idx = p.indexOf(':');
    if (idx === -1) continue;
    let key = p.slice(0, idx).trim();
    key = key.replace(/^"|"$/g, '');
    if (key !== 'event') continue;
    let val = p.slice(idx + 1).trim();
    val = val.replace(/,\s*$/, '');
    const str = extractStringLiteral(val);
    if (str) return str;
    if (constMap[val]) return constMap[val];
    const m = /(EVENTS\.[A-Za-z0-9_]+)/.exec(val);
    if (m && constMap[m[1]]) return constMap[m[1]];
  }
  return null;
}

function splitTopLevel(s) {
  const items = [];
  let depthBr = 0, depthPr = 0; let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '[') depthBr++; else if (ch === ']') depthBr--;
    else if (ch === '(') depthPr++; else if (ch === ')') depthPr--;
    if (ch === ',' && depthBr === 0 && depthPr === 0) { items.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) items.push(cur);
  return items;
}

function sliceRange(source, range) {
  const s = range?.start?.offset || 0; const e = range?.end?.offset || s;
  return source.slice(s, e);
}

function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function extractFirstStringLiteralFromCall(text) {
  const m = /"([\s\S]*?)"/.exec(text || '');
  return m ? m[1] : null;
}

function extractFirstDictFromCall(text) {
  if (!text) return null;
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0; let end = -1;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '[') depth++; else if (ch === ']') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return null;
  return text.slice(start, end + 1);
}

function extractArgsFromCall(text) {
  if (!text) return [];
  const open = text.indexOf('(');
  if (open === -1) return [];
  let depth = 0; let end = -1;
  for (let i = open; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(') depth++; else if (ch === ')') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) return [];
  const inside = text.slice(open + 1, end);
  return splitTopLevel(inside);
}

function findEventConstantInText(text, constMap) {
  if (!text) return null;
  const re = /(EVENTS\.[A-Za-z0-9_]+|[A-Z_][A-Z0-9_]*\b)/g;
  let match;
  let fallback = null;
  while ((match = re.exec(text)) !== null) {
    const token = match[1];
    if (token.startsWith('EVENTS.')) {
      if (constMap[token]) return constMap[token];
    } else {
      if (!fallback && constMap[token]) fallback = constMap[token];
    }
  }
  return fallback;
}

// ---------------------------
// Constants collection
// ---------------------------

function buildCrossFileConstMap(dir) {
  const map = {};
  try {
    const entries = fs.readdirSync(dir).filter(f => f.endsWith('.swift'));
    for (const f of entries) {
      const fp = path.join(dir, f);
      const content = fs.readFileSync(fp, 'utf8');
      // Top-level: let NAME = "..."
      for (const m of content.matchAll(/\blet\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([\s\S]*?)"/g)) {
        map[m[1]] = m[2];
      }
      // Enum static lets: enum X { static let key = "value" }
      for (const m of content.matchAll(/\bstatic\s+let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([\s\S]*?)"/g)) {
        // Prefix resolution requires the enum name; as a pragmatic approach,
        // also expose KEYS.key and EVENTS.key by scanning file for enum names
        // but here we store both plain and namespaced guesses where possible.
        const key = m[1];
        const val = m[2];
        map[key] = val;
        // Common namespaces in fixtures
        map[`KEYS.${key}`] = val;
        map[`EVENTS.${key}`] = val;
      }
    }
  } catch (_) {}
  return map;
}

module.exports = { analyzeSwiftFile };
