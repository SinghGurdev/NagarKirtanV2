// Reads QR codes from the phone's back camera. Uses the browser's own
// BarcodeDetector where it exists (Android Chrome) and jsQR elsewhere (iPhone).
import jsQR from "jsqr";

export function createReader(video, onCode) {
  let stream = null;
  let running = false;
  let timer = 0;
  let detector = null;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  async function getDetector() {
    if (detector !== null) return detector;
    detector = false;
    try {
      if ("BarcodeDetector" in window) {
        const formats = await window.BarcodeDetector.getSupportedFormats();
        if (formats.includes("qr_code")) detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      }
    } catch {
      detector = false;
    }
    return detector;
  }

  async function tick() {
    if (!running) return;
    try {
      if (video.readyState >= 2 && video.videoWidth) {
        let text = null;
        const det = await getDetector();
        if (det) {
          const codes = await det.detect(video);
          if (codes.length) text = codes[0].rawValue;
        } else {
          const scale = Math.min(1, 640 / video.videoWidth);
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const res = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (res && res.data) text = res.data;
        }
        if (text && running) onCode(text);
      }
    } catch {
      /* keep trying */
    }
    if (running) timer = setTimeout(tick, 120);
  }

  return {
    async start() {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser can't use the camera. Open the page in Safari or Chrome.");
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      if (!running) {
        running = true;
        tick();
      }
    },
    pause() {
      running = false;
      clearTimeout(timer);
    },
    resume() {
      if (stream && !running) {
        running = true;
        tick();
      }
    },
    stop() {
      running = false;
      clearTimeout(timer);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      stream = null;
    },
    get active() {
      return !!stream;
    },
  };
}
