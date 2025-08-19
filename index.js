// Node.js PDF RAG System with Express API
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const pdfParse = require("pdf-parse");
const multer = require("multer");
const upload = multer({ dest: 'uploads/' });
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
// 💡 FIX: Removed the problematic app.options line.
// The cors() middleware automatically handles preflight OPTIONS requests.
app.use(cors());
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
let vectorStore = null;
let isProcessing = false;

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// --- Utility function to process PDF and add to vector store ---
async function processPDF(filePath, filename) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);

    if (!data.text || data.text.trim() === "") {
      throw new Error("No text content found in PDF");
    }

    const doc = new Document({
      pageContent: data.text,
      metadata: { source: filename },
    });

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    const docChunks = await splitter.splitDocuments([doc]);
    
    if (vectorStore) {
      // Add to existing vector store
      await vectorStore.addDocuments(docChunks);
    } else {
      // Create new vector store
      vectorStore = await FaissStore.fromDocuments(docChunks, embeddings);
    }
    
    return true;
  } catch (error) {
    console.error(`Error processing ${filename}:`, error);
    return false;
  }
}

// --- Initialize vector store with existing PDFs ---
async function initializeVectorStore() {
  if (isProcessing) return;
  isProcessing = true;
  
  console.log("1. Initializing vector store from documents in 'data' folder...");
  
  try {
    const files = fs.readdirSync(dataDir).filter((f) => 
      (f.endsWith(".pdf") || f.endsWith(".txt")) && 
      f !== "_greetings.txt" // Exclude the greetings file from document processing
    );
    
    if (files.length === 0) {
      console.log("ℹ️ No document files found in the 'data' directory. Waiting for uploads...");
      return;
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
    });

    let allDocs = [];
    for (const file of files) {
      try {
        const filePath = path.join(dataDir, file);
        let text;
        
        if (file.endsWith('.txt')) {
          // For text files, read directly
          text = fs.readFileSync(filePath, 'utf-8');
        } else {
          // For PDFs, use pdf-parse
          const dataBuffer = fs.readFileSync(filePath);
          const data = await pdfParse(dataBuffer);
          text = data.text;
        }

        if (!text || text.trim() === "") {
          console.warn(`⚠️ Warning: No text found in file: ${file}. Skipping.`);
          continue;
        }

        const doc = new Document({
          pageContent: text,
          metadata: { 
            source: file,
            type: file.endsWith('.txt') ? 'text' : 'pdf'
          },
        });
        allDocs.push(doc);
      } catch (error) {
        console.error(
          `❌ Failed to process file: ${file}. It may be corrupted. Error: ${error.message}`
        );
      }
    }

    if (allDocs.length === 0) {
      console.log("ℹ️ No valid PDFs with text content found in the 'data' directory.");
      return;
    }

    const docChunks = await splitter.splitDocuments(allDocs);
    console.log(`✅ Successfully split documents into ${docChunks.length} chunks.`);

    // Create the vector store from the documents
    vectorStore = await FaissStore.fromDocuments(docChunks, embeddings);
    console.log("✅ Vector store initialized and ready.");
  } catch (error) {
    console.error("❌ Error initializing vector store:", error);
    throw error;
  } finally {
    isProcessing = false;
  }
}

// --- Step 2: RAG Logic to Answer a Query ---
async function answerQuery(userQuery, useAllDocuments = true) {
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
  
  // If useAllDocuments is true, we'll let the retriever search across all documents
  // Otherwise, it will use the existing vector store which already contains all documents
  const retriever = vectorStore.asRetriever(5); // Increased from 3 to 5 to get more context
  const relevantClauses = await retriever.getRelevantDocuments(topic);
  
  if (relevantClauses.length === 0) {
    console.log("No relevant clauses found, trying a more general search...");
    // Try a more general search if no results found
    const generalRetriever = vectorStore.asRetriever(5);
    const generalClauses = await generalRetriever.getRelevantDocuments(userQuery);
    
    if (generalClauses.length === 0) {
      throw new Error("Could not find any relevant information in the knowledge base.");
    }
    return { answer: "I found some general information that might help: " + generalClauses[0].pageContent.substring(0, 500) + "..." };
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

// --- File Upload Endpoint ---
app.post("/upload", upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    const tempPath = req.file.path;
    const targetPath = path.join(dataDir, req.file.originalname);
    
    // Move file from temp to data directory
    fs.renameSync(tempPath, targetPath);
    
    // Process the PDF
    const success = await processPDF(targetPath, req.file.originalname);
    
    if (!success) {
      fs.unlinkSync(targetPath); // Clean up if processing fails
      return res.status(400).json({ error: "Failed to process file" });
    }
    
    res.json({ 
      file: {
        filename: req.file.originalname,
        path: targetPath
      }
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Error processing file" });
  }
});

// --- API Endpoint Definition ---
app.post("/api/ask", async (req, res) => {
  if (!vectorStore) {
    return res.status(400).json({ error: "No documents found in the knowledge base. Please upload some documents first." });
  }
  
  // Extract the query and context from the request body
  const { question, context = {} } = req.body;
  const query = question || '';
  const useAllDocuments = context.useAllDocuments !== false; // Default to true if not specified
  
  if (!query) {
    return res.status(400).json({ error: "Query is required" });
  }

  // Validate that a query was provided
  if (!query) {
    return res.status(400).json({ error: "Missing 'query' in request body" });
  }

  try {
    // Call the main RAG logic function
    const result = await answerQuery(query, useAllDocuments);
    // Send the successful result back to the client
    res.status(200).json({
      answer: result.answer || "I couldn't find an answer to your question.",
      source: result.sourceClause ? result.sourceClause.substring(0, 200) + '...' : '',
      success: true
    });
  } catch (error) {
    // Handle any errors that occur during the process
    console.error("❌ An error occurred while processing the request:", error);
    res.status(500).json({
      error: "An internal server error occurred.",
      details: error.message
    });
  }
});

// --- Start the Server ---
// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  // Initialize vector store in the background
  initializeVectorStore().catch(console.error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
