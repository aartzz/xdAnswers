// scripts/version-helper.js
// Resolves extension build version from Git: tag if commit is tagged, git+short-hash if untagged.
// Untagged builds with tracked changes get a -dirty suffix.
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
        if (hash) {
            let dirty = '';
            try {
                const changes = execSync('git status --porcelain --untracked-files=no', { encoding: 'utf-8' }).trim();
                if (changes) dirty = '-dirty';
            } catch (e) {}
            return `git+${hash}${dirty}`;
        }
    } catch (e) {}

    try {
        const manifest = require(path.join(__dirname, '..', 'manifest.common.json'));
        return 'v' + (manifest.version || '0.0.0');
    } catch (e) {
        return 'v0.0.0';
    }
}

module.exports = { getBuildVersion };
