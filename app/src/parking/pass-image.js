// Builds a parking pass image for sharing. The background is the committee's
// own pass design (pass-template.jpg) with the plate number, QR code and
// pass number cleared; this file writes those three in for each pass. For a
// category other than Sevadar, pass-template-nocat.jpg (no "SEVADAR" line)
// is used and the category is written in.
import QRCode from "qrcode";
import templateUrl from "./pass-template.jpg";
import templateNoCatUrl from "./pass-template-nocat.jpg";

const W = 1024;
const H = 1536;

// Positions measured on the original 1024 x 1536 pass.
const PLATE = { cx: 360, baseline: 1305, maxWidth: 400, size: 136, color: "#090d18" };
const QR = { x: 718, y: 1080, size: 160 };
const PASS_NO = { cx: 797, baseline: 1311, size: 42, color: "rgb(250, 212, 150)" };
const CATEGORY = { cx: 516, baseline: 940, maxWidth: 740, size: 96 };

const images = new Map();
function loadImage(src) {
  if (!images.has(src)) {
    images.set(
      src,
      new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Couldn't load the pass template."));
        img.src = src;
      }),
    );
  }
  return images.get(src);
}

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('700 136px "Oswald"'),
      document.fonts.load('800 42px "Montserrat"'),
      document.fonts.load('900 96px "Merriweather"'),
    ]);
  } catch {
    /* system fonts as a fallback */
  }
}

/** Draws text centred on cx, squeezed sideways (not shrunk) if too wide. */
function fitText(ctx, text, cx, baseline, maxWidth) {
  const w = ctx.measureText(text).width;
  const sx = w > maxWidth ? maxWidth / w : 1;
  ctx.save();
  ctx.translate(cx, baseline);
  ctx.scale(sx, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** Returns a canvas with the pass drawn on it. */
export async function drawPass({ id, plate, category }) {
  const cat = String(category || "").trim();
  const isSevadar = cat.toLowerCase() === "sevadar";
  const [bg] = await Promise.all([loadImage(isSevadar ? templateUrl : templateNoCatUrl), fontsReady()]);

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d");
  ctx.drawImage(bg, 0, 0, W, H);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  // Plate number, in the condensed plate lettering.
  ctx.fillStyle = PLATE.color;
  ctx.font = `700 ${PLATE.size}px "Oswald", "Arial Narrow", sans-serif`;
  fitText(ctx, String(plate || "").toUpperCase(), PLATE.cx, PLATE.baseline, PLATE.maxWidth);

  // QR code (holds just the Pass ID) in the white box.
  const qr = document.createElement("canvas");
  await QRCode.toCanvas(qr, String(id), { width: QR.size, margin: 0, errorCorrectionLevel: "M" });
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(qr, QR.x, QR.y, QR.size, QR.size);
  ctx.imageSmoothingEnabled = true;

  // Pass number under the QR code.
  ctx.fillStyle = PASS_NO.color;
  ctx.font = `800 ${PASS_NO.size}px "Montserrat", "Figtree", sans-serif`;
  fitText(ctx, `PASS #${id}`, PASS_NO.cx, PASS_NO.baseline, 280);

  // Category line (the template already says SEVADAR).
  if (!isSevadar && cat) {
    const g = ctx.createLinearGradient(0, CATEGORY.baseline - 75, 0, CATEGORY.baseline);
    g.addColorStop(0, "#ffb347");
    g.addColorStop(1, "#f29100");
    ctx.fillStyle = g;
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowOffsetY = 3;
    ctx.shadowBlur = 4;
    ctx.font = `900 ${CATEGORY.size}px "Merriweather", Georgia, serif`;
    fitText(ctx, cat.toUpperCase(), CATEGORY.cx, CATEGORY.baseline, CATEGORY.maxWidth);
  }
  return c;
}

/** Draws the pass and returns { file, url } (JPEG File + object URL). */
export async function passFile(pass) {
  const canvas = await drawPass(pass);
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
  const file = new File([blob], `parking-pass-${pass.id}.jpg`, { type: "image/jpeg" });
  return { file, url: URL.createObjectURL(blob) };
}
