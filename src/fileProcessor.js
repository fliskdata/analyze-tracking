const fs = require('fs');
const path = require('path');

function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return; // Skip this file or directory if it does not exist
      } else {
        throw error;
      }
    }

    if (stats.isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith('.js') || file.endsWith('.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

module.exports = { getAllFiles };
