const { analyzeDirectory } = require('./analyze');
const { generateYamlSchema } = require('./yamlGenerator');

function run(targetDir, repository, outputPath) {
  const events = analyzeDirectory(targetDir, repository);
  generateYamlSchema(events, outputPath);
}

module.exports = { run };
