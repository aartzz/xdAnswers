// .web-ext-config.js
//
// Один конфіг на обидва браузери. Target обирається через TARGET env var:
//   TARGET=firefox web-ext build --config .web-ext-config.js
//   TARGET=chrome  web-ext build --config .web-ext-config.js
//
// Різниця між таргетами:
//   - filename: .xpi для Firefox (інакше браузер трактує файл як простий zip),
//               .zip для Chrome (Chrome Web Store і "Load unpacked" очікують zip).
//   - ignoreFiles: обидва таргети ділять спільний базовий список "сміття",
//                  яке ніколи не має потрапити в архів розширення.

const target = (process.env.TARGET || 'firefox').toLowerCase();

if (target !== 'firefox' && target !== 'chrome') {
  throw new Error(
    `.web-ext-config.js: unknown TARGET="${process.env.TARGET}". Use "firefox" or "chrome".`
  );
}

// Файли, які ніколи не мають потрапити в архів розширення.
// Зайві JSON (типу manifest.common.json або package.json) псують встановлення
// у Firefox ("appears to be corrupt") і просто роздувають архів для Chrome.
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
  '.env.example',
  '.env',
];

const byTarget = {
  firefox: {
    filename: 'xdAnswers-firefox-{version}.xpi',
    ignoreFiles: commonIgnore,
  },
  chrome: {
    filename: 'xdAnswers-chrome-{version}.zip',
    ignoreFiles: commonIgnore,
  },
};

module.exports = {
  sourceDir: './',
  artifactsDir: './build',
  build: {
    overwriteDest: true,
    filename: byTarget[target].filename,
  },
  ignoreFiles: byTarget[target].ignoreFiles,
};
