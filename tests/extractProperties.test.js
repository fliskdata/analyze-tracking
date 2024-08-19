const ts = require('typescript');
const {
  extractJsProperties,
  extractProperties,
} = require('../src/analyze/helpers');

describe('extractJsProperties', () => {
  it('should extract simple properties', () => {
    const node = {
      properties: [
        { key: { name: 'userId' }, value: { value: '12345', type: 'Literal' } },
        { key: { name: 'plan' }, value: { value: 'Free', type: 'Literal' } },
      ],
    };
    const properties = extractJsProperties(node);
    expect(properties).toEqual({
      userId: { type: 'string' },
      plan: { type: 'string' },
    });
  });

  it('should handle nested object properties', () => {
    const node = {
      properties: [
        {
          key: { name: 'address' },
          value: {
            type: 'ObjectExpression',
            properties: [
              { key: { name: 'city' }, value: { value: 'San Francisco', type: 'Literal' } },
              { key: { name: 'state' }, value: { value: 'CA', type: 'Literal' } },
            ],
          },
        },
      ],
    };
    const properties = extractJsProperties(node);
    expect(properties).toEqual({
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
        },
      },
    });
  });

  it('should handle properties with undefined type', () => {
    const node = {
      properties: [{ key: { name: 'undefinedProp' }, value: { value: undefined, type: 'Literal' } }],
    };
    const properties = extractJsProperties(node);
    expect(properties).toEqual({
      undefinedProp: { type: 'any' },
    });
  });
});

describe('extractTsProperties', () => {
  it('should extract properties from TypeScript object', () => {
    const node = {
      properties: [
        { name: { text: 'userId' }, initializer: { text: '12345', type: 'Literal' } },
        { name: { text: 'plan' }, initializer: { text: 'Free', type: 'Literal' } },
      ],
    };
    const checker = {
      getTypeAtLocation: jest.fn().mockReturnValue({}),
      typeToString: jest.fn().mockReturnValue('string'),
    };
    const properties = extractProperties(checker, node);
    expect(properties).toEqual({
      userId: { type: 'string' },
      plan: { type: 'string' },
    });
  });

  it('should handle nested object properties in TypeScript', () => {
    const node = {
      properties: [
        {
          name: { text: 'address' },
          initializer: {
            kind: ts.SyntaxKind.ObjectLiteralExpression,
            properties: [
              { name: { text: 'city' }, initializer: { text: 'San Francisco', type: 'Literal' } },
              { name: { text: 'state' }, initializer: { text: 'CA', type: 'Literal' } },
            ],
          },
        },
      ],
    };
    const checker = {
      getTypeAtLocation: jest.fn().mockReturnValue({}),
      typeToString: jest.fn().mockReturnValue('string'),
    };
    const properties = extractProperties(checker, node);
    expect(properties).toEqual({
      address: {
        type: 'object',
        properties: {
          city: { type: 'string' },
          state: { type: 'string' },
        },
      },
    });
  });
});
