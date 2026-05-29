import express, { type Express } from "express";

const app: Express = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({ message: "Retry Engine API" });
});

export default app;
