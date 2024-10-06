const { analyzeDirectory } = require('./analyze');
const { getRepoDetails } = require('./repoDetails');
const { generateYamlSchema } = require('./yamlGenerator');
const { generateDescriptions } = require('./generateDescriptions');

async function run(targetDir, outputPath, customFunction, customSourceDetails, generateDescription) {
  let events = analyzeDirectory(targetDir, customFunction);
  if (generateDescription) {
    events = await generateDescriptions(events, targetDir);
  }
  const repoDetails = await getRepoDetails(targetDir, customSourceDetails);
  generateYamlSchema(events, repoDetails, outputPath);
}

module.exports = { run };
