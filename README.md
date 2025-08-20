# AI-Powered Document Chatbot (RAG)

This is a full-stack Retrieval-Augmented Generation (RAG) application that allows users to upload documents (PDFs and TXT files) and ask natural language questions about their content. The application leverages the Google Gemini API for embeddings and answer generation, and Pinecone for efficient vector storage and search.

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React, Vite, CSS
- **AI & Vector DB**:
  - Google Gemini API (for embeddings and generation)
  - Pinecone (for serverless vector storage and search)
- **Key Libraries**: `multer` (file uploads), `pdf-parse` (PDF text extraction), `dotenv` (environment variables), `cors`

## Features

- **File Upload**: Supports PDF and TXT file uploads.
- **Dynamic Indexing**: Each uploaded document is processed and stored in its own unique namespace within Pinecone.
- **Global Querying**: Ask questions and get answers from the context of *all* uploaded documents.
- **Optimized Performance**: Embeddings are generated in parallel and upserted to Pinecone in a single batch for fast processing.
- **Interactive UI**: A clean, responsive chat interface built with React.

## Workflow

1.  **File Upload**: The user selects a file (PDF or TXT) in the React frontend and clicks "Upload & Chat".
2.  **In-Memory Processing**: The Node.js backend receives the file and holds it in memory. It does *not* save the file to disk.
3.  **Text Extraction**: The server extracts the text content from the file.
4.  **Chunking**: The extracted text is split into smaller, manageable chunks.
5.  **Embedding & Upserting**: 
    - The system generates a unique namespace (UUID) for the document.
    - It creates embeddings for all text chunks in parallel using the Google Gemini API.
    - All generated vectors are upserted to the Pinecone index in a single batch, tagged with their unique namespace.
6.  **Querying**: 
    - The user asks a question in the chat interface.
    - The frontend sends the question to the backend's `/query` endpoint.
    - The backend embeds the question and queries the *entire* Pinecone index (across all namespaces) to find the most semantically relevant text chunks.
7.  **Generation**: The retrieved chunks are passed to the Gemini API along with the original question to generate a final, context-aware answer.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- An active Google AI Studio API key.
- An active Pinecone account and API key.

### Installation & Setup

1.  **Clone the repository:**
    ```bash
    git clone <your-repo-url>
    cd <your-repo-directory>
    ```

2.  **Install backend dependencies:**
    ```bash
    npm install
    ```

3.  **Install frontend dependencies:**
    ```bash
    cd frontend/geminiUi
    npm install
    ```

4.  **Create an environment file:**
    - In the root directory of the project, create a file named `.env`.
    - Add your API keys to this file:
      ```
      GEMINI_API_KEY=your_google_api_key
      PINECONE_API_KEY=your_pinecone_api_key
      ```

### Running the Application

1.  **Start the backend server:**
    - From the root directory:
    ```bash
    npm start
    ```
    The server will be running on `http://localhost:3000`.

2.  **Start the frontend development server:**
    - In a new terminal, navigate to the frontend directory:
    ```bash
    cd frontend/geminiUi
    npm run dev
    ```
    The application will be accessible at `http://localhost:5173` (or another port if 5173 is busy).
Answer Generation

Gemini generates a structured JSON response containing:
Answer: Direct answer to the query.
Reasoning: Explanation of how the answer was derived.
Source Clause: The most relevant supporting text from the PDF.
Result Display

The frontend displays the answer, reasoning, and source clause in a clean, user-friendly format.
How It Works
Semantic Search: Uses embeddings and FAISS to find the most relevant PDF content for any question.
AI Reasoning: Gemini answers questions based only on retrieved context, ensuring accuracy and traceability.
Structured Output: Responses are always in a predictable JSON format for easy UI rendering.
Getting Started
Place your PDFs in the data folder.
Start the backend (node index.js) and frontend (npm run dev in geminiUi).
Ask questions about your documents and get instant, explainable answers!
Why This Matters
This project demonstrates how to combine LLMs, vector search, and modern web tech to build powerful, explainable document Q&A systems for real-world use cases.
