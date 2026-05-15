import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import jsdom from "jsdom";

const { JSDOM } = jsdom;

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const toolPages = [
  "tools/clipboard.html",
  "tools/video-compare.html",
  "tools/image-compare.html",
  "tools/pdf-compare.html",
  "tools/pdf-to-image.html",
  "tools/file-meta.html",
];

export const hiddenPages = ["tools/icons.html"];

export const pages = ["index.html", ...toolPages, ...hiddenPages];

export const fileInputPages = [
  "tools/video-compare.html",
  "tools/image-compare.html",
  "tools/pdf-compare.html",
  "tools/pdf-to-image.html",
  "tools/file-meta.html",
];

export function abs(relativePath) {
  return path.join(root, relativePath);
}

export function exists(relativePath) {
  return existsSync(abs(relativePath));
}

export function read(relativePath) {
  return readFileSync(abs(relativePath), "utf8");
}

export async function loadDom(relativePath) {
  const filePath = abs(relativePath);
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
