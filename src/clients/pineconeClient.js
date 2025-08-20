const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const indexName = 'query-assistant';

let pineconeIndex;

async function initializePinecone() {
  try {
    const indexList = await pinecone.listIndexes();
    if (!indexList.indexes.some((index) => index.name === indexName)) {
      console.log(`Creating index: ${indexName}. This may take a moment...`);
      await pinecone.createIndex({
        name: indexName,
        dimension: 768, // Gemini embedding dimension
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });
      console.log(`Index '${indexName}' created successfully.`);
    } else {
      console.log(`Successfully connected to existing index '${indexName}'.`);
    }
    pineconeIndex = pinecone.index(indexName);
  } catch (error) {
    console.error('Error initializing Pinecone:', error);
    throw error;
  }
}

function getPineconeIndex() {
  if (!pineconeIndex) {
    throw new Error('Pinecone index has not been initialized. Please call initializePinecone() first.');
  }
  return pineconeIndex;
}

module.exports = { initializePinecone, getPineconeIndex };
