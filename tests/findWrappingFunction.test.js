const ts = require('typescript');
const {
  findWrappingFunctionJs,
} = require('../src/analyze/helpers');

describe('findWrappingFunctionJs', () => {
  it('should return function name for arrow function assigned to variable', () => {
    const node = { type: 'ArrowFunctionExpression' };
    const ancestors = [
      { type: 'Program' },
      { type: 'VariableDeclarator', init: node, id: { name: 'checkout' } },
    ];
    expect(findWrappingFunctionJs(node, ancestors)).toBe('checkout');
  });

  it('should return function name for function expression assigned to variable', () => {
    const node = { type: 'FunctionExpression' };
    const ancestors = [
      { type: 'Program' },
      { type: 'VariableDeclarator', init: node, id: { name: 'myFunc' } },
    ];
    expect(findWrappingFunctionJs(node, ancestors)).toBe('myFunc');
  });

  it('should return "global" if no wrapping function is found', () => {
    const node = {};
    const ancestors = [{ type: 'Program' }];
    expect(findWrappingFunctionJs(node, ancestors)).toBe('global');
  });
});
