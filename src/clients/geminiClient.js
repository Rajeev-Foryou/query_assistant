const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
const generationModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

async function getEmbedding(text) {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error getting embedding:', error);
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
    const result = await generationModel.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error generating answer:', error);
    throw error;
  }
}

module.exports = { getEmbedding, generateAnswer };
