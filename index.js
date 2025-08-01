// Node.js PDF RAG System with Express API
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const pdfParse = require("pdf-parse");
const { z } = require("zod");
const {
  ChatGoogleGenerativeAI,
  GoogleGenerativeAIEmbeddings,
} = require("@langchain/google-genai");
const { PromptTemplate } = require("@langchain/core/prompts");
const { Document } = require("@langchain/core/documents");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { FaissStore } = require("@langchain/community/vectorstores/faiss");

dotenv.config();

// --- Initialize Express App ---
const app = express();
const port = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable parsing of JSON request bodies

// --- Reusable LLM and Embeddings Components ---
const llm = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash-latest",
  temperature: 0,
});
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "models/embedding-001",
});

// --- Global variable to hold the vector store ---
let vectorStore;

// --- Step 1: Load, Split, and Index Documents on Server Start ---
async function initializeVectorStore() {
  console.log(
    "1. Initializing vector store from documents in 'data' folder..."
  );
  const directoryPath = "data";
  const files = fs.readdirSync(directoryPath).filter((f) => f.endsWith(".pdf"));

  if (files.length === 0) {
    console.error(
      "❌ No PDF files found in the 'data' directory. The API cannot start without data."
    );
    process.exit(1); // Exit if no data is available
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1500,
    chunkOverlap: 200,
  });

  let allDocs = [];
  for (const file of files) {
    try {
      const filePath = path.join(directoryPath, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);

      if (!data.text || data.text.trim() === "") {
        console.warn(`⚠️ Warning: No text found in file: ${file}. Skipping.`);
        continue;
      }

      const doc = new Document({
        pageContent: data.text,
        metadata: { source: file },
      });
      allDocs.push(doc);
    } catch (error) {
      console.error(
        `❌ Failed to process file: ${file}. It may be corrupted. Error: ${error.message}`
      );
    }
  }

  if (allDocs.length === 0) {
    console.error(
      "❌ Error: No valid documents could be loaded after processing all files. The API cannot start."
    );
    process.exit(1);
  }

  const docChunks = await splitter.splitDocuments(allDocs);
  console.log(
    `✅ Successfully split documents into ${docChunks.length} chunks.`
  );

  // Create the vector store from the documents
  vectorStore = await FaissStore.fromDocuments(docChunks, embeddings);
  console.log("✅ Vector store initialized and ready.");
}

// --- Step 2: RAG Logic to Answer a Query ---
async function answerQuery(userQuery) {
  console.log(`\n--- Answering query: "${userQuery}" ---`);

  // Parse the query to get the topic
  console.log("A. Parsing user query...");
  const queryParsingSchema = z.object({
    topic: z
      .string()
      .describe("The main topic or keyword from the user's query."),
  });
  const prompt = PromptTemplate.fromTemplate(
    `Extract the key topic from the user's query.\nQuery: {query}`
  );
  const chain = prompt.pipe(llm.withStructuredOutput(queryParsingSchema));
  const structuredQuery = await chain.invoke({ query: userQuery });
  const topic = structuredQuery.topic || userQuery; // Fallback to full query
  console.log(`✅ Topic extracted: "${topic}"`);

  // Retrieve relevant documents
  console.log("B. Searching for relevant clauses...");
  const retriever = vectorStore.asRetriever(3);
  const relevantClauses = await retriever.getRelevantDocuments(topic);
  if (relevantClauses.length === 0) {
    throw new Error("Could not find any relevant clauses for the topic.");
  }

  // Generate the final response
  console.log("C. Generating final response...");
  const finalResponseSchema = z.object({
    answer: z.string().describe("The direct answer to the user's query."),
    reasoning: z
      .string()
      .describe("Explanation of how the answer was derived."),
    sourceClause: z
      .string()
      .describe("The most relevant text clause supporting the answer."),
  });
  const finalPrompt = PromptTemplate.fromTemplate(
    `Based ONLY on the following context clauses, answer the user's query about "{topic}".
    Provide a direct answer, reasoning, and cite the most relevant clause.
    Context Clauses:\n{context}\n\nQuery Topic: {topic}`
  );
  const finalChain = finalPrompt.pipe(
    llm.withStructuredOutput(finalResponseSchema)
  );
  const finalResult = await finalChain.invoke({
    topic: topic,
    context: relevantClauses.map((doc) => doc.pageContent).join("\n---\n"),
  });
  console.log("✅ Final response generated.");
  return finalResult;
}

// --- API Endpoint Definition ---
app.post("/ask", async (req, res) => {
  // Extract the 'query' from the request body
  const { query } = req.body;

  // Validate that a query was provided
  if (!query) {
    return res.status(400).json({ error: "Missing 'query' in request body" });
  }

  try {
    // Call the main RAG logic function
    const result = await answerQuery(query);
    // Send the successful result back to the client
    res.status(200).json(result);
  } catch (error) {
    // Handle any errors that occur during the process
    console.error("❌ An error occurred while processing the request:", error);
    res
      .status(500)
      .json({
        error: "An internal server error occurred.",
        details: error.message,
      });
  }
});

// --- Start the Server ---
// We first initialize the vector store, and only then start listening for requests.
initializeVectorStore()
  .then(() => {
    app.listen(port, () => {
      console.log(
        `\n🚀 Server is running and listening on http://localhost:${port}`
      );
      console.log(
        "✅ API is ready. Send POST requests to /ask to get answers."
      );
    });
  })
  .catch((error) => {
    console.error("❌ Failed to initialize the server:", error);
  });
