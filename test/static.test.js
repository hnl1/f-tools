import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolPages = [
  "tools/clipboard.html",
  "tools/video-compare.html",
  "tools/image-compare.html",
  "tools/pdf-compare.html",
  "tools/pdf-to-image.html",
];
const pages = ["index.html", ...toolPages];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function resolveLocalReference(fromPage, value) {
  const [pathname] = value.split(/[?#]/);
  return path.normalize(path.join(path.dirname(fromPage), pathname));
}

test("GitHub Pages entry and moved tool pages exist", () => {
  assert.ok(existsSync(path.join(root, "index.html")), "index.html should stay at repo root");

  for (const page of toolPages) {
    assert.ok(existsSync(path.join(root, page)), `${page} should exist`);
  }

  for (const oldRootPage of toolPages.map((page) => path.basename(page))) {
    assert.equal(existsSync(path.join(root, oldRootPage)), false, `${oldRootPage} should move out of root`);
  }
});

test("home page links to every tool under tools/", () => {
  const html = read("index.html");

  for (const page of toolPages) {
    assert.match(html, new RegExp(`href="${page}"`), `index.html should link to ${page}`);
  }
});

test("local stylesheet, script, and page references resolve", () => {
  const attrPattern = /\b(?:href|src)="([^"]+)"/g;

  for (const page of pages) {
    const html = read(page);
    const references = [...html.matchAll(attrPattern)].map((match) => match[1]);

    for (const ref of references) {
      if (ref.includes("${")) continue;
      if (/^(?:https?:|data:|mailto:|tel:|#)/.test(ref)) continue;

      const resolved = resolveLocalReference(page, ref);
      assert.ok(existsSync(path.join(root, resolved)), `${page} references missing file: ${ref}`);
    }
  }
});

test("runtime dependencies are local vendor files", () => {
  for (const page of pages) {
    const html = read(page);
    assert.doesNotMatch(html, /<script[^>]+src="https?:\/\//, `${page} should not load scripts from CDN`);
    assert.doesNotMatch(html, /<link[^>]+rel="stylesheet"[^>]+href="https?:\/\//, `${page} should not load CSS from CDN`);
  }

  for (const vendorFile of [
    "vendor/pdfjs/pdf.min.js",
    "vendor/pdfjs/pdf.worker.min.js",
    "vendor/jspdf/jspdf.umd.min.js",
  ]) {
    assert.ok(existsSync(path.join(root, vendorFile)), `${vendorFile} should exist`);
  }
});

test("tool pages keep their key controls", () => {
  const expectations = {
    "tools/clipboard.html": ["id=\"linkName\"", "id=\"linkUrl\"", "id=\"copyLinkButton\"", "id=\"copyMarkdownButton\""],
    "tools/video-compare.html": ["id=\"grid\"", "id=\"sync-toggle\"", "id=\"sync-reset\"", "id=\"clear\""],
    "tools/image-compare.html": ["id=\"drop-hint\"", "id=\"grid\"", "id=\"zoom-strip\"", "id=\"file-input\""],
    "tools/pdf-compare.html": ["id=\"drop-hint\"", "id=\"grid\"", "id=\"sync-mode\"", "../vendor/pdfjs/pdf.min.js"],
    "tools/pdf-to-image.html": ["id=\"pdf-file\"", "id=\"convert-btn\"", "id=\"preview-canvas\"", "../vendor/jspdf/jspdf.umd.min.js"],
  };

  for (const [page, snippets] of Object.entries(expectations)) {
    const html = read(page);
    for (const snippet of snippets) {
      assert.ok(html.includes(snippet), `${page} should include ${snippet}`);
    }
  }
});

test("shared tool header style is sticky", () => {
  const css = read("assets/common.css");

  assert.match(css, /body\.tool-page > header\s*\{[\s\S]*position:\s*sticky;/);
  assert.match(css, /body\.tool-page > header\s*\{[\s\S]*top:\s*0;/);
});
