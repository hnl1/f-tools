import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function loadPage(relativePath) {
  const filePath = path.join(root, relativePath);
  const dom = await JSDOM.fromFile(filePath, {
    url: pathToFileURL(filePath).href,
    resources: "usable",
    pretendToBeVisual: true,
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", () => resolve(), { once: true });
  });
  return dom;
}

test("pdf-to-image: drop-zone and pdf-list are direct children of <main>", async () => {
  const dom = await loadPage("tools/pdf-to-image.html");
  const { document } = dom.window;

  const main = document.querySelector("main");
  const dropHint = document.getElementById("drop-hint");
  const pdfList = document.getElementById("pdf-list");

  assert.ok(main, "main element should exist");
  assert.ok(dropHint, "#drop-hint should exist");
  assert.ok(pdfList, "#pdf-list should exist");
  assert.equal(dropHint.parentElement, main, "#drop-hint should be a direct child of <main>");
  assert.equal(pdfList.parentElement, main, "#pdf-list should be a direct child of <main>");

  assert.equal(
    document.querySelector(".panel.upload-panel"),
    null,
    "no .panel.upload-panel wrapper should remain"
  );
  assert.equal(
    document.querySelector("main .form"),
    null,
    "no .form wrapper should remain inside <main>"
  );

  dom.window.close();
});

test("pdf-to-image: empty pdf-list with [hidden] resolves to display: none", async () => {
  const dom = await loadPage("tools/pdf-to-image.html");
  const { document, getComputedStyle } = dom.window;

  const pdfList = document.getElementById("pdf-list");
  assert.ok(pdfList.hasAttribute("hidden"), "#pdf-list should start with the hidden attribute");
  assert.equal(
    getComputedStyle(pdfList).display,
    "none",
    "#pdf-list[hidden] must compute to display:none even though .pdf-list sets display:flex"
  );

  pdfList.removeAttribute("hidden");
  assert.equal(
    getComputedStyle(pdfList).display,
    "flex",
    "#pdf-list without [hidden] should fall back to display:flex"
  );

  dom.window.close();
});

test("pdf-to-image: drop-zone uses symmetric 40px margins, no hardcoded viewport math", async () => {
  const dom = await loadPage("tools/pdf-to-image.html");
  const { document, getComputedStyle } = dom.window;

  const dropHint = document.getElementById("drop-hint");
  const cs = getComputedStyle(dropHint);

  assert.equal(cs.marginTop, "40px");
  assert.equal(cs.marginBottom, "40px");
  assert.equal(cs.marginLeft, "40px");
  assert.equal(cs.marginRight, "40px");

  assert.doesNotMatch(
    cs.minHeight,
    /100vh|144/,
    "min-height should not be the brittle hardcoded calc(100vh - 144px)"
  );

  dom.window.close();
});
