import express from "express";

import { createNewSession } from "./func/createNewSession.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { getLatestSessionId } from "./func/getLatestSessionId.js";
import { oldAskOdysseus } from "./func/oldAskOdysseus.js";

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    status: "OK",
    message: "Odysseus API çalışıyor",
    endpoints: {
      oldChat: "POST /ask  { mode: 'old', question: '...' }",
      newChat: "POST /ask  { mode: 'new', question: '...' }"
    }
  });
});

app.post("/ask", async (req, res) => {
  try {
    const { mode = "old", question } = req.body;

    if (!question) {
      return res.status(400).json({
        error: "question alanı zorunlu"
      });
    }

    if (mode !== "new" && mode !== "old") {
      return res.status(400).json({
        error: "mode sadece 'new' veya 'old' olabilir"
      });
    }

    let sessionId;
    let answer;

    if (mode === "new") {
      sessionId = await createNewSession();

      answer = await newAskOdysseus(sessionId, question);

      await saveCurrentSession(sessionId);

      console.log("New Session ID:", sessionId);
    } else {
      sessionId = await getLatestSessionId();

      answer = await oldAskOdysseus(sessionId, question);

      console.log("Old Session ID:", sessionId);
    }

    console.log("Question:", question);
    console.log("Answer:", answer);

    res.json({
      success: true,
      mode,
      sessionId,
      question,
      answer
    });

  } catch (err) {
    console.error("API Error:", err);

    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("Server running on port 3000");
});
app.listen(3000);
