import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import logger from "./config/logger.js";

const app: Express = express();

app.use(pinoHttp({ logger }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ message: "Retry Engine API" });
});

export default app;
