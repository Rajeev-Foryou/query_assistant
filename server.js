require("dotenv").config();

console.log("Starting server.js...");

// Reminder: Available Google Generative AI models will be logged from geminiClient.js at startup.

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const {
  uploadDocument,
  queryDocuments,
} = require("./src/controllers/ragController");
const { initializePinecone } = require("./src/clients/pineconeClient");

const app = express();
const port = process.env.PORT || 3000;

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Allow only production frontend origin
const allowedOrigins = [
  process.env.FRONTEND_URL, // e.g., "https://yourdomain.com"
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Check if the origin is in the allowed list or is a subdomain of the allowed origins
    const isAllowed = allowedOrigins.some(
      (allowedOrigin) =>
        origin === allowedOrigin ||
        origin.startsWith(allowedOrigin.replace("https://", "http://")) ||
        origin.startsWith(allowedOrigin.replace("http://", "https://")),
    );

    if (isAllowed) {
      return callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      const msg =
        "The CORS policy for this site does not allow access from the specified Origin.";
      return callback(new Error(msg), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong!",
  });
});

// Serve static frontend files in production
if (process.env.NODE_ENV === "production") {
  const path = require("path");
  app.use(express.static(path.join(__dirname, "frontend/geminiUi/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "frontend/geminiUi/dist", "index.html"));
  });
}

// Routes
app.post("/upload", upload.single("file"), uploadDocument);
app.post("/query", queryDocuments);

async function startServer() {
  try {
    console.log("Initializing Pinecone...");
    await initializePinecone();
    console.log("Pinecone initialized. Starting Express server...");
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
      console.log(
        "Check your terminal for the list of available Google Generative AI models (logged from geminiClient.js).",
      );
    });
  } catch (error) {
    console.error("Failed to start the server:", error);
    process.exit(1);
  }
}

startServer();
