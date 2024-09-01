const { analyzeDirectory } = require('./analyze');
const { getRepoDetails } = require('./repoDetails');
const { generateYamlSchema } = require('./yamlGenerator');

function run(targetDir, outputPath, customFunction) {
  const events = analyzeDirectory(targetDir, customFunction);
  const repoDetails = getRepoDetails(targetDir);
  generateYamlSchema(events, repoDetails, outputPath);
}

module.exports = { run };
