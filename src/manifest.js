/*
 * SCORM 1.2 imsmanifest.xml generator.
 *
 * Reference: ADL SCORM 1.2 Content Aggregation Model, sect. 3 (Content Packaging)
 * Produces a single-SCO manifest pointing at runtime/player.html.
 */
"use strict";

function escape(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generate(course, opts) {
  opts = opts || {};
  var id = "storycraft-" + (course.id || "course");
  var title = escape(course.title || "Untitled course");
  var version = opts.version || "1.0";
  var files = (opts.files || []).map(function (f) {
    return '      <file href="' + escape(f) + '"/>';
  }).join("\n");

  return [
    '<?xml version="1.0" standalone="no"?>',
    '<manifest identifier="' + escape(id) + '" version="' + escape(version) + '"',
    '  xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"',
    '  xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd',
    '                      http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd',
    '                      http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">',
    '  <metadata>',
    '    <schema>ADL SCORM</schema>',
    '    <schemaversion>1.2</schemaversion>',
    '  </metadata>',
    '  <organizations default="ORG-1">',
    '    <organization identifier="ORG-1">',
    '      <title>' + title + '</title>',
    '      <item identifier="ITEM-1" identifierref="RES-1" isvisible="true">',
    '        <title>' + title + '</title>',
    '        <adlcp:masteryscore>' + (course.passing_score || 80) + '</adlcp:masteryscore>',
    '      </item>',
    '    </organization>',
    '  </organizations>',
    '  <resources>',
    '    <resource identifier="RES-1" type="webcontent" adlcp:scormtype="sco" href="player.html">',
    files,
    '    </resource>',
    '  </resources>',
    '</manifest>',
    ''
  ].join("\n");
}

module.exports = { generate: generate };
