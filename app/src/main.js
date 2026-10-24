import "./styles/tokens.css";
import "./styles/app.css";
import { icons } from "./icons.js";
import { loadContent } from "./data.js";
import { home } from "./tabs/home.js";
import { schedule } from "./tabs/schedule.js";
import { live } from "./tabs/live.js";
import { parking } from "./tabs/parking.js";
import { grounds } from "./tabs/grounds.js";
import { lead } from "./tabs/lead.js";

// Tab order matches the bottom tab bar in the designs.
const tabs = [home, schedule, live, parking, grounds];
// Pages reached only by link (not in the tab bar).
const hiddenPages = [lead];
const byId = Object.fromEntries([...tabs, ...hiddenPages].map((t) => [t.id, t]));

// The dev site (built with VITE_STAGE=dev) says so, so nobody mistakes it
// for the real one.
if (import.meta.env.VITE_STAGE === "dev") {
  const ribbon = document.createElement("div");
  ribbon.className = "stage-ribbon";
  ribbon.textContent = "Dev site · not live";
  document.body.prepend(ribbon);
  document.title = `[Dev] ${document.title}`;
}

const view = document.getElementById("view");
const tabbar = document.getElementById("tabbar");
let content = null;
let cleanup = null; // set by a tab's mount() (e.g. to remove its map)

// Tabs that can be switched off in content.json ("features"). Hidden until
// the content says otherwise, so they never flash in the tab bar.
const optional = { grounds: (c) => c?.features?.grounds === true };
const visible = () => tabs.filter((t) => !optional[t.id] || optional[t.id](content));

function renderTabbar() {
  const list = visible();
  tabbar.style.gridTemplateColumns = `repeat(${list.length}, minmax(0, 1fr))`;
  tabbar.innerHTML = list
    .map((t) => `<a class="tab" href="#/${t.id}" data-tab="${t.id}">${icons[t.id]()}${t.label}</a>`)
    .join("");
}
renderTabbar();

function currentTab() {
  const id = location.hash.replace(/^#\/?/, "");
  const tab = byId[id];
  return tab && (visible().includes(tab) || hiddenPages.includes(tab)) ? tab : home;
}

function show() {
  const tab = currentTab();
  for (const a of tabbar.querySelectorAll(".tab")) {
    if (a.dataset.tab === tab.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  const devTag = import.meta.env.VITE_STAGE === "dev" ? "[Dev] " : "";
  document.title = devTag + (tab.id === "home" ? "Nagar Kirtan" : `${tab.title} · Nagar Kirtan`);
  if (!content) return;
  cleanup?.();
  cleanup = null;
  view.innerHTML = tab.render(content);
  view.dataset.tab = tab.id;
  window.scrollTo(0, 0);
  if (tab.mount) cleanup = tab.mount(view, content) ?? null;
}

window.addEventListener("hashchange", show);
show();

loadContent()
  .then((c) => {
    content = c;
    renderTabbar();
    show();
  })
  .catch(() => {
    view.innerHTML = `
      <section class="card">
        <h2>Can't load the event details</h2>
        <p>Check your connection and pull down to refresh.</p>
      </section>`;
  });
