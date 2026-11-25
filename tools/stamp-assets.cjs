#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1] || ''
  : path.join(__dirname, '..'));
const site = path.join(root, 'site');
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(version) || !readme.includes(`Current release: v${version}.`)) {
  throw new Error('package.json and README.md must identify the same release before stamping assets.');
}

function walk(dir) {
  return fs.readdirSync(dir, {withFileTypes:true}).flatMap(entry => {
    const filename = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(filename) : entry.isFile() ? [filename] : [];
  });
}

const hashes = new Map();
function digest(filename) {
  if (!hashes.has(filename)) {
    hashes.set(filename, crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex').slice(0,8));
  }
  return hashes.get(filename);
}

function assetPath(value, source) {
  const pathname = value.split(/[?#]/,1)[0];
  const filename = path.resolve(site, pathname.replace(/^\//,''));
  if (!filename.startsWith(site + path.sep) || !fs.existsSync(filename)) {
    throw new Error(`Missing or out-of-scope local asset in ${source}: ${value}`);
  }
  return filename;
}

// Dynamic stylesheet/script references must be explicit constants. Stamp them before
// hashing the referring JS, so its HTML cache key reflects the updated constant.
let dynamicReferences = 0;
for (const jsFile of walk(path.join(site,'js')).filter(file => file.endsWith('.js') &&
    !file.includes(`${path.sep}vendor${path.sep}`))) {
  const source = fs.readFileSync(jsFile,'utf8');
  const output = source.replace(/\bconst\s+([A-Z][A-Z_]*_(?:CSS|JS)_PATH)\s*=\s*(['"])([^'"\r\n]+)\2/g,
    (whole,name,quote,value) => {
      if (!/^(?:assets|js)\/[\w./-]+\.(?:css|js)(?:\?v=[^#]*)?$/.test(value)) {
        throw new Error(`Unsupported dynamic local resource ${name} in ${jsFile}`);
      }
      dynamicReferences++;
      const pathname=value.split('?')[0];
      return `const ${name}=${quote}${pathname}?v=${digest(assetPath(value,jsFile))}${quote}`;
    });
  if (output !== source) fs.writeFileSync(jsFile,output);
}
hashes.clear();

// Calculate hashes for all deployable CSS/JS, including files not currently referenced by HTML.
for (const dir of ['assets','js']) {
  for (const filename of walk(path.join(site,dir))) {
    if (/\.(?:css|js)$/i.test(filename)) digest(filename);
  }
}

let changed = 0;
let references = 0;
for (const htmlFile of walk(site).filter(file => file.endsWith('.html'))) {
  let html = fs.readFileSync(htmlFile,'utf8');
  let output = html.replace(/<(?:link|script)\b[^>]*>/gi, tag => {
    const attribute = /\b(href|src)\s*=\s*(["'])(.*?)\2/i.exec(tag);
    if (!attribute) return tag;
    const value = attribute[3];
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|data:)/i.test(value)) return tag;
    const match = /^([^?#]+\.(?:css|js|jsx))(\?[^#]*)?(#.*)?$/i.exec(value);
    if (!match) return tag;
    const filename = path.resolve(value.startsWith('/') ? site : path.dirname(htmlFile),
      value.startsWith('/') ? '.' + match[1] : match[1]);
    if (!filename.startsWith(site + path.sep) || !fs.existsSync(filename)) {
      throw new Error(`Missing or out-of-scope local asset in ${htmlFile}: ${value}`);
    }
    const query = match[2] ? match[2].slice(1).split(/&(?:amp;)?/).filter(item => !/^v=/.test(item) && item) : [];
    query.push(`v=${digest(filename)}`);
    const updated = `${match[1]}?${query.join('&amp;')}${match[3] || ''}`;
    references++;
    return tag.replace(attribute[0], attribute[0].replace(value,updated));
  });
  if (htmlFile === path.join(site,'index.html')) {
    output = output.replace(/<title>IAN OS v[\d.]+<\/title>/, `<title>IAN OS v${version}</title>`);
    output = output.replace(/(<span class="build-label"[^>]*>)v[\d.]+(<\/span>)/,
      `$1v${version}$2`);
  }
  if (output !== html) {
    fs.writeFileSync(htmlFile,output);
    changed++;
  }
}
// Include every deployable asset and application script, even images/fonts without HTML tags.
// Include relative paths as well as bytes so replacing/removing a file changes the fingerprint.
const build = crypto.createHash('sha256');
for (const dir of ['assets', 'js']) {
  for (const filename of walk(path.join(site, dir)).sort()) {
    build.update(path.relative(site, filename).replace(/\\/g, '/') + '\0');
    build.update(crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex') + '\n');
  }
}
const fingerprint = build.digest('hex').slice(0, 8);
const workerFile = path.join(site, 'sw.js');
const worker = fs.readFileSync(workerFile, 'utf8');
const cacheLine = `const CACHE_NAME = \`\${CACHE_PREFIX}${version}-${fingerprint}\`;`;
const updatedWorker = worker.replace(/^const CACHE_NAME = `\$\{CACHE_PREFIX\}[\d.]+(?:-[a-f\d]{8})?`;$/m, cacheLine);
if (updatedWorker === worker && !worker.includes(cacheLine)) throw new Error('Unknown Service Worker cache name format');
if (updatedWorker !== worker) fs.writeFileSync(workerFile, updatedWorker);
console.log(`Stamped ${dynamicReferences} dynamic and ${references} HTML CSS/JS references in ${changed} changed HTML file(s); build ${fingerprint}.`);
