#!/usr/bin/env node

const path = require('path');
const commandLineArgs = require('command-line-args');
const commandLineUsage = require('command-line-usage');
const { run } = require('../src/index');
const { helpContent } = require('./help');

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
    name: 'output',
    alias: 'o',
    type: String,
    defaultValue: 'tracking-schema.yaml',
  },
  {
    name: 'customFunction',
    alias: 'c',
    type: String,
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
]
const options = commandLineArgs(optionDefinitions);
const {
  targetDir,
  generateDescription,
  output,
  customFunction,
  repositoryUrl,
  commitHash,
  commitTimestamp,
  help,
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
  if (!process.env.OPENAI_API_KEY) {
    console.error('Please set the `OPENAI_API_KEY` environment variable to use `generateDescription`.');
    process.exit(1);
  }
}

run(path.resolve(targetDir), output, customFunction, customSourceDetails, generateDescription);
