// scripts/version-helper.js
// Resolves extension build version from Git: tag if commit is tagged, short hash if untagged.
const { execSync } = require('child_process');
const path = require('path');

function getBuildVersion() {
    if (process.env.XD_VERSION) return process.env.XD_VERSION;

    try {
        const tag = execSync('git tag --points-at HEAD', { encoding: 'utf-8' }).trim();
        if (tag) return tag.split('\n')[0].trim();
    } catch (e) {}

    try {
        const hash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
        if (hash) return hash;
    } catch (e) {}

    try {
        const manifest = require(path.join(__dirname, '..', 'manifest.common.json'));
        return 'v' + (manifest.version || '0.0.0');
    } catch (e) {
        return 'v0.0.0';
    }
}

module.exports = { getBuildVersion };
