#!/usr/bin/env node

const { run } = require('./index');
const targetDir = process.argv[2];

if (!targetDir) {
  console.error('Please provide the path to the repository.');
  process.exit(1);
}

run(path.resolve(targetDir));
