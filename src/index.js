/**
 * @fileoverview Main entry point for the analytics tracking analyzer
 * @module analyze-tracking
 */

const { analyzeDirectory } = require('./analyze');
const { getRepoDetails } = require('./utils/repoDetails');
const { generateYamlSchema } = require('./utils/yamlGenerator');
const { generateDescriptions } = require('./generateDescriptions');

const { ChatOpenAI } = require('@langchain/openai');
const { ChatVertexAI } = require('@langchain/google-vertexai');

async function run(targetDir, outputPath, customFunction, customSourceDetails, generateDescription, provider, model, stdout) {
  let events = await analyzeDirectory(targetDir, customFunction);
  if (generateDescription) {
    let llm;
    if (provider === 'openai') {
      llm = new ChatOpenAI({
        model: model,
        temperature: 0,
      });
    }
    if (provider === 'gemini') {
      llm = new ChatVertexAI({
        model: model,
        temperature: 0,
      });
    }
    if (!llm) {
      console.error('Please provide a valid AI model provider for `generateDescription`. Options: openai, gemini');
      process.exit(1);
    }
    console.log(`Generating descriptions using ${provider} model ${model}`);
    events = await generateDescriptions(events, targetDir, llm);
  }
  const repoDetails = await getRepoDetails(targetDir, customSourceDetails);
  generateYamlSchema(events, repoDetails, outputPath, stdout);
}

module.exports = { run };
