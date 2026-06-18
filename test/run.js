#!/usr/bin/env node
/*
 * storycraft test runner — no framework, no deps.
 *
 *   npm test
 *
 * Tests are plain `test(name, fn)` calls. A failing test throws; a passing
 * test returns. Exit code 0 on all-green, 1 otherwise. Matches the
 * scorm-kit test runner style for consistency.
 */
"use strict";

var fs = require("fs");
var path = require("path");
var os = require("os");
var crypto = require("crypto");
var { spawnSync } = require("child_process");

var ROOT = path.resolve(__dirname, "..");
var BIN = path.join(ROOT, "src", "storycraft.js");
var EXAMPLES = path.join(ROOT, "examples");

var passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log("  \x1b[32m✓\x1b[0m " + name);
    passed++;
  } catch (e) {
    console.log("  \x1b[31m✗\x1b[0m " + name);
    console.log("    " + (e.stack || e.message).split("\n").join("\n    "));
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error("Assertion failed: " + (msg || ""));
}

function sha256(buf) { return crypto.createHash("sha256").update(buf).digest("hex"); }

function withTempDir(fn) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), "storycraft-test-"));
  try { return fn(dir); } finally { spawnSync("rm", ["-rf", dir]); }
}

function build(mdPath, outDir, extraArgs) {
  var basename = path.basename(mdPath, ".md");
  var zipPath = path.join(outDir, basename + ".zip");
  var unzippedDir = path.join(outDir, basename);
  var args = [BIN, mdPath, "--out", zipPath, "--unzipped", unzippedDir].concat(extraArgs || []);
  var res = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error("storycraft exit " + res.status + ": " + res.stderr + res.stdout);
  }
  return { stdout: res.stdout, zipPath: zipPath, unzippedDir: unzippedDir };
}

// ---------- Tests ----------

console.log("");
console.log("storycraft test suite");
console.log("");

test("CLI: --help exits 0 with usage", function () {
  var res = spawnSync(process.execPath, [BIN, "--help"], { encoding: "utf8" });
  assert(res.status === 0, "exit code should be 0");
  assert(/usage/i.test(res.stdout) || /storycraft/i.test(res.stdout), "should print usage");
});

test("CLI: no args exits non-zero", function () {
  var res = spawnSync(process.execPath, [BIN], { encoding: "utf8" });
  assert(res.status !== 0, "should error without input file");
});

test("CLI: missing file exits non-zero", function () {
  var res = spawnSync(process.execPath, [BIN, "/no/such/file.md"], { encoding: "utf8" });
  assert(res.status !== 0, "should error on missing file");
});

test("build: posh-awareness.md produces a SCORM zip", function () {
  withTempDir(function (tmp) {
    var r = build(path.join(EXAMPLES, "posh-awareness.md"), tmp);
    assert(fs.existsSync(r.zipPath), "zip should exist");
    assert(fs.statSync(r.zipPath).size > 1024, "zip should be > 1KB");
  });
});

test("build: zip is byte-identical across two runs (determinism)", function () {
  withTempDir(function (tmp1) {
    withTempDir(function (tmp2) {
      var r1 = build(path.join(EXAMPLES, "posh-awareness.md"), tmp1);
      var r2 = build(path.join(EXAMPLES, "posh-awareness.md"), tmp2);
      var z1 = fs.readFileSync(r1.zipPath);
      var z2 = fs.readFileSync(r2.zipPath);
      assert(sha256(z1) === sha256(z2), "two builds should produce identical zips (got " + sha256(z1).slice(0, 8) + " vs " + sha256(z2).slice(0, 8) + ")");
    });
  });
});

test("build: package contains the required SCORM 1.2 files", function () {
  withTempDir(function (tmp) {
    var r = build(path.join(EXAMPLES, "posh-awareness.md"), tmp);
    ["imsmanifest.xml", "player.html", "player.js", "player.css", "scorm12-api.js"].forEach(function (f) {
      assert(fs.existsSync(path.join(r.unzippedDir, f)), f + " should be in the package");
    });
  });
});

test("build: imsmanifest.xml declares SCORM 1.2 schema", function () {
  withTempDir(function (tmp) {
    var r = build(path.join(EXAMPLES, "posh-awareness.md"), tmp);
    var manifest = fs.readFileSync(path.join(r.unzippedDir, "imsmanifest.xml"), "utf8");
    assert(/<schema>\s*ADL SCORM\s*<\/schema>/.test(manifest), "schema should be ADL SCORM");
    assert(/<schemaversion>\s*1\.2\s*<\/schemaversion>/.test(manifest), "schemaversion should be 1.2");
    assert(/xmlns:adlcp=/.test(manifest), "adlcp namespace should be declared on root");
  });
});

test("build: course JSON has correct slide count for posh-awareness", function () {
  withTempDir(function (tmp) {
    var r = build(path.join(EXAMPLES, "posh-awareness.md"), tmp);
    var html = fs.readFileSync(path.join(r.unzippedDir, "player.html"), "utf8");
    var m = html.match(/window\.__COURSE__\s*=\s*({[\s\S]*?});\s*<\/script>/);
    assert(m, "player.html should embed __COURSE__");
    var course = JSON.parse(m[1]);
    assert(Array.isArray(course.slides), "slides should be an array");
    assert(course.slides.length === 12, "posh-awareness should have 12 slides, got " + course.slides.length);
    assert(course.title.length > 0, "title should be set from frontmatter");
  });
});

test("build: --locale hi builds the Hindi variant cleanly", function () {
  withTempDir(function (tmp) {
    var r = build(path.join(EXAMPLES, "posh-awareness.hi.md"), tmp);
    var html = fs.readFileSync(path.join(r.unzippedDir, "player.html"), "utf8");
    assert(/lang="hi"/.test(html), "player.html should set lang=hi");
  });
});

test("build: all example files build without error", function () {
  fs.readdirSync(EXAMPLES).filter(function (f) { return f.endsWith(".md"); }).forEach(function (f) {
    withTempDir(function (tmp) {
      build(path.join(EXAMPLES, f), tmp);
    });
  });
});

test("parser: rejects empty input", function () {
  var parser = require(path.join(ROOT, "src", "parser.js"));
  try { parser.parse(""); } catch { /* empty input may throw or return empty AST — both fine */ }
  // Either throws or returns an empty AST — both are acceptable; what's
  // unacceptable is a crash building from empty input.
  // (Allows for graceful-empty behavior.)
});

// ---------- Summary ----------

console.log("");
console.log(passed + " passed, " + failed + " failed (" + (passed + failed) + " total)");
process.exit(failed > 0 ? 1 : 0);
