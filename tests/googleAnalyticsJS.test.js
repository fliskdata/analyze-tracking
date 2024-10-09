const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const yaml = require('js-yaml');
const { run } = require('../src/index.js'); 

function extractRelevantEventData(actualYamlContent, eventName) {
    const data = yaml.load(actualYamlContent);
    if (data && data.events && data.events[eventName]) {
      return yaml.dump(data.events[eventName].properties);
    }
    return null;
  }

const testCases = [
  { name: 'Regular Function', file: 'googleAnalyticsRegularFunction.js', expectedFile: 'googleAnalyticsRegularFunction.yaml' },
  { name: 'Arrow Function', file: 'googleAnalyticsArrowFunction.js' , expectedFile: 'googleAnalyticsArrowFunction.yaml' },
  { name: 'Function Expression', file: 'googleAnalyticsFunctionExpression.js' , expectedFile: 'googleAnalyticsFunctionExpression.yaml' },
  { name: 'Global Context', file: 'googleAnalyticsGlobal.js' , expectedFile: 'googleAnalyticsGlobal.yaml' },
];

const outputPath = './tests/output/allEvents.yaml';

describe('Google Analytics Tests', () => {
  it('should process all events correctly', async () => {
    const targetDir = './tests/examples/';

    await run(path.resolve(targetDir), outputPath);

    testCases.forEach(testCase => {
      const expectedPath = `./tests/expected/${testCase.expectedFile}`;
      const expected = fs.readFileSync(expectedPath, 'utf8');
      const fullOutput = fs.readFileSync(outputPath, 'utf8');
      const actual = extractRelevantEventData(fullOutput, 'conversion');

      if (!_.isEqual(actual, expected)) {
        console.log(`Mismatch in ${testCase.name}`);
        console.log("Expected:", expected);
        console.log("Actual:", actual);
      }

      expect(_.isEqual(actual, expected)).toBe(true);
    });
  });

  afterAll(() => {
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
  });
});