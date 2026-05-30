import pino from "pino";
import { env } from "./env.js";

const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true },
    },
  }),
});

export default logger;
