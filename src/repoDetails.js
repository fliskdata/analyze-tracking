const { execSync } = require('child_process');

function getRepositoryUrl(targetDir) {
  try {
    const repoUrl = execSync('git config --get remote.origin.url', { cwd: targetDir, encoding: 'utf8' });
    return repoUrl.trim();
  } catch (error) {
    console.warn('Could not determine repository URL. Will exclude.');
    return null;
  }
}

function getCommitHash(targetDir) {
  try {
    const commitHash = execSync('git rev-parse HEAD', { cwd: targetDir, encoding: 'utf8' });
    return commitHash.trim();
  } catch (error) {
    console.warn('Could not determine latest commit hash. Will exclude.');
    return null;
  }
}

function getCommitTimestamp(targetDir, commitHash) {
  try {
    const commitTimestamp = execSync(`git --no-pager show -s --format=%ct ${commitHash}`, { cwd: targetDir, encoding: 'utf8' });
    const unixTimeSeconds = commitTimestamp.trim();
    return new Date(unixTimeSeconds * 1000);
  } catch (error) {
    console.warn('Could not retrieve commit timestamp. Using current timestamp as default.')
    return new Date();
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
    + pad(date.getUTCSeconds())+'Z'
}

function getRepoDetails(targetDir) {
  const repoUrl = getRepositoryUrl(targetDir);
  const commitHash = getCommitHash(targetDir);
  const commitEpochTime = getCommitTimestamp(targetDir, commitHash);
  const commitTimestamp = toISODateString(commitEpochTime);

  const repoDetails = {};
  if (!!repoUrl) repoDetails.repository = repoUrl;
  if (!!commitHash) repoDetails.commit = commitHash;
  repoDetails.timestamp = commitTimestamp

  return repoDetails;
}

module.exports = { getRepoDetails };
