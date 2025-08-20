const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { uploadDocument, queryDocuments } = require('./src/controllers/ragController');
const { initializePinecone } = require('./src/clients/pineconeClient');

const app = express();
const port = process.env.PORT || 3000;

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const allowedOrigins = [process.env.FRONTEND_URL, 'http://localhost:5173'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  }
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.post('/upload', upload.single('file'), uploadDocument);
app.post('/query', queryDocuments);

async function startServer() {
  try {
    await initializePinecone();
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
}

startServer();
