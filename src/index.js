const { analyzeDirectory } = require('./analyze');
const { getRepoDetails } = require('./repoDetails');
const { generateYamlSchema } = require('./yamlGenerator');

async function run(targetDir, outputPath, customFunction) {
  const events = analyzeDirectory(targetDir, customFunction);
  const repoDetails = await getRepoDetails(targetDir);
  generateYamlSchema(events, repoDetails, outputPath);
}

module.exports = { run };
