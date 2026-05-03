const app = require("./app");
const { port } = require("./config/env");
const { ensureBootstrapAdmin } = require("./bootstrap/ensureAdmin");

async function start() {
  try {
    await ensureBootstrapAdmin();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[bootstrap] ensureBootstrapAdmin failed:", e.message || e);
  }
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API started on http://localhost:${port}`);
  });
}

start();
