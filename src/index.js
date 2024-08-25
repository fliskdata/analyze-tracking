const { analyzeDirectory } = require('./analyze');
const { getRepoDetails } = require('./repoDetails');
const { generateYamlSchema } = require('./yamlGenerator');

function run(targetDir, outputPath) {
  const events = analyzeDirectory(targetDir);
  const repoDetails = getRepoDetails(targetDir);
  generateYamlSchema(events, repoDetails, outputPath);
}

module.exports = { run };
