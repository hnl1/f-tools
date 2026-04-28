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
    "tools/video-compare.html": ["id=\"grid\"", "id=\"sync-toggle\"", "id=\"sync-reset\"", "id=\"clear\"", "id=\"file-input\""],
    "tools/image-compare.html": ["id=\"drop-hint\"", "id=\"grid\"", "id=\"zoom-strip\"", "id=\"file-input\""],
    "tools/pdf-compare.html": ["id=\"drop-hint\"", "id=\"grid\"", "id=\"sync-mode\"", "id=\"file-input\"", "../vendor/pdfjs/pdf.min.js"],
    "tools/pdf-to-image.html": [
      "id=\"pdf-file\"",
      "id=\"drop-hint\"",
      "id=\"generate-all-btn\"",
      "id=\"download-all-btn\"",
      "id=\"pdf-list\"",
      "row.className = 'pdf-item'",
      "../vendor/pdfjs/pdf.min.js",
      "../vendor/jspdf/jspdf.umd.min.js",
    ],
  };

  for (const [page, snippets] of Object.entries(expectations)) {
    const html = read(page);
    for (const snippet of snippets) {
      assert.ok(html.includes(snippet), `${page} should include ${snippet}`);
    }
  }
});

test("tool pages link back to the home page", () => {
  for (const page of toolPages) {
    const html = read(page);
    assert.match(html, /<a href="\.\.\/index\.html" class="back-link" aria-label="主页" title="主页">\s*<\/a>/, `${page} should expose the top-left home link as an icon`);
    assert.doesNotMatch(html, /← 返回/, `${page} should not label the home link as back`);
  }
});

