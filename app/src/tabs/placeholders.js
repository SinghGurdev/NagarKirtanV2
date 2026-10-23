// The Parade tab is filled in by build step 9 (live map). Until then it
// shows its header and what is coming.

export const parade = {
  id: "parade",
  label: "Parade",
  title: "Parade",
  render: () => `
    <header class="page-head">
      <div>
        <h1>Parade</h1>
        <div class="sub">Live on the day</div>
      </div>
      <span class="badge-live">LIVE</span>
    </header>
    <section class="card placeholder">
      <div class="eyebrow">Coming in build step 9</div>
      <p>Live map of the route with the lead position, the current street or next turn, and restroom, water and food icons.</p>
    </section>
  `,
};
