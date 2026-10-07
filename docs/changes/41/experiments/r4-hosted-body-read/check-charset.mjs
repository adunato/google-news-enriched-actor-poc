import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { domContentType } from "./dom-content-type.mjs";

const windows1252 = Buffer.from("<html><body>caf\xe9</body></html>", "binary");
const html = new JSDOM(windows1252, {
  contentType: domContentType('text/html; charset="windows-1252"'),
});
assert.equal(html.window.document.body.textContent, "café");
html.window.close();

const xhtml = new JSDOM(
  Buffer.from('<html xmlns="http://www.w3.org/1999/xhtml"><body>ok</body></html>'),
  {
    contentType: domContentType("application/xhtml+xml; charset=UTF-8"),
  },
);
assert.equal(xhtml.window.document.body.textContent, "ok");
xhtml.window.close();

assert.equal(domContentType("text/html"), "text/html");
assert.equal(domContentType("text/html; charset=unsupported-codec"), "text/html");