test("pdf to image hides advanced output options", () => {
  const html = read("tools/pdf-to-image.html");

  assert.match(html, /<title>PDF 转图片版<\/title>/, "pdf-to-image page title should use the shorter name");
  assert.match(html, /<h1>PDF 转图片版<\/h1>/, "pdf-to-image header should use the shorter name");
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

test("pdf to image supports multi PDF queue actions", () => {
  const html = read("tools/pdf-to-image.html");

  assert.match(html, /<input[^>]+id="pdf-file"[^>]+\bmultiple\b/, "pdf-to-image file input should accept multiple PDFs");
  assert.match(html, /\bmultiple:\s*true/, "pdf-to-image shared drop zone should accept multiple PDFs");
  assert.match(html, /id="generate-all-btn"/, "pdf-to-image should include global generate button");
  assert.match(html, /id="download-all-btn"/, "pdf-to-image should include global download-all button");
  assert.match(html, /id="add-pdf-btn"[^>]*hidden[^>]*>\s*添加 PDF\s*</, "pdf-to-image should move the add PDF action into the header after files are selected");
  assert.match(html, /async function generateAll\(\)/, "pdf-to-image should generate all items sequentially");
  assert.match(html, /for \(let index = 0; index < items\.length; index \+= 1\)/, "pdf-to-image should queue generation one PDF at a time");
  assert.match(html, /generateBtn\.textContent = '转换'/, "pdf-to-image should include per-item convert action");
  assert.match(html, /downloadBtn\.textContent = '下载'/, "pdf-to-image should include per-item download action");
  assert.match(html, /compareBtn\.textContent = '比较'/, "pdf-to-image should include per-item compare action");
  assert.match(html, /statusEl\.hidden = true/, "pdf-to-image should not show a pending status for new rows");
  assert.doesNotMatch(html, /statusEl\.textContent = '待转换'/, "pdf-to-image should not render the old pending status copy");
  assert.match(html, /window\.open\(item\.compareUrl,\s*'_blank',\s*'noopener'\)/, "pdf-to-image compare should open PDF compare in a new tab");
  assert.doesNotMatch(html, /window\.location\.href = item\.compareUrl/, "pdf-to-image compare should not replace the current page");
  assert.match(html, /downloadAllGenerated/, "pdf-to-image should include manual bulk download");
  assert.doesNotMatch(html, /downloadBlob\(blob,\s*outputName\)/, "pdf-to-image should not auto-download after generation");
  assert.match(html, /storeForCompare/, "pdf-to-image should store generated PDFs for compare");
  assert.match(html, /pdf-compare\.html\?from=pdf-to-image\.html&transfer=/, "pdf-to-image should link generated output into compare");
  assert.match(html, /-images\.pdf/, "pdf-to-image should use an images output filename suffix");
});

test("pdf to image keeps global controls in the sticky header", () => {
  const html = read("tools/pdf-to-image.html");
  const header = html.match(/<header[\s\S]*?<\/header>/)?.[0] ?? "";
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";

  assert.match(header, /class="[^"]*\bheader-toolbar\b[^"]*"/, "pdf-to-image should use a top header toolbar");
  assert.match(header, /id="generate-all-btn"/, "generate-all should live in the top header");
  assert.match(header, /id="download-all-btn"/, "download-all should live in the top header");
  assert.match(header, /id="generate-all-btn"[^>]*>\s*转换\s*</, "header convert button should use short label");
  assert.match(header, /id="download-all-btn"[^>]*>\s*下载\s*</, "header download button should use short label");
  assert.doesNotMatch(header, />\s*生成\s*</, "header should not show generate label");
  assert.doesNotMatch(header, />\s*全部生成\s*</, "header should not show full generate label");
  assert.doesNotMatch(header, />\s*全部下载\s*</, "header should not show full download label");

  assert.doesNotMatch(main, /id="scale"/, "main content should not contain the global scale control");
  assert.doesNotMatch(main, /id="generate-all-btn"/, "main content should not contain the global generate-all action");
  assert.doesNotMatch(main, /id="download-all-btn"/, "main content should not contain the global download-all action");
});

test("pdf to image uses the shared upload prompt", () => {
  const html = read("tools/pdf-to-image.html");
  const main = html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? "";

  assert.match(main, /class="[^"]*\bfile-drop-zone\b[^"]*"/, "pdf-to-image should use the shared input box style");
  assert.match(main, /class="[^"]*\bvisually-hidden-file\b[^"]*"/, "pdf-to-image should keep the native file input hidden");
  assert.match(main, /class="[^"]*\bfile-drop-icon\b[^"]*"/, "pdf-to-image should show the shared drop prompt icon");
  assert.match(main, /class="[^"]*\bfile-drop-title\b[^"]*"[^>]*>\s*拖入、粘贴或点击添加 PDF\s*</, "pdf-to-image should show the shared drop prompt title");
  assert.match(main, /class="[^"]*\bfile-drop-status\b[^"]*"[^>]*\bhidden\b/, "pdf-to-image should keep initial status hidden");
  assert.doesNotMatch(main, /class="[^"]*\bpanel-head\b[^"]*"/, "pdf-to-image should not show an input section heading");
  assert.doesNotMatch(main, /等待(?:添加|选择) PDF/, "pdf-to-image should not show initial waiting copy");
  assert.doesNotMatch(main, /把每页 PDF 渲染成图片/, "pdf-to-image should not show explanatory copy");
});

test("pdf compare can load generated transfer records", () => {
  const html = read("tools/pdf-compare.html");

  assert.match(html, /f-tools-pdf-transfer/, "pdf-compare should share the transfer database");
  assert.match(html, /loadTransferredPdfs\(\)/, "pdf-compare should try loading transferred PDFs");
  assert.match(html, /params\.get\('transfer'\)/, "pdf-compare should read the transfer id from the URL");
  assert.match(html, /new File\(/, "pdf-compare should rebuild transferred blobs as files");
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
    assert.match(html, /拖入、粘贴或点击添加/, `${page} should keep the drop zone title`);
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

  assert.match(css, /body\.tool-page > header\s*\{[\s\S]*position:\s*sticky;/);
  assert.match(css, /body\.tool-page > header\s*\{[\s\S]*top:\s*0;/);
});

test("shared file drop zone style exists", () => {
  const css = read("assets/common.css");

  assert.match(css, /\.file-drop-zone\s*\{/);
  assert.match(css, /\.file-drop-zone:hover/);
  assert.match(css, /\.file-drop-zone:focus-visible/);
  assert.match(css, /\.file-drop-zone\.dragging\s*\{/);
  assert.match(css, /\.file-drop-icon\s*\{/);
  assert.doesNotMatch(css, /\.file-drop-zone \.file-choose-button\s*\{/);
  assert.match(css, /\.file-drop-status\s*\{/);
});

test("shared file input script supports drop zone triggers", () => {
  const script = read("assets/file-input.js");

  assert.match(script, /options\.triggerElement/);
  assert.match(script, /setAttribute\('tabindex', '0'\)/);
  assert.match(script, /setAttribute\('role', 'button'\)/);
  assert.match(script, /addEventListener\('keydown'/);
  assert.doesNotMatch(script, /const button = toElement\(options\.button\)/);
});
