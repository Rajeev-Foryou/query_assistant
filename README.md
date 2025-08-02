PDF Query Assistant – Node.js RAG System
Overview
PDF Query Assistant is a full-stack Retrieval-Augmented Generation (RAG) application that lets users ask natural language questions about the content of local PDF documents. It combines modern AI (Google Gemini), vector search (FAISS), and a React frontend for a seamless, interactive experience.

Tech Stack
Backend: Node.js, Express, LangChain.js, Google Gemini API, FAISS, pdf-parse
Frontend: React, Vite, TailwindCSS
Other: Zod (validation), dotenv (env management), CORS
Workflow
PDF Ingestion & Indexing

On server start, all PDFs in the data folder are loaded and parsed.
Text is split into manageable chunks using LangChain's splitter.
Chunks are embedded via Gemini and indexed in a FAISS vector store for fast semantic search.
User Query (Frontend)

Users enter questions in the React UI.
The frontend sends the query to the backend via a POST request.
Query Understanding & Retrieval (Backend)

The backend extracts the main topic from the user's query using Gemini.
The topic is used to retrieve the top relevant document chunks from the FAISS vector store.
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
