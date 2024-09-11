const fs = require('fs');
const git = require('isomorphic-git');
const { execSync } = require('child_process');

async function getRepositoryUrl(targetDir) {
  try {
    const repoUrl = await git.getConfig({
      fs,
      dir: targetDir,
      path: 'remote.origin.url',
    });
    return repoUrl.trim();
  } catch (error) {
    try {
      const repoUrl = execSync('git config --get remote.origin.url', { cwd: targetDir, encoding: 'utf8' });
      return repoUrl.trim();
    } catch (error) {
      console.warn('Could not determine repository URL. Will exclude.');
      return null;
    }
  }
}

async function getCommitHash(targetDir) {
  try {
    const commitHash = await git.resolveRef({
      fs,
      dir: targetDir,
      ref: 'HEAD',
    });
    return commitHash.trim();
  } catch (error) {
    try {
      const commitHash = execSync('git rev-parse HEAD', { cwd: targetDir, encoding: 'utf8' });
      return commitHash.trim();
    } catch (error) {
      console.warn('Could not determine latest commit hash. Will exclude.');
      return null;
    }
  }
}

async function getCommitTimestamp(targetDir, commitHash) {
  try {
    const { commit } = await git.readCommit({
      fs,
      dir: targetDir,
      oid: commitHash,
    });
    const unixTimeSeconds = commit.committer.timestamp;
    return new Date(unixTimeSeconds * 1000);
  } catch (error) {
    try {
      const commitTimestamp = execSync(`git --no-pager show -s --format=%ct ${commitHash}`, { cwd: targetDir, encoding: 'utf8' });
      const unixTimeSeconds = commitTimestamp.trim();
      return new Date(unixTimeSeconds * 1000);
    } catch (error) {
      console.warn('Could not retrieve commit timestamp. Using current timestamp as default.');
      return new Date();
    }
  }
}

function pad(n) {
  return n<10 ? '0'+n : n
}

function toISODateString(date) {  
  return date.getUTCFullYear()+'-'
    + pad(date.getUTCMonth()+1)+'-'
    + pad(date.getUTCDate())+'T'
    + pad(date.getUTCHours())+':'
    + pad(date.getUTCMinutes())+':'
    + pad(date.getUTCSeconds())+'Z';
}

async function getRepoDetails(targetDir, customSourceDetails) {
  const repoUrl = await getRepositoryUrl(targetDir);
  const commitHash = await getCommitHash(targetDir);
  const commitEpochTime = await getCommitTimestamp(targetDir, commitHash);
  const commitTimestamp = toISODateString(commitEpochTime);

  const repoDetails = {};
  if (!!repoUrl) repoDetails.repository = repoUrl;
  if (!!commitHash) repoDetails.commit = commitHash;
  repoDetails.timestamp = commitTimestamp;

  if (!!customSourceDetails?.repositoryUrl) repoDetails.repository = customSourceDetails.repositoryUrl;
  if (!!customSourceDetails?.commitHash) repoDetails.commit = customSourceDetails.commitHash;
  if (!!customSourceDetails?.commitTimestamp) repoDetails.timestamp = customSourceDetails.commitTimestamp;

  return repoDetails;
}

module.exports = { getRepoDetails };
