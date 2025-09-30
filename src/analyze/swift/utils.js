/**
 * Generic Swift analyzer utilities
 * - String inference, key resolution, text slicing, and traversal helpers
 */

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
  if (isIdentifier(t)) return { type: 'string' };
  return { type: 'any' };
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

module.exports = {
  normalizeChainPart,
  endsWithChain,
  extractStringLiteral,
  isIdentifier,
  inferValueTypeFromText,
  splitTopLevel,
  sliceRange,
  escapeRegExp,
};
