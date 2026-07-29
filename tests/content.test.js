const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadContentScriptWithoutFavicon({
  rules,
  location = { hostname: "127.0.0.1", host: "127.0.0.1" }
} = {}) {
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
      storage: {
        onChanged: { addListener() {} },
        sync: { get: async () => ({ rules }) }
      }
    },
    document,
    history: { pushState() {}, replaceState() {} },
    location,
    MutationObserver: class { observe() {} },
    Node: { ELEMENT_NODE: 1 },
    setTimeout() {},
    window: { addEventListener() {} }
  };
  const source = fs.readFileSync(path.join(__dirname, "..", "content.js"), "utf8");
  vm.runInNewContext(`${source}\nglobalThis.__faviconTestApi = { applyRule, start };`, context);
  return {
    appendedLinks,
    applyRule: context.__faviconTestApi.applyRule,
    start: context.__faviconTestApi.start
  };
}

test("creates a labeled favicon when a matched page declares no favicon", async () => {
  const { appendedLinks, applyRule } = loadContentScriptWithoutFavicon();

  const applied = await applyRule({ name: "LOC", color: "#ff9700" });

  assert.equal(applied, true);
  assert.equal(appendedLinks.length, 1);
  assert.equal(appendedLinks[0].getAttribute("rel"), "icon");
  assert.match(appendedLinks[0].href, /^data:image\/svg\+xml;charset=utf-8,/);
});

test("port-specific rule outranks an earlier hostname rule", async () => {
  const rules = [
    {
      id: "local",
      name: "LOC",
      color: "#ff9700",
      matches: "localhost,127.0.0.1,[::1]",
      enabled: true
    },
    {
      id: "tunnel",
      name: "TUN",
      color: "#2563eb",
      matches: "127.0.0.1:8077,127.0.0.1:8078,127.0.0.1:14792",
      enabled: true
    }
  ];
  const { appendedLinks, start } = loadContentScriptWithoutFavicon({
    rules,
    location: { hostname: "127.0.0.1", host: "127.0.0.1:8077" }
  });

  await start();

  assert.equal(appendedLinks.length, 1);
  assert.match(decodeURIComponent(appendedLinks[0].href), /<strong>TUN<\/strong>/);
});

test("hostname rule handles an unlisted port", async () => {
  const rules = [
    {
      id: "local",
      name: "LOC",
      color: "#ff9700",
      matches: "localhost,127.0.0.1,[::1]",
      enabled: true
    },
    {
      id: "tunnel",
      name: "TUN",
      color: "#2563eb",
      matches: "127.0.0.1:8077,127.0.0.1:8078,127.0.0.1:14792",
      enabled: true
    }
  ];
  const { appendedLinks, start } = loadContentScriptWithoutFavicon({
    rules,
    location: { hostname: "127.0.0.1", host: "127.0.0.1:9999" }
  });

  await start();

  assert.match(decodeURIComponent(appendedLinks[0].href), /<strong>LOC<\/strong>/);
});

test("bracketed IPv6 without a trailing port remains a hostname rule", async () => {
  const rules = [
    {
      id: "local",
      name: "LOC",
      color: "#ff9700",
      matches: "[::1]",
      enabled: true
    }
  ];
  const { appendedLinks, start } = loadContentScriptWithoutFavicon({
    rules,
    location: { hostname: "[::1]", host: "[::1]:3000" }
  });

  await start();

  assert.match(decodeURIComponent(appendedLinks[0].href), /<strong>LOC<\/strong>/);
});
