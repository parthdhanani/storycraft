/*
 * Storycraft runtime — renders course.json into an interactive SCORM-compliant
 * player. Handles:
 *   - linear and branching navigation
 *   - knowledge checks with scoring
 *   - cmi.core.score.raw / lesson_status / session_time reporting
 *   - xAPI statement emission (optional, fires only if XAPI_ENDPOINT is set)
 *   - keyboard navigation (Tab/Enter/Arrow) and WCAG focus management
 */
(function () {
  "use strict";

  var course = window.__COURSE__;
  var state = {
    currentId: null,
    visited: new Set(),
    answers: {},     // {slideId: {choiceIdx, correct}}
    score: 0,        // raw points earned
    maxScore: 0,     // raw points available
    started: Date.now(),
  };

  // ---------- xAPI emit (optional) ----------
  function xapiSend(verb, objectId, result) {
    if (!course.xapi || !course.xapi.endpoint) return;
    var stmt = {
      actor: { name: SCORM.get("cmi.core.student_name") || "anonymous",
               mbox: "mailto:" + (SCORM.get("cmi.core.student_id") || "anon@example.com") },
      verb: { id: "http://adlnet.gov/expapi/verbs/" + verb,
              display: { "en-US": verb } },
      object: {
        id: course.id + "#" + objectId,
        definition: { name: { "en-US": objectId } },
      },
    };
    if (result) stmt.result = result;
    try {
      fetch(course.xapi.endpoint + "/statements", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Experience-API-Version": "1.0.3",
          "Authorization": course.xapi.auth || "",
        },
        body: JSON.stringify(stmt),
      }).catch(function () {}); // silent — xAPI is fire-and-forget
    } catch (e) {}
  }

  // ---------- precompute scoring ----------
  course.slides.forEach(function (s) {
    if (s.type === "check") state.maxScore += (s.points || 1);
  });

  // ---------- rendering ----------
  var $stage = document.getElementById("stage");
  var $progress = document.getElementById("progress");
  var $title = document.getElementById("course-title");
  $title.textContent = course.title;
  document.title = course.title;
  $progress.setAttribute("aria-label", "Course progress");

  function renderSlide(slide) {
    state.currentId = slide.id;
    state.visited.add(slide.id);
    $stage.innerHTML = "";
    $stage.setAttribute("aria-busy", "true");

    var node = document.createElement("article");
    node.className = "slide slide-" + slide.type;
    node.setAttribute("role", "region");
    node.setAttribute("aria-labelledby", "slide-heading");

    var h = document.createElement("h2");
    h.id = "slide-heading";
    h.textContent = slide.title || "";
    node.appendChild(h);

    if (slide.image) {
      var img = document.createElement("img");
      img.src = "assets/" + slide.image.src;
      img.alt = slide.image.alt || "";
      img.className = "slide-image";
      node.appendChild(img);
    }

    if (slide.narration) {
      var n = document.createElement("p");
      n.className = "narration";
      n.setAttribute("aria-label", "Narration");
      n.textContent = slide.narration;
      node.appendChild(n);
    }

    if (slide.body) {
      var bodyEl = document.createElement("div");
      bodyEl.className = "body";
      bodyEl.innerHTML = slide.body; // sanitized at build time
      node.appendChild(bodyEl);
    }

    if (slide.type === "check") renderCheck(slide, node);
    else if (slide.type === "branch") renderBranch(slide, node);
    else renderLinearNav(slide, node);

    $stage.appendChild(node);
    $stage.setAttribute("aria-busy", "false");
    h.focus();

    updateProgress();
    SCORM.set("cmi.core.lesson_location", slide.id);
    SCORM.commit();
    xapiSend("experienced", slide.id);
  }

  function renderLinearNav(slide, node) {
    var nav = document.createElement("div");
    nav.className = "nav";
    if (slide.prev) {
      nav.appendChild(button("Previous", function () { go(slide.prev); }, "secondary"));
    }
    if (slide.next) {
      nav.appendChild(button("Next", function () { go(slide.next); }, "primary"));
    } else {
      nav.appendChild(button("Finish course", finishCourse, "primary"));
    }
    node.appendChild(nav);
  }

  function renderCheck(slide, node) {
    var q = document.createElement("p");
    q.className = "question";
    q.textContent = slide.question;
    node.appendChild(q);

    var list = document.createElement("ul");
    list.className = "choices";
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-labelledby", "slide-heading");

    slide.choices.forEach(function (c, idx) {
      var li = document.createElement("li");
      var b = document.createElement("button");
      b.className = "choice";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.textContent = String.fromCharCode(65 + idx) + ". " + c.text;
      b.addEventListener("click", function () { answerCheck(slide, idx, node); });
      li.appendChild(b);
      list.appendChild(li);
    });
    node.appendChild(list);
  }

  function answerCheck(slide, choiceIdx, node) {
    if (state.answers[slide.id]) return; // already answered
    var choice = slide.choices[choiceIdx];
    var correct = !!choice.correct;
    state.answers[slide.id] = { choiceIdx: choiceIdx, correct: correct };
    if (correct) state.score += (slide.points || 1);

    Array.prototype.forEach.call(node.querySelectorAll(".choice"), function (b, i) {
      b.disabled = true;
      if (i === choiceIdx) b.classList.add(correct ? "right" : "wrong");
      if (slide.choices[i].correct) b.classList.add("answer");
    });

    var fb = document.createElement("p");
    fb.className = "feedback " + (correct ? "ok" : "err");
    fb.setAttribute("role", "status");
    fb.textContent = correct ? (slide.feedback_correct || "Correct.")
                             : (slide.feedback_incorrect || "Not quite. " + (choice.feedback || ""));
    node.appendChild(fb);

    // SCORM 1.2 indexes interactions starting from 0
    var idx = Object.keys(state.answers).length - 1;
    SCORM.set("cmi.interactions." + idx + ".id", slide.id);
    SCORM.set("cmi.interactions." + idx + ".type", "choice");
    SCORM.set("cmi.interactions." + idx + ".student_response", String(choiceIdx));
    SCORM.set("cmi.interactions." + idx + ".result", correct ? "correct" : "wrong");
    SCORM.commit();
    xapiSend("answered", slide.id, { success: correct, response: String.fromCharCode(65 + choiceIdx) });

    var nav = document.createElement("div");
    nav.className = "nav";
    if (slide.next) nav.appendChild(button("Next", function () { go(slide.next); }, "primary"));
    else nav.appendChild(button("Finish course", finishCourse, "primary"));
    node.appendChild(nav);
  }

  function renderBranch(slide, node) {
    var p = document.createElement("p");
    p.className = "prompt";
    p.textContent = slide.prompt;
    node.appendChild(p);

    var list = document.createElement("ul");
    list.className = "branches";
    slide.options.forEach(function (opt) {
      var li = document.createElement("li");
      li.appendChild(button(opt.label, function () { go(opt.goto); }, "branch"));
      list.appendChild(li);
    });
    node.appendChild(list);
  }

  function button(label, onClick, cls) {
    var b = document.createElement("button");
    b.className = "btn " + (cls || "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function go(slideId) {
    var s = course.slides.find(function (x) { return x.id === slideId; });
    if (!s) { console.warn("Unknown slide:", slideId); return; }
    renderSlide(s);
  }

  function updateProgress() {
    var pct = Math.round((state.visited.size / course.slides.length) * 100);
    $progress.style.width = pct + "%";
    $progress.setAttribute("aria-valuenow", String(pct));
  }

  function finishCourse() {
    var pctScore = state.maxScore > 0 ? Math.round((state.score / state.maxScore) * 100) : 100;
    var passed = pctScore >= (course.passing_score || 80);

    SCORM.set("cmi.core.score.raw", String(pctScore));
    SCORM.set("cmi.core.score.min", "0");
    SCORM.set("cmi.core.score.max", "100");
    SCORM.set("cmi.core.lesson_status", passed ? "passed" : "failed");

    var dt = Math.floor((Date.now() - state.started) / 1000);
    var hh = String(Math.floor(dt / 3600)).padStart(2, "0");
    var mm = String(Math.floor((dt % 3600) / 60)).padStart(2, "0");
    var ss = String(dt % 60).padStart(2, "0");
    SCORM.set("cmi.core.session_time", hh + ":" + mm + ":" + ss);

    SCORM.commit();
    xapiSend(passed ? "passed" : "failed", "course", { score: { raw: pctScore, min: 0, max: 100 }, success: passed });

    $stage.innerHTML =
      '<article class="slide slide-end">' +
      '  <h2>Course complete</h2>' +
      '  <p class="score-line">Score: <strong>' + pctScore + '%</strong> ' +
      '    <span class="status ' + (passed ? "ok" : "err") + '">(' + (passed ? "Passed" : "Failed") + ')</span></p>' +
      '  <p>You may now close this window.</p>' +
      '</article>';

    setTimeout(function () { SCORM.finish(); }, 250);
  }

  // ---------- startup ----------
  SCORM.init();
  var savedLoc = SCORM.get("cmi.core.lesson_location");
  var startId = (savedLoc && course.slides.some(function (s) { return s.id === savedLoc; }))
              ? savedLoc : course.slides[0].id;
  go(startId);

  // Save on unload — but don't overwrite a terminal status (passed/failed/completed)
  // that finishCourse() just set.
  var terminal = { passed: 1, failed: 1, completed: 1 };
  window.addEventListener("beforeunload", function () {
    var current = SCORM.get("cmi.core.lesson_status");
    if (!terminal[current]) {
      SCORM.set("cmi.core.lesson_status", "incomplete");
    }
    SCORM.commit();
    SCORM.finish();
  });

  // Keyboard: Right arrow → next button, Left arrow → previous if present
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "BUTTON") return;
    if (e.key === "ArrowRight") {
      var nx = document.querySelector(".btn.primary");
      if (nx) nx.click();
    } else if (e.key === "ArrowLeft") {
      var pv = document.querySelector(".btn.secondary");
      if (pv) pv.click();
    }
  });
})();
