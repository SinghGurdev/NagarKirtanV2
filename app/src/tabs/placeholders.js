// Tabs that are filled in by later build steps. Each shows its header and
// a short note of what is coming, so the app is navigable from day one.

const placeholder = ({ title, sub = "", live = false, body, step }) => `
  <header class="page-head">
    <div>
      <h1>${title}</h1>
      ${sub ? `<div class="sub">${sub}</div>` : ""}
    </div>
    ${live ? '<span class="badge-live">LIVE</span>' : ""}
  </header>
  <section class="card placeholder">
    <div class="eyebrow">Coming in build step ${step}</div>
    <p>${body}</p>
  </section>
`;

export const schedule = {
  id: "schedule",
  label: "Schedule",
  title: "Schedule",
  render: () =>
    placeholder({
      title: "Schedule",
      sub: "Updated — sec ago",
      live: true,
      step: 10,
      body: "The 7 events in order. The 4 parade events shift their times as the parade moves.",
    }),
};

export const parade = {
  id: "parade",
  label: "Parade",
  title: "Parade",
  render: () =>
    placeholder({
      title: "Parade",
      sub: "Updated — sec ago",
      live: true,
      step: 9,
      body: "Live map of the route with the lead position, the current street or next turn, and restroom, water and food icons.",
    }),
};

export const parking = {
  id: "parking",
  label: "Parking",
  title: "Parking",
  render: () =>
    placeholder({
      title: "Parking",
      step: 4,
      body: "Map of the lot, parking details, and Get directions (Apple Maps on iPhone, Google Maps elsewhere).",
    }),
};

export const grounds = {
  id: "grounds",
  label: "Grounds",
  title: "Gurdwara grounds",
  render: () =>
    placeholder({
      title: "Gurdwara grounds",
      step: 5,
      body: "Map of the grounds with food, vendor stalls, men's and women's restrooms and first aid.",
    }),
};
