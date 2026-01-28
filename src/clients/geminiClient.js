const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const embeddingModel = genAI.getGenerativeModel({
  model: "models/gemini-embedding-001"
, // 768-dim
});

async function getEmbedding(text) {
  const result = await embeddingModel.embedContent(text);
  const vector = result.embedding.values;
  console.log("Embedding dimension (Gemini forced):", vector.length);
  return vector;
}

let generationModel;
try {
  generationModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
  });
} catch (e) {
  console.error("Error initializing generation model:", e);
}

async function generateAnswer(userQuery, context) {
  const prompt = `
    You are a helpful assistant. Answer the user's question based on the following context.
    If the context does not contain the answer, say that you don't know.

    Context:
    ${context}

    Question:
    ${userQuery}

    Answer:
  `;

  try {
    if (!generationModel) {
      throw new Error("No generation model initialized.");
    }
    const result = await generationModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating answer:", error);
    throw error;
  }
}

module.exports = { getEmbedding, generateAnswer };