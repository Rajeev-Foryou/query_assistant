const pdf = require("pdf-parse");
const { v4: uuidv4 } = require("uuid");
const { getEmbedding, generateAnswer } = require("../clients/geminiClient");
const { getPineconeIndex } = require("../clients/pineconeClient");

// Simple text chunking function
function chunkText(text, chunkSize = 500, overlap = 100) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = i + chunkSize;
    chunks.push(text.slice(i, end));
    i += chunkSize - overlap;
  }
  return chunks;
}

const uploadDocument = async (req, res) => {
  console.log("Upload request received");

  if (!req.file) {
    console.error("No file in request");
    return res.status(400).json({ error: "No file uploaded" });
  }

  console.log(
    `Processing file: ${req.file.originalname}, type: ${req.file.mimetype}, size: ${req.file.size} bytes`
  );

  try {
    let text;
    if (req.file.mimetype === "application/pdf") {
      const fileBuffer = req.file.buffer;

      try {
        console.log("Parsing PDF file...");
        const data = await pdf(fileBuffer);
        text = data.text;
      } catch (error) {
        console.error("Error parsing PDF:", error);
        return res.status(400).json({
          error:
            "The uploaded PDF appears to be corrupted or invalid. Please try a different file.",
        });
      }
    } else {
      try {
        text = req.file.buffer.toString("utf-8");
      } catch (error) {
        console.error("Error parsing file:", error);
        return res.status(400).json({
          error: "Error parsing file",
          details: error.message,
        });
      }
    }

    console.log("Successfully extracted text from file.");
    const chunks = chunkText(text);
    console.log(`Text split into ${chunks.length} chunks.`);
    const pineconeIndex = await getPineconeIndex();
    const namespace = uuidv4();

    console.log("Generating embeddings in parallel...");
    const embeddingPromises = chunks.map((chunk) => getEmbedding(chunk));
    const embeddings = await Promise.all(embeddingPromises);
    console.log("Embeddings generated successfully.");

    const vectors = chunks.map((chunk, i) => ({
      id: `${req.file.originalname}-chunk-${i}`,
      values: embeddings[i],
      metadata: { text: chunk },
    }));

    console.log("Upserting vectors to Pinecone in a single batch...");
    await pineconeIndex.namespace(namespace).upsert(vectors);
    console.log(
      `${vectors.length} vectors successfully upserted to namespace ${namespace}.`
    );

    console.log("Document processing complete.");
    res.status(200).json({
      message: "Document uploaded and processed successfully.",
      namespace: namespace,
    });
  } catch (error) {
    console.error("Error processing document:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to process document",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

const queryDocuments = async (req, res) => {
  try {
    const { question } = req.body;
    const pineconeIndex = await getPineconeIndex();
    const questionEmbedding = await getEmbedding(question);

    console.log("Fetching all namespaces to query...");
    const indexStats = await pineconeIndex.describeIndexStats();
    const namespaces = Object.keys(indexStats.namespaces);

    if (namespaces.length === 0) {
      return res.status(200).json({
        answer:
          "No documents have been uploaded yet. Please upload a document first.",
        sources: [],
      });
    }

    let allMatches = [];
    for (const namespace of namespaces) {
      const queryResponse = await pineconeIndex.namespace(namespace).query({
        vector: questionEmbedding,
        topK: 12,
        includeMetadata: true,
      });
      allMatches.push(...queryResponse.matches);
    }

    allMatches.sort((a, b) => b.score - a.score);
    const scoreThreshold = 0.3;
    let relevantMatches = allMatches.filter(
      (match) => match.score > scoreThreshold
    );

    if (relevantMatches.length === 0 && allMatches.length > 0) {
      relevantMatches = allMatches.slice(0, 5);
    }

    if (relevantMatches.length === 0) {
      return res.status(200).json({
        answer:
          "I couldn't find any relevant information in the uploaded documents to answer your question.",
        sources: [],
      });
    }

    const context = relevantMatches
      .map((match) => match.metadata.text)
      .join("\n\n");

    const sources = relevantMatches.map((match) => ({
      fileName: match.id.substring(0, match.id.lastIndexOf("-chunk-")),
      text: match.metadata.text,
      score: match.score,
    }));

    const summaryKeywords = [
      "summary",
      "summarize",
      "overview",
      "main idea",
      "main points",
      "gist",
    ];
    const isSummaryRequest = summaryKeywords.some((k) =>
      question.toLowerCase().includes(k)
    );

    let answer;
    if (isSummaryRequest) {
      answer = await generateAnswer(
        "Summarize the following content:",
        context
      );
    } else {
      answer = await generateAnswer(question, context);
    }

    res.status(200).json({ answer, sources });
  } catch (error) {
    console.error("Error querying documents:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to query documents",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ✅ Export both functions properly
module.exports = { uploadDocument, queryDocuments };
