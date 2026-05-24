/*
 * Minimal SCORM 1.2 API wrapper.
 *
 * Finds the LMS API object by walking up window.parent and window.opener chains
 * (per the SCORM 1.2 RTE spec, sect. 3.3). If no LMS is present (course launched
 * standalone), all methods become no-ops returning sensible defaults — so the
 * course always runs, even without an LMS.
 *
 * Public API:
 *   SCORM.init()                 → boolean   call once on page load
 *   SCORM.set(element, value)    → boolean   LMSSetValue
 *   SCORM.get(element)           → string    LMSGetValue
 *   SCORM.commit()               → boolean   LMSCommit
 *   SCORM.finish()               → boolean   LMSFinish (also commits)
 *   SCORM.connected              → boolean   true if a real LMS API was found
 */
(function (global) {
  "use strict";

  var api = null;
  var connected = false;

  function findAPI(win) {
    var hops = 0;
    while (win && win.parent && win.parent !== win && hops < 50) {
      if (win.API) return win.API;
      win = win.parent;
      hops++;
    }
    if (win && win.API) return win.API;
    return null;
  }

  function getAPI() {
    if (api) return api;
    try {
      api = findAPI(window);
      if (!api && window.opener) api = findAPI(window.opener);
    } catch (e) { api = null; }
    return api;
  }

  var SCORM = {
    connected: false,

    init: function () {
      var a = getAPI();
      if (!a) { connected = false; this.connected = false; return false; }
      var ok = a.LMSInitialize("") === "true";
      connected = ok;
      this.connected = ok;
      if (ok) {
        a.LMSSetValue("cmi.core.lesson_status", "incomplete");
        a.LMSCommit("");
      }
      return ok;
    },

    set: function (key, value) {
      var a = getAPI();
      if (!a || !connected) return false;
      return a.LMSSetValue(key, String(value)) === "true";
    },

    get: function (key) {
      var a = getAPI();
      if (!a || !connected) return "";
      return a.LMSGetValue(key);
    },

    commit: function () {
      var a = getAPI();
      if (!a || !connected) return false;
      return a.LMSCommit("") === "true";
    },

    finish: function () {
      var a = getAPI();
      if (!a || !connected) return false;
      this.commit();
      var ok = a.LMSFinish("") === "true";
      connected = false;
      this.connected = false;
      return ok;
    },
  };

  global.SCORM = SCORM;
})(window);
