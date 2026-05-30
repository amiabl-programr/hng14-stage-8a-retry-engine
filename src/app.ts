import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import logger from "./config/logger.js";
import router from "./routes/request.routes.js";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ message: "Retry Engine API" });
});

app.use(router);

export default app;
