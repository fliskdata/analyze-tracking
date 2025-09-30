/**
 * Provider detection for Swift analytics SDKs
 */

const { normalizeChainPart, sliceRange } = require('./utils');

function detectProvider(call, source) {
  const method = call.name;
  const chain = Array.isArray(call.calleeChain) ? call.calleeChain : [];
  const recvText = call.receiver || null;
  const recvBase = recvText ? recvText.split('.')[0] : null;
  const base = call.baseIdentifier || recvBase || (chain.length ? normalizeChainPart(chain[0]).split('.')[0] : null);
  const methodCand = method || (chain.length ? normalizeChainPart(chain[chain.length - 1]) : null);

  if (base === 'dataLayer' && (methodCand === 'append' || methodCand === 'push')) return 'gtm';
  if (base === 'Analytics' && methodCand === 'logEvent') return 'googleanalytics';
  if (base === 'analytics' && methodCand === 'track') return 'segment';
  if (base === 'Mixpanel' && methodCand === 'track') return 'mixpanel';
  if (base === 'amplitude' && methodCand === 'track') return 'amplitude';
  if (base === 'RSClient' && methodCand === 'track') return 'rudderstack';
  if (base === 'MParticle' && methodCand === 'logEvent') return 'mparticle';
  if (base === 'PostHogSDK' && methodCand === 'capture') return 'posthog';
  if (base === 'PendoManager' && methodCand === 'track') return 'pendo';
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

  try {
    if (methodCand === 'append') {
      const text = sliceRange(source, call.range || {});
      if (text.includes('event:')) return 'gtm';
    }
  } catch (_) {}

  return null;
}

module.exports = { detectProvider };
