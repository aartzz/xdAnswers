// .web-ext-config.js
//
// Firefox packaging only. Chrome is packaged as a signed .crx by
// scripts/pack-chrome.js, because web-ext can only produce a .zip.
//
//   TARGET=firefox web-ext build --config .web-ext-config.js

const { getBuildVersion } = require('./scripts/version-helper');

const target = (process.env.TARGET || 'firefox').toLowerCase();
const version = getBuildVersion();

if (target !== 'firefox') {
  throw new Error(
    `.web-ext-config.js: TARGET="${process.env.TARGET}" is not supported. ` +
    'Use npm run build:chrome for the Chrome .crx build.'
  );
}

// Файли, які ніколи не мають потрапити в архів розширення.
// Зайві JSON (типу manifest.common.json або package.json) псують встановлення
// у Firefox ("appears to be corrupt").
const commonIgnore = [
  'node_modules',
  'node_modules/**',
  '.git',
  '.git/**',
  '.github',
  '.github/**',
  '.gitignore',
  'package.json',
  'package-lock.json',
  'manifest.common.json',
  'README.md',
  'README-en.md',
  'scripts',
  'scripts/**',
  '.web-ext-config.js',
  'chrome_package',
  'chrome_package/**',
  'dist_chrome',
  'dist_chrome/**',
  'build',
  'build/**',
  'images/README',
  'images/README/**',
  '*.zip',
  '*.xpi',
  '*.crx',
  '*.pem',
  '.env.example',
  '.env',
];

module.exports = {
  sourceDir: './dist',
  artifactsDir: './build',
  build: {
    overwriteDest: true,
    filename: `xdAnswers-firefox-${version}.xpi`,
  },
  ignoreFiles: commonIgnore,
};
