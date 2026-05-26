#!/usr/bin/env node
/*
 * Storycraft CLI
 *
 *   storycraft <storyboard.md> [-o out.zip] [--unzipped <dir>] [--no-zip]
 *
 * Reads a markdown storyboard, emits a SCORM 1.2 package ready for any
 * SCORM-compliant LMS (Moodle, TalentLMS, LearnUpon, Cornerstone, etc.).
 */
"use strict";

var fs = require("fs");
var path = require("path");
var { execSync, spawnSync } = require("child_process");
var parser = require("./parser");
var manifestGen = require("./manifest");

var USAGE = [
  "Usage: storycraft <storyboard.md> [options]",
  "",
  "Options:",
  "  -o, --out <path>       output zip path (default: dist/<basename>.zip)",
  "      --unzipped <dir>   stage directory (kept after build)",
  "      --no-zip           build the unzipped package, skip zipping",
  "      --locale <lang>    build a single localised variant; reads",
  "                         <input>.<lang>.md as the source if it exists",
  "      --locales <list>   comma-separated locales; builds one zip per locale,",
  "                         each named <basename>-<lang>.zip",
  "  -h, --help             show this help"
].join("\n");

function usage(code) {
  if (code === 0) { console.log(USAGE); process.exit(0); }
  console.error(USAGE);
  process.exit(2);
}

function parseArgs(argv) {
  var args = { input: null, out: null, unzippedDir: null, zip: true, locale: null, locales: null };
  for (var i = 2; i < argv.length; i++) {
    var a = argv[i];
    if (a === "-o" || a === "--out") args.out = argv[++i];
    else if (a === "--unzipped") args.unzippedDir = argv[++i];
    else if (a === "--no-zip") args.zip = false;
    else if (a === "--locale") args.locale = argv[++i];
    else if (a === "--locales") args.locales = argv[++i].split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    else if (a === "-h" || a === "--help") usage(0);
    else if (!args.input) args.input = a;
    else usage();
  }
  if (!args.input) usage();
  if (args.locale && args.locales) {
    console.error("Use --locale (single) or --locales (multiple), not both.");
    process.exit(2);
  }
  return args;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dst) {
  fs.copyFileSync(src, dst);
}

function readFile(p) { return fs.readFileSync(p, "utf8"); }

function buildCourseJSON(parsed) {
  var meta = parsed.meta || {};
  return {
    id: "course",
    title: meta.title || "Untitled course",
    duration: meta.duration || null,
    passing_score: meta.passing_score || 80,
    language: meta.language || "en",
    xapi: meta.xapi || null,
    slides: parsed.slides,
  };
}

function validate(course) {
  var errors = [];
  if (!course.slides.length) errors.push("No slides parsed — did you use '## Slide: ...' headings?");
  var ids = {};
  course.slides.forEach(function (s) {
    if (ids[s.id]) errors.push("Duplicate slide id: " + s.id);
    ids[s.id] = true;
    if (s.type === "check") {
      if (!s.question) errors.push("Slide '" + s.id + "': missing [Q] question");
      if (!s.choices.length) errors.push("Slide '" + s.id + "': no [A] answers");
      if (!s.choices.some(function (c) { return c.correct; }))
        errors.push("Slide '" + s.id + "': no correct [A*] answer marked");
    }
    if (s.type === "branch") {
      if (!s.options.length) errors.push("Slide '" + s.id + "': no [Option:] branches");
      s.options.forEach(function (opt) {
        if (!ids.hasOwnProperty(opt.goto) && !course.slides.some(function (x) { return x.id === opt.goto; }))
          errors.push("Slide '" + s.id + "': branch points to unknown slide '" + opt.goto + "'");
      });
    }
  });
  return errors;
}

function resolveLocaleSource(inputPath, locale) {
  // <input>.<lang>.md sibling; e.g. posh-awareness.md → posh-awareness.hi.md
  var dir = path.dirname(inputPath);
  var ext = path.extname(inputPath);
  var base = path.basename(inputPath, ext);
  var localeFile = path.join(dir, base + "." + locale + ext);
  return fs.existsSync(localeFile) ? localeFile : null;
}

