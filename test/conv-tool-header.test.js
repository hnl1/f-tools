import assert from "node:assert/strict";
import test from "node:test";
import { read, toolPages } from "./_helpers.js";

test("工具页都使用共享 ToolHeader 与 home-link", () => {
  for (const page of toolPages) {
    const html = read(page);
    assert.match(
      html,
      /<script src="\.\.\/assets\/home-link\.js"><\/script>/,
      `${page} should load shared home link`
    );
    assert.match(html, /ToolHeader\.mount\(/, `${page} should mount the shared tool header`);
  }
});

test(".tool-header 是 sticky", () => {
  const css = read("assets/common.css");
  assert.match(css, /\.tool-header\s*\{[\s\S]*position:\s*sticky;/);
  assert.match(css, /\.tool-header\s*\{[\s\S]*top:\s*0;/);
});
