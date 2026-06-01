import express from "express";
const app = express();
let counter = {};

app.get("/unstable", (req, res) => {
    const id = req.query.id || "default";
    counter[id] = (counter[id] || 0) + 1;
    const attempt = counter[id];
    console.log(`Request #${attempt} for ${id}`);
    if (attempt <= 2) {
        res.status(500).json({ error: "transient failure", attempt });
    } else {
        res.status(200).json({ ok: true, attempt });
    }
});

app.listen(4000, () => console.log("Mock server on :4000"));