const fs = require('fs');
const yaml = require('js-yaml');

const version = 1

function generateYamlSchema(events, repository, outputPath) {
  const schema = {
    version,
    source: repository,
    events,
  };

  const yamlOutput = yaml.dump(schema, { noRefs: true });
  fs.writeFileSync(outputPath, yamlOutput, 'utf8');
  console.log(`Tracking schema YAML file generated: ${outputPath}`);
}

module.exports = { generateYamlSchema };
