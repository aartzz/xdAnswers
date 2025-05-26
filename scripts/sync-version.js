// scripts/sync-version.js
const fs = require('fs');
const path = require('path');

// Шляхи до файлів
const manifestPath = path.join(__dirname, '..', 'manifest.json');
const packagePath = path.join(__dirname, '..', 'package.json');

// Читаємо package.json, щоб отримати нову версію
const packageJson = require(packagePath);
const newVersion = packageJson.version;

// Читаємо manifest.json
const manifestJson = require(manifestPath);

// Оновлюємо версію в manifest.json
manifestJson.version = newVersion;

// Записуємо оновлений manifest.json назад у файл
// Використовуємо 2 пробіли для форматування, щоб файл залишався читабельним
fs.writeFileSync(manifestPath, JSON.stringify(manifestJson, null, 2), 'utf-8');

console.log(`Successfully synced version to ${newVersion} in manifest.json`);