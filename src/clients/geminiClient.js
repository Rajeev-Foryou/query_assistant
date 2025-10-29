const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const embeddingModel = genAI.getGenerativeModel({
  model: "text-embedding-004",
});
let generationModel;
try {
  generationModel = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-lite",
  });
} catch (e) {
  console.error("Error initializing generation model:", e);
}

async function getEmbedding(text) {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error("Error getting embedding:", error);
    throw error;
  }
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
    // Try to list available models for debugging
    try {
      const models = await genAI.listModels();
      console.error("Available models:", models);
    } catch (listErr) {
      console.error("Error listing available models:", listErr);
    }
    throw error;
  }
}

module.exports = { getEmbedding, generateAnswer };
