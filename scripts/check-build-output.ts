#!/usr/bin/env node

/**
 * Checks the files in dist/ before a deploy:
 * - index.html loads exactly one entry script, content-hashed, that exists in dist/;
 * - every JS and WASM file name is content-hashed (safe to cache forever);
 * - every chunk the entry can load exists in dist/;
 * - index.html contains a filled-in Content-Security-Policy.
 */

const fs = require('fs');
const path = require('path');

const dist = path.resolve(__dirname, '../dist');
const HASH = '[0-9a-f]{20}';
const errors = [];

const files = fs.readdirSync(dist);
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const scripts = [...html.matchAll(/<script type="module" src="\.\/([^"]+)"><\/script>/g)].map((m) => m[1]);
if (scripts.length !== 1) {
    errors.push(`index.html must load one module script, found: ${scripts.join(', ') || 'none'}`);
}
const entry = scripts[0];
if (entry && !new RegExp(`^bootstrap\\.${HASH}\\.js$`).test(entry)) {
    errors.push(`entry script is not content-hashed: ${entry}`);
}
if (entry && !files.includes(entry)) {
    errors.push(`entry script missing from dist: ${entry}`);
}

const hashed = new RegExp(`^(bootstrap|[0-9]+)\\.${HASH}\\.js$|^${HASH}\\.module\\.wasm$`);
for (const file of files.filter((f) => /\.(js|wasm)$/.test(f))) {
    if (!hashed.test(file)) {
        errors.push(`file name is not content-hashed: ${file}`);
    }
}

if (entry && files.includes(entry)) {
    // webpack's chunk file names in the entry: chunkId + "." + {"73":"d1b2...","780":"5ae0..."}[chunkId] + ".js"
    const source = fs.readFileSync(path.join(dist, entry), 'utf8');
    const map = source.match(/\{([^{}]*)\}\[chunkId\] \+ "\.js"/);
    const pairs = map ? [...map[1].matchAll(/"(\d+)":"([0-9a-f]{20})"/g)] : [];
    if (pairs.length === 0) {
        errors.push(`cannot find the chunk hashes in ${entry}`);
    }
    for (const [, id, hash] of pairs) {
        if (!files.includes(`${id}.${hash}.js`)) {
            errors.push(`chunk referenced by the entry is missing: ${id}.${hash}.js`);
        }
    }
}

if (!/<meta http-equiv="Content-Security-Policy" content="default-src 'none';[^"]+">/.test(html)) {
    errors.push('index.html has no filled-in Content-Security-Policy');
}

if (errors.length > 0) {
    console.error('❌ Build output check failed:\n- ' + errors.join('\n- '));
    process.exit(1);
}
console.log(`✅ Build output: ${entry} and ${files.filter((f) => /\.(js|wasm)$/.test(f)).length - 1} hashed files`);
