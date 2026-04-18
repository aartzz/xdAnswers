// scripts/sync-version.js
//
// Викликається з npm version hook. Бере свіжу версію з package.json
// і синхронізує її у manifest.common.json (джерело правди для build-manifest.js,
// який генерує остаточний manifest.json для firefox/chrome).
//
// manifest.json у репозиторії НЕ існує — він генерується build-manifest.js
// перед кожним білдом, тому писати туди не має сенсу.

const fs = require('fs');
const path = require('path');

const packagePath = path.join(__dirname, '..', 'package.json');
const manifestCommonPath = path.join(__dirname, '..', 'manifest.common.json');

const packageJson = require(packagePath);
const newVersion = packageJson.version;

const manifestCommon = require(manifestCommonPath);
manifestCommon.version = newVersion;

// 2 пробіли + фінальний newline — щоб git diff залишався мінімальним
fs.writeFileSync(
  manifestCommonPath,
  JSON.stringify(manifestCommon, null, 2) + '\n',
  'utf-8'
);

console.log(`Successfully synced version to ${newVersion} in manifest.common.json`);
