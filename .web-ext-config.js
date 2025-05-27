// .web-ext-config.js
module.exports = {
    sourceDir: './',
    artifactsDir: './build',

    ignoreFiles: [
      'node_modules',
      '.git',
      '.github',
      'package.json',
      'package-lock.json',
      'README.md',
      'scripts',
      '.web-ext-config.js',
      'chrome_package',
      '*.zip'
    ],
  };