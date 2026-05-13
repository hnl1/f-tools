import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const toolPages = [
  "tools/clipboard.html",
  "tools/video-compare.html",
  "tools/image-compare.html",
  "tools/pdf-compare.html",
  "tools/pdf-to-image.html",
];
const hiddenPages = [
  "tools/icons.html",
];
const secondaryPages = [];
const fileInputPages = [
  "tools/video-compare.html",
  "tools/image-compare.html",
  "tools/pdf-compare.html",
  "tools/pdf-to-image.html",
];
const fileInputSupportText = {
  "tools/video-compare.html": "支持常见视频格式",
  "tools/image-compare.html": "支持常见图片格式",
  "tools/pdf-compare.html": "支持 PDF 文件",
  "tools/pdf-to-image.html": "支持 PDF 文件",
};
const pages = ["index.html", ...secondaryPages, ...toolPages, ...hiddenPages];

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function resolveLocalReference(fromPage, value) {
  const [pathname] = value.split(/[?#]/);
  return path.normalize(path.join(path.dirname(fromPage), pathname));
}

test("GitHub Pages entry and moved tool pages exist", () => {
  assert.ok(existsSync(path.join(root, "index.html")), "index.html should stay at repo root");

  for (const page of secondaryPages) {
    assert.ok(existsSync(path.join(root, page)), `${page} should exist`);
  }

  for (const page of toolPages) {
    assert.ok(existsSync(path.join(root, page)), `${page} should exist`);
  }

  for (const page of hiddenPages) {
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

test("home page footer links to hidden pages", () => {
  const html = read("index.html");

  for (const page of hiddenPages) {
    assert.match(html, new RegExp(`href="${page}"`), `index.html footer should link to hidden page ${page}`);
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

test("tool pages link back to the home page", () => {
  for (const page of toolPages) {
    const html = read(page);
    assert.match(html, /<script src="\.\.\/assets\/home-link\.js"><\/script>/, `${page} should load the shared home link`);
    assert.match(html, /ToolHeader\.mount\(/, `${page} should mount the shared tool header`);
    assert.doesNotMatch(html, /← 返回/, `${page} should not label the home link as back`);
  }
});

test("pdf to image hides advanced output options", () => {
  const html = read("tools/pdf-to-image.html");

  assert.match(html, /<title>PDF 转图片版<\/title>/, "pdf-to-image page title should use the shorter name");
  assert.match(html, /title:\s*'PDF 转图片版'/, "pdf-to-image header should use the shorter name");
  assert.doesNotMatch(html, /PDF 转图片版 PDF/, "pdf-to-image should not use the old longer name");
  assert.doesNotMatch(html, /id="scale"/, "pdf-to-image should not expose render scale control");
  assert.doesNotMatch(html, /渲染倍率/, "pdf-to-image should not show render scale label");
  assert.doesNotMatch(html, /倍率对所有 PDF 生效/, "pdf-to-image should not show render scale hint");
  assert.doesNotMatch(html, /id="format"/, "pdf-to-image should not expose image format selection");
  assert.doesNotMatch(html, /id="quality"/, "pdf-to-image should not expose JPEG quality selection");
  assert.doesNotMatch(html, />\s*图片格式\s*</, "pdf-to-image should not show image format label");
  assert.doesNotMatch(html, />\s*JPEG 质量\s*</, "pdf-to-image should not show JPEG quality label");
  assert.doesNotMatch(html, /id="preview-canvas"/, "pdf-to-image should not keep the first-page preview canvas");
  assert.doesNotMatch(html, /第一页预览/, "pdf-to-image should remove first-page preview UI");
});

test("pdf to image displays directory paths for folder imports", () => {
  const html = read("tools/pdf-to-image.html");

  assert.match(html, /function getDisplayPathSeparator\(\)/);
  assert.match(html, /function getPdfDisplayName\(file, fileEntry\)/);
  assert.match(html, /function getPdfOutputPath\(file, fileEntry, outputName\)/);
  assert.match(html, /relativePath\.split\('\/'\)\.filter\(Boolean\)\.join\(getDisplayPathSeparator\(\)\)/);
  assert.match(html, /addPdfFiles\(files, detail\.sourceLabel, detail\.fileEntries\)/);
});

test("pdf to image zips multiple generated downloads with paths", () => {
  const html = read("tools/pdf-to-image.html");

  assert.match(html, /async function createZipBlob\(entries\)/);
  assert.match(html, /async function downloadAllGenerated\(\)/);
  assert.match(html, /generatedItems\.length === 1/);
  assert.match(html, /downloadBlob\(item\.outputBlob, item\.outputName\)/);
  assert.match(html, /path:\s*item\.outputPath \|\| item\.outputName/);
  assert.match(html, /pdf-to-image-results\.zip/);
});

test("pdf to image uses the shared upload prompt", () => {
  const html = read("tools/pdf-to-image.html");
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";

  assert.match(main, /class="[^"]*\bfile-drop-zone\b[^"]*"/, "pdf-to-image should use the shared input box style");
  assert.match(main, /class="[^"]*\bvisually-hidden-file\b[^"]*"/, "pdf-to-image should keep the native file input hidden");
  assert.match(main, /class="[^"]*\bfile-drop-icon\b[^"]*"/, "pdf-to-image should show the shared drop prompt icon");
  assert.match(main, /class="[^"]*\bfile-drop-title\b[^"]*"/, "pdf-to-image should include the shared drop prompt title host");
  assert.match(html, /\bsubject:\s*'PDF'/, "pdf-to-image should let the shared drop zone format the prompt title");
  assert.match(main, /class="[^"]*\bfile-drop-status\b[^"]*"[^>]*\bhidden\b/, "pdf-to-image should keep initial status hidden");
  assert.doesNotMatch(main, /class="[^"]*\bpanel-head\b[^"]*"/, "pdf-to-image should not show an input section heading");
  assert.doesNotMatch(main, /等待(?:添加|选择) PDF/, "pdf-to-image should not show initial waiting copy");
  assert.doesNotMatch(main, /把每页 PDF 渲染成图片/, "pdf-to-image should not show explanatory copy");
});

test("file input pages use the shared drop zone", () => {
  assert.ok(existsSync(path.join(root, "assets/file-input.js")), "shared file input script should exist");

  for (const page of fileInputPages) {
    const html = read(page);
    assert.match(html, /<script src="\.\.\/assets\/file-input\.js"><\/script>/, `${page} should load shared file input script`);
    assert.match(html, /class="[^"]*\bfile-drop-zone\b[^"]*"/, `${page} should include shared drop zone class`);
    assert.match(html, /class="[^"]*\bfile-drop-zone\b[^"]*"[^>]*\brole="button"/, `${page} drop zone should expose button semantics`);
    assert.match(html, /class="[^"]*\bfile-drop-zone\b[^"]*"[^>]*\btabindex="0"/, `${page} drop zone should be keyboard focusable`);
    assert.match(html, /class="[^"]*\bvisually-hidden-file\b[^"]*"/, `${page} should keep a hidden file input`);
    assert.match(html, /class="[^"]*\bfile-drop-icon\b[^"]*"/, `${page} should include a lightweight file prompt icon`);
    assert.match(html, /id="(?:file-input|pdf-file)"/, `${page} should keep its file input id`);
    assert.match(html, /\baccept="[^"]+"/, `${page} should keep the file input accept attribute`);
    assert.match(html, /<input[^>]+\bmultiple\b/, `${page} should keep multiple file selection`);
    assert.doesNotMatch(html, /id="(?:choose-file-btn|choose-pdf-btn)"/, `${page} should not include an internal choose button`);
    assert.doesNotMatch(html, /class="[^"]*\bfile-choose-button\b[^"]*"/, `${page} should not depend on the old choose button class`);
    assert.doesNotMatch(html, />\s*选择(?:视频|图片| PDF)\s*</, `${page} should not show the old choose button text`);
    assert.match(html, /class="[^"]*\bfile-drop-title\b[^"]*"/, `${page} should include a shared drop zone title host`);
    assert.match(html, /class="[^"]*\bfile-drop-status\b[^"]*"/, `${page} should keep status text in the drop zone`);
    assert.match(html, /class="[^"]*\bfile-drop-status\b[^"]*"[^>]*\bhidden\b/, `${page} should keep initial status hidden`);
    assert.ok(!html.includes(fileInputSupportText[page]), `${page} should not include initial supported format text`);
    assert.doesNotMatch(html, /<span class="hint">拖入、粘贴或选择[^<]*即可[^<]*<\/span>/, `${page} should not include redundant header input hint`);
    assert.doesNotMatch(html, /(?:等待添加(?:视频|图片|PDF)|未选择 PDF)/, `${page} should not use old empty status text`);
    assert.match(html, /FileInputDropZone\.bind\(/, `${page} should bind shared file input behavior`);
    assert.match(html, /\btriggerElement:\s*dropHint/, `${page} should bind the drop zone as the picker trigger`);
    assert.doesNotMatch(html, /\bemptyText:\s*['"]支持(?:常见(?:视频|图片)格式| PDF 文件)['"]/, `${page} should not initialize supported format text`);

    for (const match of html.matchAll(/\saria-describedby="([^"]+)"/g)) {
      for (const id of match[1].trim().split(/\s+/)) {
        assert.match(html, new RegExp(`id="${id}"`), `${page} aria-describedby should reference existing element: ${id}`);
      }
    }
  }

  assert.doesNotMatch(read("tools/clipboard.html"), /assets\/file-input\.js/, "clipboard tool should not load file input script");
});

test("shared tool header style is sticky", () => {
  const css = read("assets/common.css");

  assert.match(css, /\.tool-header\s*\{[\s\S]*position:\s*sticky;/);
  assert.match(css, /\.tool-header\s*\{[\s\S]*top:\s*0;/);
});

test("icon rendering stays encapsulated in the shared icon button stylesheet", () => {
  // 消费方（工具页 / 共享脚本 / 其它样式表）不应该自己写 mask、--icon-url 等
  // 图标渲染细节，只能通过 .icon-{name} class 使用图标。这条测试守住封装边界。
  const filesToCheck = [
    "assets/common.css",
    "assets/icons.css",
    "assets/clear-button.js",
    "assets/file-input.js",
    "assets/home-link.js",
    "assets/theme-toggle.js",
    "assets/tool-header.js",
    "index.html",
    ...toolPages,
  ];

  const forbidden = [
    { pattern: /\b(?:-webkit-)?mask(?:-image|-mode|-size|-position|-repeat)?\s*:/, label: "mask 相关 CSS 属性" },
    { pattern: /--icon-url\b/, label: "--icon-url 变量" },
    { pattern: /var\(--icon-(?:home|computer|sun|moon|trash|close)\)/, label: "var(--icon-X) 直接引用" },
  ];

  for (const file of filesToCheck) {
    const content = read(file);
    for (const { pattern, label } of forbidden) {
      assert.doesNotMatch(
        content,
        pattern,
        `${file} 不应该包含 ${label}——图标渲染细节应只在 assets/icon-button.css 内`
      );
    }
  }
});

test("shared icon definitions live in the icon stylesheet", () => {
  const commonCss = read("assets/common.css");
  const iconCss = read("assets/icons.css");
  const iconButtonCss = read("assets/icon-button.css");
  const iconPage = read("tools/icons.html");

  assert.match(commonCss, /@import url\("\.\/icons\.css"\);/);
  assert.match(commonCss, /@import url\("\.\/icon-button\.css"\);/);
  assert.doesNotMatch(commonCss, /--icon-(?:home|computer|sun|moon|trash|close):\s*url\(/);

  for (const icon of ["home", "computer", "sun", "moon", "trash", "close"]) {
    assert.match(iconCss, new RegExp(`--icon-${icon}:\\s*url\\(`));
    assert.match(iconButtonCss, new RegExp(`mask-image:\\s*var\\(--icon-${icon}\\)`));
    assert.match(iconPage, new RegExp(`icon-${icon}`));
  }
});

test("favicon config covers every page and is loaded by every page", () => {
  const scriptPath = "assets/favicons.js";
  assert.ok(existsSync(path.join(root, scriptPath)), `${scriptPath} should exist`);

  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read(scriptPath), sandbox);
  const MAP = sandbox.window.Favicons && sandbox.window.Favicons.MAP;
  assert.ok(MAP && typeof MAP === "object", "favicons.js should expose Favicons.MAP");

  for (const page of pages) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(MAP, page),
      `favicons.js should declare a favicon for ${page}`
    );
    assert.ok(MAP[page], `${page} favicon should be a non-empty string`);
  }

  for (const page of Object.keys(MAP)) {
    assert.ok(pages.includes(page), `favicons.js declares unknown page ${page}`);
  }

  for (const page of pages) {
    const html = read(page);
    const expectedSrc = page === "index.html" ? "assets/favicons.js" : "../assets/favicons.js";
    assert.match(
      html,
      new RegExp(`<script src="${expectedSrc.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"></script>`),
      `${page} should load the shared favicon config script`
    );
    assert.doesNotMatch(
      html,
      /<link[^>]+rel="icon"/,
      `${page} should not hardcode a favicon link; let favicons.js inject it`
    );
  }
});

test("home page entry icons match each page's favicon config", () => {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(read("assets/favicons.js"), sandbox);
  const MAP = sandbox.window.Favicons.MAP;

  const html = read("index.html");

  for (const page of toolPages) {
    const cardPattern = new RegExp(
      `<a[^>]*class="card"[^>]*href="${page.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"[\\s\\S]*?<div class="icon">([^<]+)</div>`
    );
    const match = html.match(cardPattern);
    assert.ok(match, `index.html should have a card linking to ${page} with an icon`);
    assert.equal(
      match[1].trim(),
      MAP[page],
      `index.html card for ${page} should use the favicon declared in favicons.js (${MAP[page]})`
    );
  }

  for (const page of hiddenPages) {
    const linkPattern = new RegExp(
      `<a[^>]*class="[^"]*\\bicon-link\\b[^"]*"[^>]*href="${page.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}"[^>]*>([^<]+)</a>`
    );
    const match = html.match(linkPattern);
    assert.ok(match, `index.html footer should link to ${page} with an icon`);
    assert.equal(
      match[1].trim(),
      MAP[page],
      `index.html footer entry for ${page} should use the favicon declared in favicons.js (${MAP[page]})`
    );
  }
});

test("shared file drop zone style exists", () => {
  const css = read("assets/common.css");

  assert.match(css, /\.file-drop-zone\s*\{/);
  assert.match(css, /\.file-drop-zone:hover/);
  assert.match(css, /\.file-drop-zone:focus-visible/);
  assert.match(css, /\.file-drop-zone\.dragging\s*\{/);
  assert.match(css, /\.file-drop-icon\s*\{/);
  assert.doesNotMatch(css, /\.file-drop-zone \.file-choose-button\s*\{/);
  assert.match(css, /\.file-drop-actions\s*\{/);
  assert.doesNotMatch(css, /\.file-drop-action\.primary\s*\{/);
  assert.match(css, /\.file-drop-status\s*\{/);
  assert.match(css, /\.file-input-picker-menu\s*\{/);
  assert.match(css, /\.file-input-picker-menu\[hidden\]\s*\{/);
});

test("shared file input script supports drop zone triggers", () => {
  const script = read("assets/file-input.js");

  assert.match(script, /options\.triggerElement/);
  assert.match(script, /setAttribute\('tabindex', '0'\)/);
  assert.match(script, /setAttribute\('role', 'button'\)/);
  assert.match(script, /addEventListener\('keydown'/);
  assert.doesNotMatch(script, /const button = toElement\(options\.button\)/);
  assert.doesNotMatch(script, /options\.(?:emptyText|acceptedText|rejectedText|onStatus)/);
  assert.doesNotMatch(script, /\bsetStatus,\s*\n/);
});

test("shared file input script supports directory picking", () => {
  const script = read("assets/file-input.js");

  assert.match(script, /webkitdirectory/);
  assert.match(script, /createDirectoryInput/);
  assert.match(script, /createDropActions/);
  assert.match(script, /createFileEntry/);
  assert.match(script, /buildFileTree/);
  assert.match(script, /fileEntries:\s*entries/);
  assert.match(script, /allFileEntries:\s*incomingEntries/);
  assert.match(script, /acceptFiles\(directoryInput\.files, 'folder'\)/);
  assert.match(script, /textContent = '选择文件夹'/);
  assert.match(script, /textContent = '添加文件夹'/);
});
