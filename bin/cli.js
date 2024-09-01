#!/usr/bin/env node

const path = require('path');
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
]
const options = commandLineArgs(optionDefinitions);
const { targetDir, output, customFunction } = options;

if (!targetDir) {
  console.error('Please provide the path to the repository.');
  process.exit(1);
}

run(path.resolve(targetDir), output, customFunction);
