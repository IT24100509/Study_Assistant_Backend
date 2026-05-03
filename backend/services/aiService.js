// services/aiService.js
// ─────────────────────────────────────────────────────────────────────────────
// Centralised AI service layer using the existing Groq client configuration.
// Provides reusable AI functions for summarisation, quiz/flashcard generation,
// and weak-topic extraction.
// ─────────────────────────────────────────────────────────────────────────────

const groq = require("../config/groqClient");

const MODEL = "llama-3.3-70b-versatile";

/**
 * Summarise study content into bullet points.
 * @param {string} text — The raw study content
 * @returns {Promise<string>} — Bullet-point summary
 */
const summarise = async (text) => {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `Summarise this study content clearly in bullet points:\n\n${text}`,
      },
    ],
  });
  return res.choices[0].message.content;
};

/**
 * Generate multiple-choice quiz questions from study content.
 * @param {string} text — The raw study content
 * @param {number} count — Number of questions to generate
 * @returns {Promise<Array>} — Array of { question, options, correctAnswer, topic }
 */
const generateQuiz = async (text, count = 10) => {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `Generate ${count} multiple choice questions from this content.
Return ONLY a valid JSON array, no markdown, no explanation:
[{"question":"...","options":["A","B","C","D"],"correctAnswer":"A","topic":"..."}]

Content:\n\n${text}`,
      },
    ],
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in AI response");
  return JSON.parse(jsonMatch[0]);
};

/**
 * Generate flashcards from study content.
 * @param {string} text — The raw study content
 * @param {number} count — Number of flashcards to generate
 * @returns {Promise<Array>} — Array of { term, definition }
 */
const generateFlashcards = async (text, count = 15) => {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `Generate ${count} flashcards from this content.
Return ONLY a valid JSON array, no markdown, no explanation:
[{"term":"...","definition":"..."}]

Content:\n\n${text}`,
      },
    ],
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in AI response");
  return JSON.parse(jsonMatch[0]);
};

/**
 * Extract weak topic names from incorrectly answered quiz questions.
 * @param {Array} wrongAnswers — Array of { question, topic }
 * @returns {Promise<Array<string>>} — Array of weak topic names
 */
const extractWeakTopics = async (wrongAnswers) => {
  const res = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `From these wrong quiz answers, extract the weak topic names.
Return ONLY a JSON array of strings, no markdown:
["topic1","topic2"]

Wrong answers:\n\n${JSON.stringify(wrongAnswers)}`,
      },
    ],
  });

  const raw = res.choices[0].message.content.replace(/```json|```/g, "").trim();
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array found in AI response");
  return JSON.parse(jsonMatch[0]);
};

module.exports = { summarise, generateQuiz, generateFlashcards, extractWeakTopics };
