/**
 * Constants and helper-return collectors for Swift fixtures
 * - Scans directory for top-level lets and enum/struct static lets
 * - Extracts simple function returns for dict/array builders
 */

const fs = require('fs');
const path = require('path');

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
      // Enum/struct blocks: capture namespace and all static lets inside
      let idx = 0;
      while (idx < content.length) {
        const head = content.slice(idx);
        const mm = /\b(enum|struct)\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{/m.exec(head);
        if (!mm) break;
        const ns = mm[2];
        const blockStart = idx + mm.index + mm[0].length - 1; // position at '{'
        // Find matching closing brace
        let depth = 0; let end = -1;
        for (let i = blockStart; i < content.length; i++) {
          const ch = content[i];
          if (ch === '{') depth++;
          else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
        }
        if (end === -1) break;
        const block = content.slice(blockStart + 1, end);
        for (const sm of block.matchAll(/\bstatic\s+let\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"([\s\S]*?)"/g)) {
          const key = sm[1];
          const val = sm[2];
          map[`${ns}.${key}`] = val;
        }
        idx = end + 1;
      }
      // Capture very simple helper returns
      // func makeAddress() -> [String: Any] { return [ ... ] }
      for (const m of content.matchAll(/func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*->\s*\[[^\]]+\][^{]*\{[\s\S]*?return\s*(\[[\s\S]*?\])[\s\S]*?\}/g)) {
        map.__dictFuncs = map.__dictFuncs || {};
        map.__dictFuncs[m[1]] = { kind: 'dict', text: m[2] };
      }
      // func makeProducts() -> [[String: Any]] { return [ ... ] } (array)
      for (const m of content.matchAll(/func\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\)\s*->\s*\[\[[^\]]+\]\][^{]*\{[\s\S]*?return\s*(\[[\s\S]*?\])[\s\S]*?\}/g)) {
        map.__dictFuncs = map.__dictFuncs || {};
        map.__dictFuncs[m[1]] = { kind: 'array', text: m[2] };
      }
    }
  } catch (_) {}
  return map;
}

module.exports = { buildCrossFileConstMap };
