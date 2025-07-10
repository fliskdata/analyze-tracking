const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const _ = require('lodash');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

// Multiple custom function signatures for comprehensive testing
const customFunctionSignatures = [
  'customTrackFunction(userId, EVENT_NAME, PROPERTIES)',
  'customTrackFunction0',
  'customTrackFunction1(EVENT_NAME, PROPERTIES)',
  'customTrackFunction2(userId, EVENT_NAME, PROPERTIES)',
  'customTrackFunction3(EVENT_NAME, PROPERTIES, userEmail)',
  'customTrackFunction4(userId, EVENT_NAME, userAddress, PROPERTIES, userEmail)',
  'CustomModule.track(userId, EVENT_NAME, PROPERTIES)',
  'customTrackFunction5',
  'customTrackFunction6(EVENT_NAME, PROPERTIES)',
  'this.props.customTrackFunction6(EVENT_NAME, PROPERTIES)',
  'customTrackFunction7(EVENT_NAME, PROPERTIES)',
];

// Helper function to run CLI and capture output
function runCLI(targetDir, customFunctions, outputFile) {
  const customFunctionArgs = customFunctions.map(func => `--customFunction "${func}"`).join(' ');
  const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" ${customFunctionArgs} --output "${outputFile}"`;
  try {
    execSync(command, { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error(`CLI command failed: ${error.message}`);
    return false;
  }
}

// Helper function to compare YAML files ignoring order
function compareYAMLFiles(actualPath, expectedPath) {
  const actualContent = fs.readFileSync(actualPath, 'utf8');
  const expectedContent = fs.readFileSync(expectedPath, 'utf8');
  
  // Remove the YAML language server comment from both files
  const actualYAML = actualContent.replace(/^# yaml-language-server:.*\n/, '');
  const expectedYAML = expectedContent.replace(/^# yaml-language-server:.*\n/, '');
  
  // Parse YAML
  const actual = yaml.load(actualYAML);
  const expected = yaml.load(expectedYAML);
  
  // Compare version
  assert.strictEqual(actual.version, expected.version);
  
  // Compare source (ignoring dynamic fields like commit and timestamp)
  assert.ok(actual.source);
  assert.ok(actual.source.repository);
  
  // Helper to sort implementations deterministically
  const sortImpls = (impls = []) =>
    impls.slice().sort((a, b) => {
      if (a.path !== b.path) return a.path.localeCompare(b.path);
      if (a.line !== b.line) return a.line - b.line;
      if ((a.destination || '') !== (b.destination || '')) return (a.destination || '').localeCompare(b.destination || '');
      return (a.function || '').localeCompare(b.function || '');
    });

  // Normalise events so that order of implementations does not matter
  const normaliseEvent = (evt) => {
    if (!evt) return evt;
    return {
      ...evt,
      implementations: sortImpls(evt.implementations)
    };
  };

  // Compare events using deep equality (order-insensitive)
  const diff = {};
  for (const eventName in expected.events) {
    if (!actual.events[eventName]) {
      diff[eventName] = { missing: true };
      continue;
    }
    
    const actualEvent = normaliseEvent(actual.events[eventName]);
    const expectedEvent = normaliseEvent(expected.events[eventName]);
    
    if (!_.isEqual(actualEvent, expectedEvent)) {
      diff[eventName] = {
        properties: {
          missing: Object.keys(expectedEvent.properties || {}).filter(p => !actualEvent.properties?.[p]),
          unexpected: Object.keys(actualEvent.properties || {}).filter(p => !expectedEvent.properties?.[p]),
          changed: Object.keys(expectedEvent.properties || {}).filter(p =>
            actualEvent.properties?.[p] && !_.isEqual(actualEvent.properties[p], expectedEvent.properties[p])
          )
        },
        implementations: {
          missing: (expectedEvent.implementations || []).filter(impl => 
            !(actualEvent.implementations || []).some(a => _.isEqual(a, impl))),
          unexpected: (actualEvent.implementations || []).filter(impl =>
            !(expectedEvent.implementations || []).some(e => _.isEqual(e, impl)))
        }
      };
    }
  }

  // Check for unexpected events in actual
  for (const eventName in actual.events) {
    if (!expected.events[eventName]) {
      diff[eventName] = { unexpected: true };
    }
  }

  const hasDiffs = Object.keys(diff).length > 0;
  assert.ok(!hasDiffs, 
    'Events do not match. Differences:\n' + JSON.stringify(diff, null, 2));
}

test.describe('CLI End-to-End Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const tempDir = path.join(__dirname, 'temp');
  
  // Create temp directory before tests
  test.before(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }
  });
  
  // Clean up temp directory after tests
  test.after(() => {
    if (fs.existsSync(tempDir)) {
      fs.readdirSync(tempDir).forEach(file => {
        fs.unlinkSync(path.join(tempDir, file));
      });
      fs.rmdirSync(tempDir);
    }
  });
  
  test('should analyze Go files and generate a tracking schema', async () => {
    const targetDir = path.join(fixturesDir, 'go');
    const outputFile = path.join(tempDir, 'tracking-schema-go-test.yaml');
    const expectedFile = path.join(fixturesDir, 'go', 'tracking-schema-go.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignatures, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Compare YAML files
    compareYAMLFiles(outputFile, expectedFile);
  });
  
  test('should analyze JavaScript files and generate a tracking schema', async () => {
    const targetDir = path.join(fixturesDir, 'javascript');
    const outputFile = path.join(tempDir, 'tracking-schema-javascript-test.yaml');
    const expectedFile = path.join(fixturesDir, 'javascript', 'tracking-schema-javascript.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignatures, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Compare YAML files
    compareYAMLFiles(outputFile, expectedFile);
  });
  
  test('should analyze TypeScript files and generate a tracking schema', async () => {
    const targetDir = path.join(fixturesDir, 'typescript');
    const outputFile = path.join(tempDir, 'tracking-schema-typescript-test.yaml');
    const expectedFile = path.join(fixturesDir, 'typescript', 'tracking-schema-typescript.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignatures, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Compare YAML files
    compareYAMLFiles(outputFile, expectedFile);
  });
  
  test('should analyze Python files and generate a tracking schema', async () => {
    const targetDir = path.join(fixturesDir, 'python');
    const outputFile = path.join(tempDir, 'tracking-schema-python-test.yaml');
    const expectedFile = path.join(fixturesDir, 'python', 'tracking-schema-python.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignatures, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Compare YAML files
    compareYAMLFiles(outputFile, expectedFile);
  });
  
  test('should analyze Ruby files and generate a tracking schema', async () => {
    const targetDir = path.join(fixturesDir, 'ruby');
    const outputFile = path.join(tempDir, 'tracking-schema-ruby-test.yaml');
    const expectedFile = path.join(fixturesDir, 'ruby', 'tracking-schema-ruby.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignatures, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Compare YAML files
    compareYAMLFiles(outputFile, expectedFile);
  });
  
  test('should handle empty files and generate an empty tracking schema', async () => {
    // Test with each language's empty file
    const languages = ['go', 'javascript', 'typescript', 'python', 'ruby'];
    
    for (const lang of languages) {
      const targetDir = path.join(fixturesDir, lang);
      const outputFile = path.join(tempDir, `tracking-schema-${lang}-empty-test.yaml`);
      
      // Check if empty file exists for this language
      const emptyFile = fs.readdirSync(targetDir).find(f => f.startsWith('empty.'));
      if (emptyFile) {
        // Create a temp directory with only the empty file
        const tempLangDir = path.join(tempDir, `${lang}-empty`);
        fs.mkdirSync(tempLangDir, { recursive: true });
        fs.copyFileSync(
          path.join(targetDir, emptyFile),
          path.join(tempLangDir, emptyFile)
        );
        
        // Run CLI on the directory with only the empty file
        const success = runCLI(tempLangDir, customFunctionSignatures, outputFile);
        assert.ok(success, `CLI should run successfully for ${lang} empty file`);
        
        // Check output file exists
        assert.ok(fs.existsSync(outputFile), 'Output file should be created');
        
        // Load the generated YAML
        const generatedContent = fs.readFileSync(outputFile, 'utf8');
        const generated = yaml.load(generatedContent.replace(/^# yaml-language-server:.*\n/, ''));
        
        // Check that events object is empty or has no events
        assert.ok(
          !generated.events || Object.keys(generated.events).length === 0,
          `${lang} empty file should produce no events`
        );
        
        // Clean up temp language directory
        fs.rmSync(tempLangDir, { recursive: true, force: true });
      }
    }
  });
  
  test('should analyze all languages together and generate a combined tracking schema', async () => {
    const targetDir = fixturesDir; // Use entire fixtures directory
    const outputFile = path.join(tempDir, 'tracking-schema-all-test.yaml');
    const expectedFile = path.join(fixturesDir, 'tracking-schema-all.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignatures, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Compare YAML files
    compareYAMLFiles(outputFile, expectedFile);
  });
  
  test('should print YAML to stdout when --stdout is used', async () => {
    const targetDir = path.join(fixturesDir, 'javascript');
    const expectedFile = path.join(fixturesDir, 'javascript', 'tracking-schema-javascript.yaml');
    const customFunctionArgs = customFunctionSignatures.map(func => `--customFunction "${func}"`).join(' ');
    const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" ${customFunctionArgs} --stdout`;
    let stdout;
    try {
      stdout = execSync(command, { encoding: 'utf8' });
    } catch (error) {
      assert.fail(`CLI command failed: ${error.message}`);
    }
    // Remove the YAML language server comment from both outputs
    const actualYAML = stdout.replace(/^# yaml-language-server:.*\n/, '');
    const expectedYAML = fs.readFileSync(expectedFile, 'utf8').replace(/^# yaml-language-server:.*\n/, '');
    // Parse YAML
    const actual = yaml.load(actualYAML);
    const expected = yaml.load(expectedYAML);
    // Compare version
    assert.strictEqual(actual.version, expected.version);
    // Compare source (ignoring dynamic fields like commit and timestamp)
    assert.ok(actual.source);
    assert.ok(actual.source.repository);
    // Compare events using deep equality (order-insensitive)
    assert.deepStrictEqual(actual.events, expected.events);
  });
  
  test('should not print output file message when --stdout is used', async () => {
    const targetDir = path.join(fixturesDir, 'javascript');
    const customFunctionArgs = customFunctionSignatures.map(func => `--customFunction "${func}"`).join(' ');
    const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" ${customFunctionArgs} --stdout`;
    let stdout;
    try {
      stdout = execSync(command, { encoding: 'utf8' });
    } catch (error) {
      assert.fail(`CLI command failed: ${error.message}`);
    }
    // Ensure the output does not contain the file generated message
    assert.ok(!stdout.includes('Tracking schema YAML file generated'), 'Should not print output file message when using --stdout');
  });
  
  test('should print JSON to stdout when --format json is used', async () => {
    const targetDir = path.join(fixturesDir, 'javascript');
    const expectedFile = path.join(fixturesDir, 'javascript', 'tracking-schema-javascript.yaml');
    const customFunctionArgs = customFunctionSignatures.map(func => `--customFunction "${func}"`).join(' ');
    const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" ${customFunctionArgs} --stdout --format json`;
    let stdout;
    try {
      stdout = execSync(command, { encoding: 'utf8' });
    } catch (error) {
      assert.fail(`CLI command failed: ${error.message}`);
    }
    // Should not contain YAML language server comment
    assert.ok(!stdout.includes('# yaml-language-server'), 'Should not contain YAML language server comment in JSON output');
    // Should not contain file output message
    assert.ok(!stdout.includes('Tracking schema YAML file generated'), 'Should not print output file message when using --stdout and --format json');
    // Should be valid JSON
    let actual;
    try {
      actual = JSON.parse(stdout);
    } catch (e) {
      assert.fail('Output is not valid JSON');
    }
    // Compare to expected YAML fixture loaded as JS object
    const expectedYAML = fs.readFileSync(expectedFile, 'utf8').replace(/^# yaml-language-server:.*\n/, '');
    const expected = yaml.load(expectedYAML);
    // Compare version
    assert.strictEqual(actual.version, expected.version);
    // Compare source (ignoring dynamic fields like commit and timestamp)
    assert.ok(actual.source);
    assert.ok(actual.source.repository);
    // Compare events using deep equality (order-insensitive)
    assert.deepStrictEqual(actual.events, expected.events);
  });
  
  test('should write JSON file when --format json is used without --stdout', async () => {
    const targetDir = path.join(fixturesDir, 'javascript');
    const outputFile = path.join(tempDir, 'tracking-schema-javascript-test.json');
    const expectedFile = path.join(fixturesDir, 'javascript', 'tracking-schema-javascript.yaml');
    const customFunctionArgs = customFunctionSignatures.map(func => `--customFunction "${func}"`).join(' ');
    const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" ${customFunctionArgs} --output "${outputFile}" --format json`;
    let stdout;
    try {
      stdout = execSync(command, { encoding: 'utf8' });
    } catch (error) {
      assert.fail(`CLI command failed: ${error.message}`);
    }
    // Should print output file message
    assert.ok(stdout.includes('Tracking schema YAML file generated') || stdout.includes('Tracking schema JSON file generated'), 'Should print output file message');
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    // Should be valid JSON
    let actual;
    try {
      actual = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    } catch (e) {
      assert.fail('Output file is not valid JSON');
    }
    // Compare to expected YAML fixture loaded as JS object
    const expectedYAML = fs.readFileSync(expectedFile, 'utf8').replace(/^# yaml-language-server:.*\n/, '');
    const expected = yaml.load(expectedYAML);
    // Compare version
    assert.strictEqual(actual.version, expected.version);
    // Compare source (ignoring dynamic fields like commit and timestamp)
    assert.ok(actual.source);
    assert.ok(actual.source.repository);
    // Compare events using deep equality (order-insensitive)
    assert.deepStrictEqual(actual.events, expected.events);
  });
  
  test('should fail with a clear error if --format is not yaml or json', async () => {
    const targetDir = path.join(fixturesDir, 'javascript');
    const customFunctionArgs = customFunctionSignatures.map(func => `--customFunction "${func}"`).join(' ');
    const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" ${customFunctionArgs} --stdout --format xml`;
    let errorCaught = false;
    try {
      execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      errorCaught = true;
      assert.ok(error.stderr.includes('Invalid format'), 'Should mention invalid format');
      assert.ok(error.stderr.match(/yaml|json/), 'Should mention yaml or json as valid options');
    }
    assert.ok(errorCaught, 'CLI should fail for invalid format');
  });
});
