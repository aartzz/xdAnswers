// scripts/build.js
//
// Builds the extension with esbuild and writes a ready-to-package tree to ./dist.
//
// Usage:
//   node scripts/build.js <chrome|firefox> [debug|release]
//
// What it does:
//   1. generates version.js (build stamp imported by the core bundle)
//   2. bundles every manifest.common.json content script block:
//        - shared core prefix            -> dist/core.js
//        - per-provider remainder        -> dist/<provider>.js
//        - single-file blocks (disabler) -> dist/<file>.js
//   3. bundles background.js, popup.js and the web-accessible page scripts
//   4. copies static assets (images, lib, popup html/css) into dist
//   5. writes dist/manifest.json with browser-specific keys
//
// debug   → inline source maps + git-hash version
// release → no source maps + manifest version

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const { injectVersion } = require('./inject-version');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const targetBrowser = process.argv[2];
const mode = process.argv[3] === 'debug' ? 'debug' : 'release';

if (targetBrowser !== 'chrome' && targetBrowser !== 'firefox') {
    console.error('Error: Target browser not specified. Use "chrome" or "firefox".');
    process.exit(1);
}

const commonManifest = require(path.join(ROOT, 'manifest.common.json'));
const inlineSourcemaps = mode === 'debug';

function browserSpecifics(browser) {
    if (browser === 'chrome') {
        return {
            background: {
                service_worker: 'background.js'
            }
        };
    }
    return {
        background: {
            scripts: ['background.js']
        },
        browser_specific_settings: {
            gecko: {
                id: 'xdanswers@aartzz.github.io',
                strict_min_version: '109.0'
            },
            gecko_android: {}
        },
        data_collection_permissions: {
            permissions: ['NONE']
        }
    };
}

function longestCommonPrefix(lists) {
    if (!lists.length) return [];
    let prefix = lists[0].slice();
    for (const list of lists.slice(1)) {
        let i = 0;
        while (i < prefix.length && i < list.length && prefix[i] === list[i]) i++;
        prefix = prefix.slice(0, i);
        if (!prefix.length) break;
    }
    return prefix;
}

function importSpecifier(file) {
    return './' + file.split(path.sep).join('/');
}

async function bundle(name, files) {
    const contents = files.map(f => `import ${JSON.stringify(importSpecifier(f))};`).join('\n');
    await esbuild.build({
        stdin: {
            contents,
            resolveDir: ROOT,
            sourcefile: `${name}.entry.js`,
            loader: 'js'
        },
        bundle: true,
        format: 'iife',
        outfile: path.join(DIST, name),
        target: ['chrome109', 'firefox109'],
        sourcemap: inlineSourcemaps,
        logLevel: 'warning',
        charset: 'utf8'
    });
}

function scriptName(file) {
    return path.basename(file).replace(/\.(js|ts)$/, '') + '.js';
}

// Provider directories bundle to a single file named after the directory
// (src/providers/naurok/{dom,disabler,main}.ts -> naurok.js). Nested module
// directories join their segments with '-' so a provider can host several
// routes side by side (src/providers/naurok/round/* -> naurok-round.js).
function blockBundleName(remainder) {
    const dirs = remainder.map(file => {
        const match = /^src\/providers\/(.+)\/[^/]+$/.exec(file);
        return match ? match[1] : null;
    });
    if (dirs[0] && dirs.every(dir => dir === dirs[0])) {
        return dirs[0].replace(/\//g, '-') + '.js';
    }
    return scriptName(remainder[remainder.length - 1]);
}

// popup.html keeps only the bundled popup.js; the four setup scripts move into the bundle.
function transformPopupHtml(html) {
    const movedScripts = [
        'version.js',
        'src/core/constants.js',
        'src/core/settings-defaults.js',
        'src/ui/i18n.js'
    ];
    for (const script of movedScripts) {
        const tag = `<script src="${script}"></script>`;
        if (!html.includes(tag)) {
            throw new Error(`popup.html: expected script tag not found: ${tag}`);
        }
        html = html.replace(tag, '');
    }
    return html;
}

async function copyStaticAssets() {
    fs.cpSync(path.join(ROOT, 'images'), path.join(DIST, 'images'), { recursive: true });
    fs.cpSync(path.join(ROOT, 'lib'), path.join(DIST, 'lib'), { recursive: true });
    for (const css of ['popup.css', 'popup-m3.css']) {
        fs.copyFileSync(path.join(ROOT, css), path.join(DIST, css));
    }
    const popupHtml = fs.readFileSync(path.join(ROOT, 'popup.html'), 'utf-8');
    fs.writeFileSync(path.join(DIST, 'popup.html'), transformPopupHtml(popupHtml), 'utf-8');
}

async function main() {
    console.log(`Building ${targetBrowser} (${mode})...`);

    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });

    injectVersion(mode);

    // Content script blocks: shared core prefix + per-block remainder.
    const multiBlocks = commonManifest.content_scripts.filter(block => block.js.length > 3);
    if (!multiBlocks.length) {
        throw new Error('manifest.common.json: no multi-file content script blocks found');
    }
    const corePrefix = longestCommonPrefix(multiBlocks.map(block => block.js));
    if (!corePrefix.length) {
        throw new Error('manifest.common.json: content script blocks share no core prefix');
    }
    await bundle('core.js', corePrefix);

    const bundledProviders = new Map();
    const contentScripts = commonManifest.content_scripts.map(block => {
        if (block.js.length <= 3) {
            const name = scriptName(block.js[0]);
            bundledProviders.set(name, block.js);
            return { ...block, js: [name] };
        }
        const remainder = block.js.slice(corePrefix.length);
        if (!remainder.length) {
            throw new Error('manifest.common.json: block has no provider script: ' + block.matches.join(', '));
        }
        const name = blockBundleName(remainder);
        const existing = bundledProviders.get(name);
        if (existing && existing.join(',') !== remainder.join(',')) {
            throw new Error(`Duplicate bundle name "${name}" for: ${remainder.join(', ')}`);
        }
        bundledProviders.set(name, remainder);
        return { ...block, js: ['core.js', name] };
    });

    for (const [name, files] of bundledProviders) {
        await bundle(name, files);
    }

    // Extension-level scripts and web-accessible page scripts.
    await bundle('background.js', ['background.ts']);
    await bundle('popup.js', [
        'version.js',
        'src/core/constants.ts',
        'src/core/settings-defaults.ts',
        'src/ui/i18n.ts',
        'popup.ts'
    ]);

    const webAccessibleResources = [];
    for (const entry of commonManifest.web_accessible_resources) {
        const resources = [];
        for (const resource of entry.resources) {
            if (!/\.(js|ts)$/.test(resource)) {
                resources.push(resource);
                continue;
            }
            const name = scriptName(resource);
            await bundle(name, [resource]);
            resources.push(name);
        }
        webAccessibleResources.push({ ...entry, resources });
    }

    await copyStaticAssets();

    const manifest = {
        ...commonManifest,
        ...browserSpecifics(targetBrowser),
        content_scripts: contentScripts,
        web_accessible_resources: webAccessibleResources
    };
    fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

    console.log(`Done. Packaged tree is in ./dist (${contentScripts.length} content script blocks).`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
