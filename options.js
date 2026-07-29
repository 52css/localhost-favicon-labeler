const defaults = [
  { id: "local", name: "LOC", color: "#ff9700", matches: "localhost,127.0.0.1,[::1]", enabled: true },
  { id: "dev", name: "DEV", color: "#9c27b0", matches: "dev*", enabled: true },
  { id: "oa", name: "OA", color: "#009b8e", matches: "oa*", enabled: true }
];
const list = document.querySelector("#rules");
const template = document.querySelector("#rule-template");

function addRule(rule = { name: "ENV", color: "#2563eb", matches: "", enabled: true }) {
  const row = template.content.firstElementChild.cloneNode(true);
  row.querySelector(".enabled").checked = rule.enabled !== false;
  row.querySelector(".color").value = rule.color || "#2563eb";
  row.querySelector(".name").value = rule.name || "ENV";
  row.querySelector(".matches").value = rule.matches || "";
  row.querySelector(".delete").addEventListener("click", () => row.remove());
  row.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => preview(row)));
  list.appendChild(row); preview(row);
}
function preview(row) {
  const color = row.querySelector(".color").value;
  row.querySelector(".preview i").style.background = color;
  row.querySelector(".preview b").textContent = (row.querySelector(".name").value || "ENV").toUpperCase().slice(0, 5);
  row.classList.toggle("muted", !row.querySelector(".enabled").checked);
}
function serialize() { return [...list.children].map((row, index) => ({ id: crypto.randomUUID?.() || String(Date.now() + index), enabled: row.querySelector(".enabled").checked, color: row.querySelector(".color").value, name: row.querySelector(".name").value.trim() || "ENV", matches: row.querySelector(".matches").value.trim() })); }
async function init() { const { rules } = await chrome.storage.sync.get("rules"); (Array.isArray(rules) ? rules : defaults).forEach(addRule); }
document.querySelector("#add").addEventListener("click", () => addRule());
document.querySelector("#save").addEventListener("click", async () => { await chrome.storage.sync.set({ rules: serialize() }); const status = document.querySelector("#status"); status.textContent = "已保存，已打开页面会自动更新。"; setTimeout(() => status.textContent = "", 3500); });
init();
