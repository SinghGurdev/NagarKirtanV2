import { icons } from "../icons.js";

export const home = {
  id: "home",
  label: "Home",
  title: "Nagar Kirtan",
  render() {
    return `
      <header class="page-head">
        <div>
          <h1>Nagar Kirtan</h1>
          <div class="sub">Gurdwara Gur Nanak Parkash · 4250 E Lincoln Ave, Fresno</div>
        </div>
      </header>

      <section class="card">
        <div class="eyebrow">[Event date]</div>
        <h2>Welcome</h2>
        <p>[Welcome message from the committee]</p>
      </section>

      <div class="quick-grid">
        <a class="quick-link" href="#/parade">${icons.parade(24)}Parade<span>Where it is now</span></a>
        <a class="quick-link" href="#/schedule">${icons.schedule(24)}Schedule<span>Times update live</span></a>
        <a class="quick-link" href="#/parking">${icons.parking(24)}Parking<span>Directions to the lot</span></a>
        <a class="quick-link" href="#/grounds">${icons.grounds(24)}Grounds<span>Food, restrooms, first aid</span></a>
      </div>
    `;
  },
};
