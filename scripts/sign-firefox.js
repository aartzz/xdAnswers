#!/usr/bin/env node
//
// signs Firefox extension via Mozilla Add-ons API.
// reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET from:
//   1. shell environment (CI / manual export)
//   2. .env file in project root (gitignored)
//
// usage:  npm run sign:firefox
//         WEB_EXT_API_KEY=... WEB_EXT_API_SECRET=... npm run sign:firefox

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

// ---------- .env loader ----------
const envPath = path.join(root, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.substring(0, eq).trim();
    const value = trimmed.substring(eq + 1).trim();
    if (key) process.env[key] = value;
  }
}

// ---------- validate ----------
const { WEB_EXT_API_KEY, WEB_EXT_API_SECRET } = process.env;

if (!WEB_EXT_API_KEY || !WEB_EXT_API_SECRET) {
  console.error('Missing WEB_EXT_API_KEY or WEB_EXT_API_SECRET.');
  console.error('Set them in your shell or create .env (see .env.example).');
  process.exit(1);
}

// ---------- build manifest ----------
console.log('Generating manifest.json for firefox...');
execSync('node scripts/build-manifest.js firefox', { stdio: 'inherit', cwd: root });

// ---------- sign ----------
const buildDir = path.join(root, 'build');
try {
  console.log('Signing Firefox extension (channel: unlisted)...');
  // web-ext reads WEB_EXT_API_KEY / WEB_EXT_API_SECRET from env automatically
  execSync('cross-env TARGET=firefox web-ext sign --channel unlisted --config .web-ext-config.js', {
    stdio: 'inherit',
    cwd: root,
  });

  // Mozilla returns a hashed filename (e.g. e68dc4b0bdd54db0949c-5.0.1.xpi).
  // Rename it to the canonical name expected by the release workflow.
  const version = require(path.join(root, 'manifest.common.json')).version;
  const canonicalName = `xdAnswers-firefox-${version}.xpi`;

  const xpiFiles = fs.readdirSync(buildDir).filter(f => f.endsWith('.xpi'));
  if (xpiFiles.length === 1) {
    const downloaded = xpiFiles[0];
    if (downloaded !== canonicalName) {
      fs.renameSync(
        path.join(buildDir, downloaded),
        path.join(buildDir, canonicalName)
      );
      console.log(`Renamed ${downloaded} → ${canonicalName}`);
    }
  }

  console.log('Signing complete. Signed .xpi is in ./build/');
} finally {
  // always clean up temporary manifest.json
  try {
    fs.rmSync(path.join(root, 'manifest.json'), { force: true });
  } catch {}
}
