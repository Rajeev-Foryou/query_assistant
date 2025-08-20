const pdf = require('pdf-parse');
const { v4: uuidv4 } = require('uuid');
const { getEmbedding, generateAnswer } = require('../clients/geminiClient');
const { getPineconeIndex } = require('../clients/pineconeClient');

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
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    let text;
    if (req.file.mimetype === 'application/pdf') {
      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;

      try {
        const data = await pdf(fileBuffer);
        text = data.text;
      } catch (error) {
        console.error('Error parsing PDF:', error);
        // Send a more specific error message for corrupted PDFs
        return res.status(400).json({ error: 'The uploaded PDF appears to be corrupted or invalid. Please try a different file.' });
      }
    } else {
      try {
        text = req.file.buffer.toString('utf-8');
      } catch (error) {
        console.error('Error parsing file:', error);
        return res.status(500).send('Error parsing file.');
      }
    }

    console.log('Successfully extracted text from file.');
    const chunks = chunkText(text);
    console.log(`Text split into ${chunks.length} chunks.`);
    const pineconeIndex = await getPineconeIndex();
    const namespace = uuidv4();

    console.log('Generating embeddings in parallel...');
    const embeddingPromises = chunks.map(chunk => getEmbedding(chunk));
    const embeddings = await Promise.all(embeddingPromises);
    console.log('Embeddings generated successfully.');

    const vectors = chunks.map((chunk, i) => ({
      id: `${req.file.originalname}-chunk-${i}`,
      values: embeddings[i],
      metadata: { text: chunk },
    }));

    console.log('Upserting vectors to Pinecone in a single batch...');
    await pineconeIndex.namespace(namespace).upsert(vectors);
    console.log(`${vectors.length} vectors successfully upserted to namespace ${namespace}.`);

    console.log('Document processing complete.');
    res.status(200).json({ 
      message: 'Document uploaded and processed successfully.',
      namespace: namespace 
    });
  } catch (error) {
    console.error('Error processing upload:', error);
    res.status(500).send('Error processing document.');
  }
};

const queryDocuments = async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'A question is required.' });
  }

  try {
    const pineconeIndex = await getPineconeIndex();
    const questionEmbedding = await getEmbedding(question);

    console.log('Fetching all namespaces to query...');
    const indexStats = await pineconeIndex.describeIndexStats();
    const namespaces = Object.keys(indexStats.namespaces);

    if (namespaces.length === 0) {
        return res.status(200).json({ answer: "No documents have been uploaded yet. Please upload a document first.", sources: [] });
    }

    console.log(`Querying across ${namespaces.length} namespaces...`);

    let allMatches = [];
    for (const namespace of namespaces) {
        const queryResponse = await pineconeIndex.namespace(namespace).query({
            vector: questionEmbedding,
            topK: 5,
            includeMetadata: true,
        });
        allMatches.push(...queryResponse.matches);
    }

    // Sort all matches by score in descending order
    allMatches.sort((a, b) => b.score - a.score);

    // Create a mock queryResponse object
    const queryResponse = { matches: allMatches.slice(0, 5) };

    if (queryResponse.matches.length === 0) {
      return res.status(200).json({ answer: "I couldn't find any relevant information in the document to answer your question.", sources: [] });
    }

    const relevantMatches = queryResponse.matches.filter(match => match.score > 0.5);

    if (relevantMatches.length === 0) {
      return res.status(200).json({ answer: "I couldn't find any relevant information in the uploaded documents to answer your question.", sources: [] });
    }

    const context = relevantMatches.map((match) => match.metadata.text).join('\n\n');
    
    const sources = relevantMatches.map(match => ({
      fileName: match.id.substring(0, match.id.lastIndexOf('-chunk-')),
      text: match.metadata.text,
      score: match.score
    }));

    const answer = await generateAnswer(question, context);

    res.status(200).json({ answer, sources });
  } catch (error) {
    console.error('Error querying documents:', error);
    res.status(500).send('Error querying documents.');
  }
};

module.exports = { uploadDocument, queryDocuments };
