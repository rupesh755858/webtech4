/**
 * Entry point: creates the Express application and starts the HTTP server.
 * Run with:  npm start      (or npm run dev for auto-restart)
 */
import { createApp } from './src/app.js';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();

const server = app.listen(PORT, () => {
  console.log(`TalentBridge careers portal running at http://localhost:${PORT}`);
});

// Graceful shutdown so the port is released cleanly (Ctrl+C, Docker, PaaS).
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    console.log(`\n${signal} received - closing server.`);
    server.close(() => process.exit(0));
  });
}
