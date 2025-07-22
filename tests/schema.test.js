const test = require('node:test');
const assert = require('node:assert');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const Ajv = require('ajv');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');
const SCHEMA_PATH = path.join(__dirname, '..', 'schema.json');

const customFunctionSignature = 'customTrackFunction(userId, EVENT_NAME, PROPERTIES)';

// Helper function to run CLI and capture output
function runCLI(targetDir, customFunction, outputFile) {
  const command = `node --no-warnings=ExperimentalWarning "${CLI_PATH}" "${targetDir}" --customFunction "${customFunction}" --output "${outputFile}"`;
  try {
    execSync(command, { encoding: 'utf8' });
    return true;
  } catch (error) {
    console.error(`CLI command failed: ${error.message}`);
    return false;
  }
}

// Helper function to validate YAML against JSON schema
function validateAgainstSchema(yamlPath, schemaPath) {
  // Read and parse the YAML file
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  const yamlData = yaml.load(yamlContent);
  
  // Read and parse the JSON schema
  const schemaContent = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaContent);
  
  // Initialize AJV and compile the schema
  const ajv = new Ajv({ allErrors: true, verbose: true });
  const validate = ajv.compile(schema);
  
  // Validate the data
  const valid = validate(yamlData);
  
  return {
    valid,
    errors: validate.errors || []
  };
}

test.describe('Schema Validation Tests', () => {
  const fixturesDir = path.join(__dirname, 'fixtures');
  const tempDir = path.join(__dirname, 'temp-schema');
  
  // Create temp directory before tests
  test.before(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
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
  
  test('should generate YAML that conforms to the JSON schema specification', async () => {
    const targetDir = fixturesDir;
    const outputFile = path.join(tempDir, 'tracking-schema-validation-test.yaml');
    
    // Run CLI on entire fixtures directory
    const success = runCLI(targetDir, customFunctionSignature, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Check output file exists
    assert.ok(fs.existsSync(outputFile), 'Output file should be created');
    
    // Validate the generated YAML against the schema
    const validation = validateAgainstSchema(outputFile, SCHEMA_PATH);
    
    // Log validation errors if any
    if (!validation.valid) {
      console.error('Schema validation errors:');
      validation.errors.forEach(error => {
        console.error(`  - ${error.instancePath || '/'}: ${error.message}`);
        if (error.params) {
          console.error(`    Parameters: ${JSON.stringify(error.params)}`);
        }
      });
    }
    
    assert.ok(validation.valid, 'Generated YAML should conform to the JSON schema');
  });
  
  test('should validate schema compliance for each language individually', async () => {
    const languages = ['go', 'javascript', 'typescript', 'python', 'ruby'];
    
    for (const lang of languages) {
      const targetDir = path.join(fixturesDir, lang);
      const outputFile = path.join(tempDir, `tracking-schema-${lang}-validation-test.yaml`);
      
      // Run CLI for each language directory
      const success = runCLI(targetDir, customFunctionSignature, outputFile);
      assert.ok(success, `CLI should run successfully for ${lang}`);
      
      // Validate the generated YAML against the schema
      const validation = validateAgainstSchema(outputFile, SCHEMA_PATH);
      
      // Log validation errors if any
      if (!validation.valid) {
        console.error(`Schema validation errors for ${lang}:`);
        validation.errors.forEach(error => {
          console.error(`  - ${error.instancePath || '/'}: ${error.message}`);
        });
      }
      
      assert.ok(validation.valid, `Generated YAML for ${lang} should conform to the JSON schema`);
    }
  });
  
  test('should validate required fields are present', async () => {
    const targetDir = fixturesDir;
    const outputFile = path.join(tempDir, 'tracking-schema-required-fields-test.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignature, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Read and parse the YAML
    const yamlContent = fs.readFileSync(outputFile, 'utf8');
    const yamlData = yaml.load(yamlContent);
    
    // Check required top-level fields
    assert.ok(yamlData.version !== undefined, 'version field should be present');
    assert.strictEqual(yamlData.version, 1, 'version should be 1');
    assert.ok(yamlData.source !== undefined, 'source field should be present');
    assert.ok(yamlData.source.timestamp !== undefined, 'source.timestamp should be present');
    assert.ok(yamlData.events !== undefined, 'events field should be present');
    
    // Check required fields in events
    Object.entries(yamlData.events).forEach(([eventName, eventData]) => {
      assert.ok(eventData.implementations !== undefined, 
        `Event "${eventName}" should have implementations field`);
      assert.ok(Array.isArray(eventData.implementations), 
        `Event "${eventName}" implementations should be an array`);
      assert.ok(eventData.properties !== undefined, 
        `Event "${eventName}" should have properties field`);
      
      // Check required fields in implementations
      eventData.implementations.forEach((impl, idx) => {
        assert.ok(impl.path !== undefined, 
          `Event "${eventName}" implementation ${idx} should have path`);
        assert.ok(impl.line !== undefined, 
          `Event "${eventName}" implementation ${idx} should have line`);
        assert.ok(impl.function !== undefined, 
          `Event "${eventName}" implementation ${idx} should have function`);
        assert.ok(impl.destination !== undefined, 
          `Event "${eventName}" implementation ${idx} should have destination`);
      });
    });
  });
  
  test('should validate enum constraints', async () => {
    const targetDir = fixturesDir;
    const outputFile = path.join(tempDir, 'tracking-schema-enum-test.yaml');
    
    // Run CLI
    const success = runCLI(targetDir, customFunctionSignature, outputFile);
    assert.ok(success, 'CLI should run successfully');
    
    // Read and parse the YAML
    const yamlContent = fs.readFileSync(outputFile, 'utf8');
    const yamlData = yaml.load(yamlContent);
    
    const validDestinations = [
      'googleanalytics', 'segment', 'mixpanel', 'amplitude', 
      'rudderstack', 'mparticle', 'posthog', 'pendo', 
      'heap', 'snowplow', 'datadog', 'gtm', 'custom', 'unknown',
    ];
    
    // Check that all destinations are valid
    Object.entries(yamlData.events).forEach(([eventName, eventData]) => {
      eventData.implementations.forEach((impl, idx) => {
        assert.ok(validDestinations.includes(impl.destination), 
          `Event "${eventName}" implementation ${idx} has invalid destination: ${impl.destination}`);
      });
    });
  });
});
