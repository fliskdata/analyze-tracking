#!/usr/bin/env node

const path = require('path');
const { execSync } = require('child_process');
const { run } = require('../src/index');

// Parse command-line arguments
const targetDir = process.argv[2];
const repositoryArgIndex = process.argv.indexOf('--repository');
const repositoryUrl = repositoryArgIndex !== -1 ? process.argv[repositoryArgIndex + 1] : null;
const outputArgIndex = process.argv.indexOf('--output');
const outputPath = outputArgIndex !== -1 ? process.argv[outputArgIndex + 1] : 'tracking-schema.yaml';

if (!targetDir) {
  console.error('Please provide the path to the repository.');
  process.exit(1);
}

// Function to get the repository URL using Git
function getRepositoryUrl() {
  try {
    const repoUrl = execSync('git config --get remote.origin.url', { cwd: targetDir, encoding: 'utf8' });
    return repoUrl.trim();
  } catch (error) {
    console.warn('Could not retrieve repository URL. Using default value "unknown".');
    return 'unknown';
  }
}

// Determine the repository URL
const repository = repositoryUrl || getRepositoryUrl();

run(path.resolve(targetDir), repository, outputPath);
