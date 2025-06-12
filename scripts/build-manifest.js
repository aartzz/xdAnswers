const fs = require('fs');
const path = require('path');

const targetBrowser = process.argv[2];
if (!targetBrowser) {
  console.error('Error: Target browser not specified. Use "chrome" or "firefox".');
  process.exit(1);
}

const commonManifestPath = path.join(__dirname, '..', 'manifest.common.json');
// Цільовий файл буде в корені, оскільки web-ext збирає звідти
const finalManifestPath = path.join(__dirname, '..', 'manifest.json'); 

const commonManifest = require(commonManifestPath);

let browserSpecifics = {};

if (targetBrowser === 'chrome') {
  browserSpecifics = {
    background: {
      service_worker: 'background.js' //
    }
  };
} else if (targetBrowser === 'firefox') {
  browserSpecifics = {
    background: {
      scripts: ['background.js'] //
    },
    browser_specific_settings: {
      gecko: {
        id: 'xdanswers@aartzz.github.io', //
        strict_min_version: '109.0' //
      }
    }
  };
}

const finalManifest = { ...commonManifest, ...browserSpecifics };

fs.writeFileSync(finalManifestPath, JSON.stringify(finalManifest, null, 2), 'utf-8');

console.log(`Successfully created manifest.json for ${targetBrowser}`);