const DEFAULT_RULES = [
  { id: "local", name: "LOC", color: "#ff9700", matches: "localhost,127.0.0.1,[::1]", enabled: true },
  { id: "dev", name: "DEV", color: "#9c27b0", matches: "dev*", enabled: true },
  { id: "oa", name: "OA", color: "#009b8e", matches: "oa*", enabled: true }
];

chrome.runtime.onInstalled.addListener(async () => {
  const { rules } = await chrome.storage.sync.get("rules");
  if (!Array.isArray(rules)) await chrome.storage.sync.set({ rules: DEFAULT_RULES });
});

chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

function refreshFavicon(tabId, frameId) {
  if (frameId !== 0) return;
  chrome.tabs.sendMessage(tabId, { type: "refresh-favicon" }).catch(() => {});
}

chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, frameId }) => {
  refreshFavicon(tabId, frameId);
});
chrome.webNavigation.onCompleted.addListener(({ tabId, frameId }) => {
  refreshFavicon(tabId, frameId);
});

async function imageToDataUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Unable to load favicon: ${response.status}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "favicon-to-data-url") return;
  imageToDataUrl(message.url).then(sendResponse).catch(() => sendResponse(null));
  return true;
});
