const DEFAULT_RULES = [
  { id: "local", name: "LOC", color: "#ff9700", matches: "localhost,127.0.0.1,[::1]", enabled: true },
  { id: "dev", name: "DEV", color: "#9c27b0", matches: "dev*", enabled: true },
  { id: "oa", name: "OA", color: "#009b8e", matches: "oa*", enabled: true }
];
const APPLIED = "data-local-favicon-labeler";

function matches(hostname, patterns) {
  return patterns.split(/[,\n]+/).some((item) => {
    const pattern = item.trim();
    if (!pattern) return false;
    return new RegExp(`^${pattern.replace(/[.+?^${}()|[\\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`, "i").test(hostname);
  });
}

function toDataUrl(url) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type: "favicon-to-data-url", url }, resolve));
}

function makeSvg(original, rule) {
  const label = String(rule.name || "LOC").toUpperCase().slice(0, 5);
  const color = rule.color || "#ff9700";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><foreignObject width="100%" height="100%"><body xmlns="http://www.w3.org/1999/xhtml"><style>html,body{width:100%;height:100%;margin:0}img{display:block;width:100%;height:100%;object-fit:contain}strong{position:absolute;bottom:0;left:50%;transform:translateX(-50%);box-sizing:border-box;max-width:100%;height:16px;line-height:16px;padding:0 2px;overflow:hidden;border-radius:2px;background:${color};color:#fff;font:700 12px/16px Arial,sans-serif;text-align:center}</style><img src="${original}"/><strong>${label}</strong></body></foreignObject></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function applyRule(rule) {
  const link = [...document.querySelectorAll('link[rel~="icon"]')]
    .filter((item) => item.getAttribute(APPLIED) !== "true")
    .at(-1);
  if (link?.href) {
    const original = await toDataUrl(link.href);
    if (!original) return false;
    link.href = makeSvg(original, rule);
    link.setAttribute(APPLIED, "true");
    link.setAttribute("data-local-original-favicon", original);
    return true;
  }
  const appliedLink = document.querySelector(`link[${APPLIED}="true"]`);
  const cachedOriginal = appliedLink?.getAttribute("data-local-original-favicon");
  if (!appliedLink || !cachedOriginal) return false;
  appliedLink.href = makeSvg(cachedOriginal, rule);
  return true;
}

function restoreOriginal() {
  const link = document.querySelector(`link[${APPLIED}="true"]`);
  const original = link?.getAttribute("data-local-original-favicon");
  if (!link || !original) return;
  link.href = original;
  link.removeAttribute(APPLIED);
  link.removeAttribute("data-local-original-favicon");
}

async function start() {
  const { rules } = await chrome.storage.sync.get("rules");
  const rule = (Array.isArray(rules) ? rules : DEFAULT_RULES)
    .find((item) => item.enabled !== false && matches(location.hostname, item.matches));
  if (!rule) {
    restoreOriginal();
    return;
  }
  for (const delay of [0, 150, 500, 1200, 2500]) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    if (await applyRule(rule)) return;
  }
}

if (document.readyState === "complete") start();
else window.addEventListener("load", start, { once: true });
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "sync") start();
});
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "refresh-favicon") scheduleRouteCheck();
});

let routeUpdateQueued = false;
function scheduleRouteCheck() {
  if (routeUpdateQueued) return;
  routeUpdateQueued = true;
  [50, 200, 600, 1200].forEach((delay, index) => setTimeout(() => {
    start();
    if (index === 3) routeUpdateQueued = false;
  }, delay));
}
const watchHead = new MutationObserver((mutations) => {
  const hasNewFavicon = mutations.some((mutation) => {
    if (mutation.type === "attributes") {
      const link = mutation.target;
      if (!link.matches?.('link[rel~="icon"]') || link.href.startsWith("data:image/svg+xml;charset=utf-8,")) return false;
      link.removeAttribute(APPLIED);
      link.removeAttribute("data-local-original-favicon");
      return true;
    }
    return [...mutation.addedNodes].some((node) => node.nodeType === Node.ELEMENT_NODE && node.matches?.('link[rel~="icon"]'));
  });
  if (hasNewFavicon) scheduleRouteCheck();
});
watchHead.observe(document.head || document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });

for (const method of ["pushState", "replaceState"]) {
  const original = history[method];
  history[method] = function (...args) {
    const result = original.apply(this, args);
    scheduleRouteCheck();
    return result;
  };
}
window.addEventListener("popstate", scheduleRouteCheck);
document.addEventListener("click", () => scheduleRouteCheck(), true);
