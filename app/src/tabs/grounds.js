import { esc } from "../data.js";

// Step 2: a list of what is where. Step 5 puts these on the grounds map.
const TYPE = {
  food: { label: "Food", glyph: "food" },
  vendor: { label: "Vendors", glyph: "vendor" },
  restroom: { label: "Restrooms", glyph: "restroom" },
  aid: { label: "First aid", glyph: "aid" },
};

const glyphs = {
  food: '<svg width="18" height="18" viewBox="-8 -9 16 18" aria-hidden="true"><path d="M-3 -7 v14 M-5.5 -7 v4 a2.5 2.5 0 0 0 5 0 v-4 M4 -7 c2.5 2 2.5 6.5 0 8 v6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
  vendor: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l2-5h14l2 5"/><path d="M3 9h18v11H3z"/><path d="M9 20v-6h6v6"/></svg>',
  aid: '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="#fff"/></svg>',
};

function icon(a) {
  const inner = a.type === "restroom" ? (a.variant === "women" ? "W" : "M") : glyphs[a.type] ?? "";
  return `<span class="amenity-icon amenity-icon--${esc(a.type)}" aria-hidden="true">${inner}</span>`;
}

export const grounds = {
  id: "grounds",
  label: "Grounds",
  title: "Gurdwara grounds",
  render(content) {
    const list = content.grounds.amenities;
    const groups = Object.keys(TYPE)
      .map((type) => {
        const items = list.filter((a) => a.type === type);
        if (!items.length) return "";
        return `
          <h2 class="group-title">${TYPE[type].label}</h2>
          <ul class="amenities card">
            ${items
              .map(
                (a) => `
              <li class="amenity">
                ${icon(a)}
                <div>
                  <div class="amenity-name">${esc(a.name)}</div>
                  <div class="amenity-where">${esc(a.where)}</div>
                  ${a.note ? `<div class="amenity-note">${esc(a.note)}</div>` : ""}
                </div>
              </li>`,
              )
              .join("")}
          </ul>`;
      })
      .join("");

    return `
      <header class="page-head">
        <div>
          <h1>Gurdwara grounds</h1>
          <div class="sub">${esc(content.venues.gurdwara.name)}</div>
        </div>
      </header>
      ${groups}
    `;
  },
};
