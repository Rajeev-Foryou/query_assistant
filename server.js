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

// Allow both production and development origins
const allowedOrigins = [
  process.env.FRONTEND_URL, 
  'https://query-assistant.netlify.app/',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean); // Remove any undefined values

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if the origin is in the allowed list or is a subdomain of the allowed origins
    const isAllowed = allowedOrigins.some(allowedOrigin => 
      origin === allowedOrigin || 
      origin.startsWith(allowedOrigin.replace('https://', 'http://')) ||
      origin.startsWith(allowedOrigin.replace('http://', 'https://'))
    );
    
    if (isAllowed) {
      return callback(null, true);
    } else {
      console.log('Blocked by CORS:', origin);
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
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
