// Draws a sevadar parking pass (the same look as the printed/sent passes:
// navy with gold lettering, plate, QR and pass number) to a PNG for sharing.
import QRCode from "qrcode";

const W = 1024;
const H = 1536;
const NAVY = "#0b1233"; // tokens: dark --bg
const NAVY_2 = "#14247a"; // --primary-deep
const GOLD = "#ffc21a"; // --gold
const KESRI = "#f29100"; // --kesri
const CREAM = "#fff6ea"; // --bg
const INK = "#161b33"; // --text
const MAROON = "#7a1418"; // --maroon

const DISPLAY = '"Baloo Paaji 2", "Figtree", sans-serif';
const BODY = '"Figtree", sans-serif';

const EVENT = {
  place: "GURUDWARA GUR NANAK PARKASH",
  city: "FRESNO, CA",
  title: ["NAGAR", "KIRTAN", "2026"],
  date: "OCTOBER 25, 2026",
};

function goldFill(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, "#ffd75a");
  g.addColorStop(0.55, GOLD);
  g.addColorStop(1, KESRI);
  return g;
}

function fitFont(ctx, text, weight, family, maxSize, maxWidth) {
  let size = maxSize;
  do {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size > 20);
  return size;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`800 120px ${DISPLAY}`),
      document.fonts.load(`700 40px ${DISPLAY}`),
      document.fonts.load(`700 40px ${BODY}`),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

/** Returns a canvas with the pass drawn on it. */
export async function drawPass({ id, plate, category }) {
  await fontsReady();
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Ground with a soft blue glow in the middle.
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 520, 40, W / 2, 520, 700);
  glow.addColorStop(0, "rgba(30, 58, 156, 0.55)");
  glow.addColorStop(1, "rgba(11, 18, 51, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Double gold frame with corner diamonds.
  ctx.strokeStyle = KESRI;
  ctx.lineWidth = 6;
  ctx.strokeRect(22, 22, W - 44, H - 44);
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);
  for (const [x, y] of [[40, 40], [W - 40, 40], [40, H - 40], [W - 40, H - 40]]) diamond(ctx, x, y, 16, GOLD);

  // Gurdwara name.
  ctx.fillStyle = GOLD;
  fitFont(ctx, EVENT.place, 800, DISPLAY, 56, W - 160);
  ctx.fillText(EVENT.place, W / 2, 140);
  ctx.font = `800 46px ${DISPLAY}`;
  ctx.fillText(EVENT.city, W / 2, 196);

  // Title cartouche.
  roundRect(ctx, 110, 240, W - 220, 420, 90);
  ctx.fillStyle = NAVY_2;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = KESRI;
  ctx.stroke();
  ctx.fillStyle = goldFill(ctx, 270, 640);
  ctx.font = `800 132px ${DISPLAY}`;
  ctx.fillText(EVENT.title[0], W / 2, 380);
  ctx.fillText(EVENT.title[1], W / 2, 500);
  ctx.font = `800 120px ${DISPLAY}`;
  ctx.fillText(EVENT.title[2], W / 2, 618);

  // Date pill.
  roundRect(ctx, 170, 720, W - 340, 96, 48);
  ctx.fillStyle = goldFill(ctx, 720, 816);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `800 54px ${DISPLAY}`;
  ctx.fillText(EVENT.date, W / 2, 788);
  diamond(ctx, 222, 768, 10, INK);
  diamond(ctx, W - 222, 768, 10, INK);

  // "<CATEGORY> PARKING PASS"
  const cat = String(category || "").trim().toUpperCase();
  ctx.fillStyle = goldFill(ctx, 860, 1060);
  if (cat) {
    fitFont(ctx, cat, 800, DISPLAY, 104, W - 160);
    ctx.fillText(cat, W / 2, 940);
  }
  fitFont(ctx, "PARKING PASS", 800, DISPLAY, 104, W - 160);
  ctx.fillText("PARKING PASS", W / 2, cat ? 1048 : 990);

  // Plate (left) and QR (right).
  const plateX = 90;
  const plateY = 1130;
  const plateW = 520;
  const plateH = 250;
  roundRect(ctx, plateX, plateY, plateW, plateH, 26);
  ctx.fillStyle = goldFill(ctx, plateY, plateY + plateH);
  ctx.fill();
  roundRect(ctx, plateX + 12, plateY + 12, plateW - 24, plateH - 24, 18);
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(22, 27, 51, 0.35)";
  ctx.stroke();
  ctx.fillStyle = MAROON;
  ctx.font = `700 40px ${BODY}`;
  ctx.fillText("CALIFORNIA", plateX + plateW / 2, plateY + 72);
  ctx.fillStyle = INK;
  const plateText = String(plate || "").toUpperCase();
  fitFont(ctx, plateText, 800, BODY, 132, plateW - 60);
  ctx.fillText(plateText, plateX + plateW / 2, plateY + 205);

  const qrSize = 250;
  const qrX = W - 90 - qrSize;
  const qrY = 1110;
  ctx.fillStyle = CREAM;
  roundRect(ctx, qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 10);
  ctx.fill();
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, String(id), { width: qrSize, margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  ctx.drawImage(qr, qrX, qrY, qrSize, qrSize);

  ctx.fillStyle = GOLD;
  ctx.font = `700 44px ${BODY}`;
  ctx.fillText(`PASS #${id}`, qrX + qrSize / 2, qrY + qrSize + 70);

  // Bottom rule with a diamond.
  ctx.strokeStyle = KESRI;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 300, H - 90);
  ctx.lineTo(W / 2 - 30, H - 90);
  ctx.moveTo(W / 2 + 30, H - 90);
  ctx.lineTo(W / 2 + 300, H - 90);
  ctx.stroke();
  diamond(ctx, W / 2, H - 90, 14, GOLD);

  return c;
}

/** Draws the pass and returns { file, url } (PNG File + object URL). */
export async function passFile(pass) {
  const canvas = await drawPass(pass);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
  const file = new File([blob], `parking-pass-${pass.id}.png`, { type: "image/png" });
  return { file, url: URL.createObjectURL(blob) };
}
