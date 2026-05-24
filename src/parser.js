/*
 * Storycraft markdown storyboard parser.
 *
 * Grammar (informal):
 *
 *   ---
 *   <YAML-ish frontmatter: title, duration, passing_score, language, xapi.endpoint>
 *   ---
 *
 *   ## Slide: <slide title>                  → linear content slide
 *   ## Check: <slide title>                  → knowledge-check slide
 *   ## Branch: <slide title>                 → branching scenario slide
 *
 *   Inside each slide, recognized directives (one per line):
 *     [Narration] <text>
 *     [Image: <src> | alt: <alt>]
 *     [Q] <question>                         → check-only
 *     [A*] <correct answer>                  → check-only, * marks correct
 *     [A]  <wrong answer>
 *     [Feedback correct] <text>              → check-only
 *     [Feedback incorrect] <text>            → check-only
 *     [Points] <n>                           → check-only, default 1
 *     [Prompt] <text>                        → branch-only
 *     [Option: <label> → <slide-id>]         → branch-only (one per line)
 *     [Id] <slide-id>                        → override auto-generated id
 *
 *   Anything else inside a Slide is treated as body markdown (rendered with a
 *   minimal subset: paragraphs, **bold**, *italic*, lists, inline code).
 *
 * Output: { meta, slides: [{ id, type, title, ... }, ...] }
 */

"use strict";

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "slide";
}

function parseFrontmatter(text) {
  var m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
  if (!m) return { meta: {}, body: text };
  var meta = {};
  m[1].split(/\n/).forEach(function (line) {
    var mm = line.match(/^\s*([\w.]+)\s*:\s*(.+?)\s*$/);
    if (!mm) return;
    var key = mm[1];
    var val = mm[2];
    if (/^\d+$/.test(val)) val = parseInt(val, 10);
    setNested(meta, key, val);
  });
  return { meta: meta, body: text.slice(m[0].length) };
}

