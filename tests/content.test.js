const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadContentScriptWithoutFavicon() {
  const appendedLinks = [];
  const head = {
    appendChild(link) {
      appendedLinks.push(link);
      return link;
    }
  };
  const document = {
    readyState: "loading",
    head,
    documentElement: {},
    addEventListener() {},
    createElement() {
      const attributes = new Map();
      return {
        href: "",
        getAttribute(name) { return attributes.get(name) ?? null; },
        setAttribute(name, value) { attributes.set(name, value); }
      };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
  const context = {
    chrome: {
      runtime: { onMessage: { addListener() {} }, sendMessage() {} },
      storage: { onChanged: { addListener() {} }, sync: { get: async () => ({}) } }
    },
    document,
    history: { pushState() {}, replaceState() {} },
    location: { hostname: "127.0.0.1" },
    MutationObserver: class { observe() {} },
    Node: { ELEMENT_NODE: 1 },
    setTimeout() {},
    window: { addEventListener() {} }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  vm.runInNewContext(`${source}\nglobalThis.__faviconTestApi = { applyRule };`, context);
  return { appendedLinks, applyRule: context.__faviconTestApi.applyRule };
}

test("creates a labeled favicon when a matched page declares no favicon", async () => {
  const { appendedLinks, applyRule } = loadContentScriptWithoutFavicon();

  const applied = await applyRule({ name: "LOC", color: "#ff9700" });

  assert.equal(applied, true);
  assert.equal(appendedLinks.length, 1);
  assert.equal(appendedLinks[0].getAttribute("rel"), "icon");
  assert.match(appendedLinks[0].href, /^data:image\/svg\+xml;charset=utf-8,/);
});
