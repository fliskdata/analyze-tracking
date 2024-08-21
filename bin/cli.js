#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');
const commandLineArgs = require('command-line-args')
const { run } = require('../src/index');

// Parse command-line arguments
const optionDefinitions = [
  {
    name: 'targetDir',
    type: String,
    defaultOption: true,
  },
  {
    name: 'repository',
    alias: 'r',
    type: String,
  },
  {
    name: 'output',
    alias: 'o',
    type: String,
    defaultValue: 'tracking-schema.yaml',
  },
]
const options = commandLineArgs(optionDefinitions);
const { targetDir, output, repository } = options;

if (!targetDir) {
  console.error('Please provide the path to the repository.');
  process.exit(1);
}

// Get the repository URL using Git
function getRepositoryUrl() {
  try {
    const repoUrl = execSync('git config --get remote.origin.url', { cwd: targetDir, encoding: 'utf8' });
    return repoUrl.trim();
  } catch (error) {
    console.warn('Could not retrieve repository URL. Using default value "unknown".');
    return 'unknown';
  }
}

const repositoryUrl = repository || getRepositoryUrl();

run(path.resolve(targetDir), repositoryUrl, output);
