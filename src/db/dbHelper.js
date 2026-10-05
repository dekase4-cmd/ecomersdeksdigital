const fs = require('fs');
const path = require('path');

const DB_DIR = __dirname;

function getFilePath(filename) {
  return path.join(DB_DIR, filename.endsWith('.json') ? filename : `${filename}.json`);
}

function readData(filename) {
  const filePath = getFilePath(filename);
  try {
    if (!fs.existsSync(filePath)) {
      return filename === 'settings' ? {} : [];
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content || (filename === 'settings' ? '{}' : '[]'));
    return parsed;
  } catch (err) {
    console.error(`Error reading db file ${filename}:`, err);
    return filename === 'settings' ? {} : [];
  }
}

function writeData(filename, data) {
  const filePath = getFilePath(filename);
  try {
    // Pastikan direktori tempat file berada sudah ada
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error(`Error writing db file ${filename}:`, err);
    return false;
  }
}

module.exports = {
  readData,
  writeData
};
