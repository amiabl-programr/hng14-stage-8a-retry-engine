import app from "./app.js";
import logger from "./config/logger.js";
import { env } from "./config/env.js";
import { getDatabase, closeDatabase } from "./db/client.js";
import { createSchema } from "./db/schema.js";
import { startWorker, stopWorker } from "./worker/worker.js";

const database = getDatabase();
createSchema(database);
startWorker();

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});

function shutdown(signal: string): void {
  logger.info({ signal }, "Shutting down gracefully");
  stopWorker();
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
