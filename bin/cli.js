#!/usr/bin/env node --no-warnings=ExperimentalWarning

const path = require('path');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const { run } = require('../src/index');
const { helpContent } = require('./help');

const SUPPORTED_MODEL_PROVIDERS = ['openai', 'gemini'];

// Parse command-line arguments
const optionDefinitions = [
  {
    name: 'targetDir',
    type: String,
    defaultOption: true,
  },
  {
    name: 'generateDescription',
    alias: 'g',
    type: Boolean,
    defaultValue: false,
  },
  {
    name: 'provider',
    alias: 'p',
    type: String,
    defaultValue: 'openai',
  },
  {
    name: 'model',
    alias: 'm',
    type: String,
    defaultValue: 'gpt-4.1-nano',
  },
  {
    name: 'output',
    alias: 'o',
    type: String,
    defaultValue: 'tracking-schema.yaml',
  },
  {
    name: 'customFunction',
    alias: 'c',
    type: String,
    multiple: true,
  },
  {
    name: 'repositoryUrl',
    alias: 'u',
    type: String,
  },
  {
    name: 'commitHash',
    alias: 's',
    type: String,
  },
  {
    name: 'commitTimestamp',
    alias: 't',
    type: String,
  },
  {
    name: 'help',
    alias: 'h',
    type: Boolean,
  },
  {
    name: 'stdout',
    type: Boolean,
    defaultValue: false,
  },
  {
    name: 'format',
    alias: 'f',
    type: String,
    defaultValue: 'yaml',
  },
]
const options = commandLineArgs(optionDefinitions);
const {
  targetDir,
  generateDescription,
  provider,
  model,
  output,
  customFunction,
  repositoryUrl,
  commitHash,
  commitTimestamp,
  help,
  stdout,
  format,
} = options;

if (help) {
  console.log(commandLineUsage(helpContent));
  process.exit(0);
}

const customSourceDetails = {
  repositoryUrl,
  commitHash,
  commitTimestamp,
};

if (!targetDir) {
  console.error('Please provide the path to the repository.');
  console.log(commandLineUsage(helpContent));
  process.exit(1);
}

if (generateDescription) {
  if (!SUPPORTED_MODEL_PROVIDERS.includes(provider)) {
    console.error('Please provide a valid provider. Options: openai, gemini');
    process.exit(1);
  }

  if (provider === 'openai' && !process.env.OPENAI_API_KEY) {
    console.error('Please set the `OPENAI_API_KEY` environment variable to use OpenAI for `generateDescription`.');
    process.exit(1);
  }

  if (provider === 'gemini' && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error('Please set the `GOOGLE_APPLICATION_CREDENTIALS` environment variable to use Gemini for `generateDescription`.');
    process.exit(1);
  }
}

if (format !== 'yaml' && format !== 'json') {
  console.error(`Invalid format: ${format}. Please use --format yaml or --format json.`);
  process.exit(1);
}

run(
  path.resolve(targetDir),
  output,
  customFunction,
  customSourceDetails,
  generateDescription,
  provider,
  model,
  stdout,
  format
);
