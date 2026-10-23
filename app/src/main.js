import "./styles/tokens.css";
import "./styles/app.css";
import { icons } from "./icons.js";
import { loadContent } from "./data.js";
import { home } from "./tabs/home.js";
import { schedule } from "./tabs/schedule.js";
import { live } from "./tabs/live.js";
import { parking } from "./tabs/parking.js";
import { grounds } from "./tabs/grounds.js";

// Tab order matches the bottom tab bar in the designs.
const tabs = [home, schedule, live, parking, grounds];
const byId = Object.fromEntries(tabs.map((t) => [t.id, t]));

const view = document.getElementById("view");
const tabbar = document.getElementById("tabbar");
let content = null;
let cleanup = null; // set by a tab's mount() (e.g. to remove its map)

tabbar.innerHTML = tabs
  .map((t) => `<a class="tab" href="#/${t.id}" data-tab="${t.id}">${icons[t.id]()}${t.label}</a>`)
  .join("");

function currentTab() {
  const id = location.hash.replace(/^#\/?/, "");
  return byId[id] ?? home;
}

function show() {
  const tab = currentTab();
  for (const a of tabbar.querySelectorAll(".tab")) {
    if (a.dataset.tab === tab.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  document.title = tab.id === "home" ? "Nagar Kirtan" : `${tab.title} · Nagar Kirtan`;
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
    show();
  })
  .catch(() => {
    view.innerHTML = `
      <section class="card">
        <h2>Can't load the event details</h2>
        <p>Check your connection and pull down to refresh.</p>
      </section>`;
  });
