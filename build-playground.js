#!/usr/bin/env node
/*
 * Builds the standalone Storycraft web playground.
 *
 * Inlines the parser, manifest generator, and runtime files into a single
 * HTML page so the playground works offline and can be uploaded to any
 * static host (psidex.com, GitHub Pages, etc.).
 *
 * Output: dist/playground.html
 */
"use strict";

var fs = require("fs");
var path = require("path");

var root = __dirname;
var runtime = path.join(root, "runtime");
var src = path.join(root, "src");
var tmpl = path.join(root, "playground", "playground.template.html");
var out = path.join(root, "playground", "index.html");

function read(p) { return fs.readFileSync(p, "utf8"); }
function b64(p) { return fs.readFileSync(p).toString("base64"); }

// Read the parser + manifest as text — they're written as CommonJS but we'll
// strip the module.exports lines and inject them into the page as plain
// browser scripts.
var parserSrc = read(path.join(src, "parser.js"))
  .replace(/module\.exports\s*=\s*\{[^}]+\}\s*;\s*$/m, "")
  + "\nwindow.__SC_parse = parse; window.__SC_slugify = slugify;";

var manifestSrc = read(path.join(src, "manifest.js"))
  .replace(/module\.exports\s*=\s*\{[^}]+\}\s*;\s*$/m, "")
  + "\nwindow.__SC_manifest = generate;";

// Runtime files baked in as base64 so we can drop them into the zip
// unmodified, with no escaping concerns.
var runtimeFiles = {
  "player.css": b64(path.join(runtime, "player.css")),
  "scorm12-api.js": b64(path.join(runtime, "scorm12-api.js")),
  "player.js": b64(path.join(runtime, "player.js")),
  "player.html": b64(path.join(runtime, "player.html")),
};

var html = read(tmpl)
  .replace("/*__PARSER__*/", parserSrc)
  .replace("/*__MANIFEST__*/", manifestSrc)
  .replace("/*__RUNTIME_FILES__*/", "window.__SC_RUNTIME = " + JSON.stringify(runtimeFiles) + ";");

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("✓ Playground built → " + out + " (" + Math.round(html.length / 1024) + " KB)");
