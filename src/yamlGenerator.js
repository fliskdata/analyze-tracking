const fs = require('fs');
const yaml = require('js-yaml');

function generateYamlSchema(events, outputPath) {
  const schema = {
    version: 1.0,
    events,
  };

  const yamlOutput = yaml.dump(schema, { noRefs: true });
  fs.writeFileSync(outputPath, yamlOutput, 'utf8');
  console.log(`Tracking schema YAML file generated: ${outputPath}`);
}

module.exports = { generateYamlSchema };