function setNested(obj, dottedKey, val) {
  var parts = dottedKey.split(".");
  var cur = obj;
  for (var i = 0; i < parts.length - 1; i++) {
    if (!cur[parts[i]]) cur[parts[i]] = {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = val;
}

// Tiny inline-markdown to HTML — keeps output predictable and safe.
function renderInline(s) {
  return escapeHtml(s)
    .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderBody(lines) {
  var out = [];
  var listBuf = null; // { type: 'ul'|'ol', items: [] }

  function flushList() {
    if (!listBuf) return;
    out.push("<" + listBuf.type + ">");
    listBuf.items.forEach(function (it) { out.push("<li>" + renderInline(it) + "</li>"); });
    out.push("</" + listBuf.type + ">");
    listBuf = null;
  }

  var paraBuf = [];
  function flushPara() {
    if (paraBuf.length) {
      out.push("<p>" + paraBuf.map(renderInline).join(" ") + "</p>");
      paraBuf = [];
    }
  }

  lines.forEach(function (raw) {
    var line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flushPara(); flushList(); return; }
    var mUl = line.match(/^\s*[-*]\s+(.*)/);
    var mOl = line.match(/^\s*\d+\.\s+(.*)/);
    if (mUl) {
      flushPara();
      if (!listBuf || listBuf.type !== "ul") { flushList(); listBuf = { type: "ul", items: [] }; }
      listBuf.items.push(mUl[1]);
    } else if (mOl) {
      flushPara();
      if (!listBuf || listBuf.type !== "ol") { flushList(); listBuf = { type: "ol", items: [] }; }
      listBuf.items.push(mOl[1]);
    } else {
      flushList();
      paraBuf.push(line.trim());
    }
  });
  flushPara();
  flushList();
  return out.join("\n");
}

function parse(text) {
  var fm = parseFrontmatter(text);
  var lines = fm.body.split(/\n/);

  // Tokenize into slide groups
  var slides = [];
  var current = null;
  var bodyBuf = [];

  function flushBody() {
    if (!current) return;
    // Body lines are the non-directive lines
    var contentLines = bodyBuf;
    bodyBuf = [];
    if (current.type === "content" && contentLines.length) {
      current.body = renderBody(contentLines);
    } else if (contentLines.some(function (l) { return l.trim(); })) {
      // For check/branch slides, leftover lines become "body" too
      current.body = renderBody(contentLines);
    }
  }

  lines.forEach(function (raw) {
    var line = raw;
    var head = line.match(/^##\s*(Slide|Check|Branch)\s*:\s*(.+?)\s*$/i);
    if (head) {
      flushBody();
      if (current) slides.push(current);
      var typeWord = head[1].toLowerCase();
      var typeMap = { slide: "content", check: "check", branch: "branch" };
      current = {
        id: slugify(head[2]) + "-" + (slides.length + 1),
        type: typeMap[typeWord],
        title: head[2],
        choices: [],
        options: [],
      };
      return;
    }
    if (!current) return; // skip preamble lines

    var d;
    if ((d = line.match(/^\s*\[Id\]\s*(.+?)\s*$/i))) {
      current.id = slugify(d[1]);
      return;
    }
    if ((d = line.match(/^\s*\[Narration\]\s*(.+?)\s*$/i))) {
      current.narration = d[1];
      return;
    }
    if ((d = line.match(/^\s*\[Image:\s*([^|\]]+?)(?:\s*\|\s*alt:\s*([^\]]+?))?\s*\]\s*$/i))) {
      current.image = { src: d[1].trim(), alt: (d[2] || "").trim() };
      return;
    }
    if ((d = line.match(/^\s*\[Q\]\s*(.+?)\s*$/i))) {
      current.question = d[1];
      return;
    }
    if ((d = line.match(/^\s*\[A(\*?)\]\s*(.+?)\s*$/i))) {
      current.choices.push({ text: d[2], correct: d[1] === "*" });
      return;
    }
    if ((d = line.match(/^\s*\[Feedback\s+correct\]\s*(.+?)\s*$/i))) {
      current.feedback_correct = d[1];
      return;
    }
    if ((d = line.match(/^\s*\[Feedback\s+incorrect\]\s*(.+?)\s*$/i))) {
      current.feedback_incorrect = d[1];
      return;
    }
    if ((d = line.match(/^\s*\[Points\]\s*(\d+)\s*$/i))) {
      current.points = parseInt(d[1], 10);
      return;
    }
    if ((d = line.match(/^\s*\[Prompt\]\s*(.+?)\s*$/i))) {
      current.prompt = d[1];
      return;
    }
    if ((d = line.match(/^\s*\[Option:\s*(.+?)\s*(?:→|->)\s*([\w-]+)\s*\]\s*$/i))) {
      current.options.push({ label: d[1].trim(), goto: slugify(d[2]) });
      return;
    }
    // Body line
    bodyBuf.push(line);
  });
  flushBody();
  if (current) slides.push(current);

  // Resolve branch [Option] gotos: parser stored already-slugified ids; map
  // them to actual slide ids (which include a "-N" disambiguator).
  var branchTargets = new Set();
  slides.forEach(function (s) {
    if (s.type !== "branch") return;
    s.options.forEach(function (opt) {
      var match = slides.find(function (x) { return x.id === opt.goto; });
      if (!match) match = slides.find(function (x) { return x.id.indexOf(opt.goto + "-") === 0; });
      if (match) opt.goto = match.id;
      branchTargets.add(opt.goto);
    });
  });

  // Compute linear navigation, treating branch outcomes as siblings that all
  // converge to the first non-outcome slide after their group. Outcome slides
  // get no "prev" — going back to a branch decision via a back button would
  // break the scenario flow.
  // Land on the next slide that is either a regular content/check slide or a
  // branch decision — but skip past branch *outcomes* (they're reached only by
  // taking a branch option).
  function advanceNext(fromIdx) {
    for (var k = fromIdx; k < slides.length; k++) {
      if (!branchTargets.has(slides[k].id)) return slides[k].id;
    }
    return null;
  }
  // Land on the previous reachable non-outcome slide. Stop at a branch (you
  // can't reverse a decision).
  function advancePrev(idx) {
    for (var k = idx - 1; k >= 0; k--) {
      if (slides[k].type === "branch") return null;
      if (branchTargets.has(slides[k].id)) continue;
      return slides[k].id;
    }
    return null;
  }
  for (var i = 0; i < slides.length; i++) {
    var s = slides[i];
    if (s.type === "branch") continue; // branch has options, not next/prev
    if (branchTargets.has(s.id)) {
      // outcome slide: no back; next converges past sibling outcomes
      s.next = advanceNext(i + 1);
    } else {
      var p = advancePrev(i);
      if (p) s.prev = p;
      s.next = advanceNext(i + 1);
    }
  }

  return {
    meta: fm.meta,
    slides: slides,
  };
}

module.exports = { parse: parse, slugify: slugify };