function buildOne(srcPath, args, locale) {
  var actualSrc = srcPath;
  var localeSuffix = "";
  if (locale) {
    var override = resolveLocaleSource(srcPath, locale);
    if (override) {
      actualSrc = override;
    } else {
      console.error("  ⚠ No override found for locale '" + locale +
        "' (expected " + path.basename(srcPath, path.extname(srcPath)) + "." + locale + ".md). Using master with language=" + locale + ".");
    }
    localeSuffix = "-" + locale;
  }
  var text = readFile(actualSrc);
  var parsed = parser.parse(text);
  var course = buildCourseJSON(parsed);
  if (locale) course.language = locale;

  var errs = validate(course);
  if (errs.length) {
    console.error("Storyboard validation failed for " + path.basename(actualSrc) + ":");
    errs.forEach(function (e) { console.error("  ✗ " + e); });
    return null;
  }

  var baseName = path.basename(srcPath, path.extname(srcPath));
  var stageDir = args.unzippedDir
    ? path.resolve(args.unzippedDir + localeSuffix)
    : path.resolve(path.dirname(srcPath), "..", "dist", baseName + localeSuffix);
  ensureDir(stageDir);

  var runtimeDir = path.resolve(__dirname, "..", "runtime");
  var assetsSrc = path.join(path.dirname(srcPath), "assets");

  ["player.css", "scorm12-api.js", "player.js"].forEach(function (f) {
    copyFile(path.join(runtimeDir, f), path.join(stageDir, f));
  });

  var tmpl = readFile(path.join(runtimeDir, "player.html"));
  var courseJSON = JSON.stringify(course).replace(/<\/script>/gi, "<\\/script>");
  var html = tmpl
    .replace(/{{LANG}}/g, course.language)
    .replace(/{{TITLE}}/g, course.title.replace(/[<>"&]/g, function (c) {
      return { "<": "&lt;", ">": "&gt;", '"': "&quot;", "&": "&amp;" }[c];
    }))
    .replace(/{{COURSE_JSON}}/g, courseJSON);
  fs.writeFileSync(path.join(stageDir, "player.html"), html);

  var assetFiles = [];
  if (fs.existsSync(assetsSrc) && fs.statSync(assetsSrc).isDirectory()) {
    ensureDir(path.join(stageDir, "assets"));
    fs.readdirSync(assetsSrc).forEach(function (f) {
      copyFile(path.join(assetsSrc, f), path.join(stageDir, "assets", f));
      assetFiles.push("assets/" + f);
    });
  }

  var allFiles = ["player.html", "player.css", "player.js", "scorm12-api.js"].concat(assetFiles);
  var manifest = manifestGen.generate(course, { files: allFiles });
  fs.writeFileSync(path.join(stageDir, "imsmanifest.xml"), manifest);

  var pkgInfo = {
    slides: course.slides.length,
    checks: course.slides.filter(function (s) { return s.type === "check"; }).length,
    branches: course.slides.filter(function (s) { return s.type === "branch"; }).length,
    assets: assetFiles.length,
    stageDir: stageDir,
    title: course.title,
    language: course.language,
    passing_score: course.passing_score,
  };

  if (args.zip) {
    var outZip = args.out && !args.locales
      ? path.resolve(args.out)
      : path.resolve(path.dirname(srcPath), "..", "dist", baseName + localeSuffix + ".zip");
    ensureDir(path.dirname(outZip));
    try { fs.unlinkSync(outZip); } catch (e) {}
    spawnSync("find", [stageDir, "-exec", "touch", "-h", "-t", "202401010000", "{}", "+"], { stdio: "ignore" });
    spawnSync("bash", ["-c", 'find . -type f -o -type d | LC_ALL=C sort | zip -qX -@ "$1"', "--", outZip],
      { cwd: stageDir, stdio: "inherit" }
    );
    pkgInfo.zip = outZip;
  }

  return pkgInfo;
}

function main() {
  var args = parseArgs(process.argv);
  var srcPath = path.resolve(args.input);

  var locales = args.locales ? args.locales : (args.locale ? [args.locale] : [null]);
  var built = [];
  locales.forEach(function (loc) {
    var info = buildOne(srcPath, args, loc);
    if (info) built.push(info);
  });
  if (!built.length) process.exit(1);

  built.forEach(function (info) {
    console.log("✓ Storycraft build complete" + (info.language ? " [" + info.language + "]" : ""));
    console.log("  title       : " + info.title);
    console.log("  slides      : " + info.slides + "  (" + info.checks + " checks, " + info.branches + " branches)");
    console.log("  passing     : " + info.passing_score + "%");
    console.log("  assets      : " + info.assets);
    console.log("  unzipped    : " + info.stageDir);
    if (info.zip) console.log("  SCORM zip   : " + info.zip);
  });
  return;
}


main();
