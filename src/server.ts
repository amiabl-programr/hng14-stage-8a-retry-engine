import app from "./app.js";
import logger from "./config/logger.js";
import { env } from "./config/env.js";

const PORT = env.PORT;

app.listen(PORT, () => {
  logger.info({ port: PORT }, `Server running on http://localhost:${PORT}`);
});
