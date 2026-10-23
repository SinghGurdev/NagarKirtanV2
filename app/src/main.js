import "./styles/tokens.css";
import "./styles/app.css";
import { icons } from "./icons.js";
import { home } from "./tabs/home.js";
import { schedule, parade, parking, grounds } from "./tabs/placeholders.js";

// Tab order matches the bottom tab bar in the designs.
const tabs = [home, schedule, parade, parking, grounds];
const byId = Object.fromEntries(tabs.map((t) => [t.id, t]));

const view = document.getElementById("view");
const tabbar = document.getElementById("tabbar");

tabbar.innerHTML = tabs
  .map((t) => `<a class="tab" href="#/${t.id}" data-tab="${t.id}">${icons[t.id]()}${t.label}</a>`)
  .join("");

function currentTab() {
  const id = location.hash.replace(/^#\/?/, "");
  return byId[id] ?? home;
}

function show() {
  const tab = currentTab();
  view.innerHTML = tab.render();
  document.title = tab.id === "home" ? "Nagar Kirtan" : `${tab.title} · Nagar Kirtan`;
  for (const a of tabbar.querySelectorAll(".tab")) {
    if (a.dataset.tab === tab.id) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", show);
show();
