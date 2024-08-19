const {
  detectSourceJs,
} = require('../src/analyze/helpers');

describe('detectSourceJs', () => {
  it('should detect Google Analytics', () => {
    const node = { callee: { type: 'Identifier', name: 'gtag' } };
    expect(detectSourceJs(node)).toBe('googleanalytics');
  });

  it('should detect Segment', () => {
    const node = { callee: { type: 'MemberExpression', object: { name: 'analytics' }, property: { name: 'track' } } };
    expect(detectSourceJs(node)).toBe('segment');
  });

  it('should return unknown for unrecognized source', () => {
    const node = { callee: { type: 'Identifier', name: 'unknownLib' } };
    expect(detectSourceJs(node)).toBe('unknown');
  });
});
