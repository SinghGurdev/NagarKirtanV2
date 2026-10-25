import { resolve } from "path";
import { defineConfig } from "vite";

// Three pages: the Nagar Kirtan app, plus the sevadar parking scanner and
// its admin page (served as /parking.html and /parking-admin.html).
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        parking: resolve(__dirname, "parking.html"),
        parkingAdmin: resolve(__dirname, "parking-admin.html"),
      },
    },
  },
});
