import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const ChatInterface = ({ onBack }) => {
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const [messages, setMessages] = useState([
    {
      text: "Hello! I'm your AI assistant. Upload a document and I can answer questions about it. How may I help you today?",
      sender: "bot",
      timestamp: new Date().toISOString(),
    },
  ]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const addSystemMessage = (text) => {
    setMessages((prev) => [
      ...prev,
      {
        text,
        sender: "system",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const addMessage = (text, sender = "user", sources = null) => {
    setMessages((prev) => [
      ...prev,
      {
        text,
        sender,
        timestamp: new Date().toISOString(),
        sources,
      },
    ]);
  };

  // Check if the message is a greeting or farewell
  const isGreeting = (text) => {
    const textLower = text.toLowerCase().trim();
    const greetings = [
      "hi",
      "hello",
      "hey",
      "greetings",
      "good morning",
      "good afternoon",
      "good evening",
    ];
    const farewells = ["bye", "goodbye", "see you", "see ya", "take care"];

    // Check for greetings
    const isGreeting = greetings.some(
      (greeting) => textLower.startsWith(greeting) || textLower === greeting
    );

    // Handle farewells
    const isFarewell = farewells.some(
      (farewell) => textLower.startsWith(farewell) || textLower === farewell
    );

    return isGreeting || isFarewell;
  };

  // Check if the message is a thank you
  const isThankYou = (text) => {
    const thanks = ["thank", "thanks", "appreciate"];
    return thanks.some((thank) => text.toLowerCase().includes(thank));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userQuery = query.trim();
    if (!userQuery || isLoading) return;

    addMessage(userQuery, "user");
    setIsLoading(true);

    try {
      // Use VITE_API_URL if set, otherwise auto-switch between local and deployed
      let apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        if (
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        ) {
          apiUrl = "http://localhost:3000";
        } else {
          apiUrl = "https://query-assistant.onrender.com";
        }
      }
      const response = await fetch(`${apiUrl}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: userQuery }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || "Failed to get response from server");
      }

      const data = await response.json();
      addMessage(data.answer, "bot", data.sources);
    } catch (error) {
      console.error("Error sending message:", error);
      addSystemMessage(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Format file size helper function
  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Get color based on confidence score
  const getConfidenceColor = (confidence) => {
    if (confidence > 0.8) return "#2ecc71"; // Green
    if (confidence > 0.5) return "#f39c12"; // Orange
    return "#e74c3c"; // Red
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-left">
          <button className="back-button" onClick={onBack}>
            ← Back
          </button>
          <h2>AI Assistant</h2>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {messages.map((message, index) => (
          <div key={index} className={`message ${message.sender}`}>
            <div className="message-content">{message.text}</div>
            <div className="message-timestamp">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="message bot">
            <div className="typing-indicator">Thinking...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <form className="chat-input-container" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Type your question here..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className="send-button"
          disabled={!query.trim() || isLoading}
        >
          {isLoading ? <span className="loading-spinner" /> : "Send"}
        </button>
      </form>
    </div>
  );
};

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const [uploadStatus, setUploadStatus] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!selectedFile) {
      alert("Please select a file first");
      return;
    }

    // Validate file type
    const allowedExtensions = ["pdf", "txt"];
    const fileExt = selectedFile.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(fileExt)) {
      alert("Only PDF and TXT files are supported");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setIsUploading(true);
    setUploadStatus("Uploading...");
    setUploadProgress(0);

    try {
      console.log("Starting file upload...", selectedFile.name);

      // Use VITE_API_URL if set, otherwise auto-switch between local and deployed
      let apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        if (
          window.location.hostname === "localhost" ||
          window.location.hostname === "127.0.0.1"
        ) {
          apiUrl = "http://localhost:3000";
        } else {
          apiUrl = "https://query-assistant.onrender.com";
        }
      }
      const response = await fetch(`${apiUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUploadStatus("Processing...");
        setUploadProgress(50);

        const data = await response.json();
        console.log("Upload successful, received data:", data);

        setUploadStatus("Upload successful!");
        setUploadProgress(100);

        // Wait for a moment before transitioning
        setTimeout(() => {
          setActiveDocument({
            name: selectedFile.name,
            namespace: data.namespace,
          });
        }, 1000);
        setUploadStatus("Upload successful!");
        setUploadProgress(100);

        setTimeout(() => {
          setUploadStatus(null);
          setUploadProgress(0);
        }, 3000);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Upload failed. Please try again.");
      }
    } catch (error) {
      console.error("Upload error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
      });
      setUploadStatus(`Error: ${error.message}`);
      setUploadProgress(0);

      // Clear error after 5 seconds
      setTimeout(() => {
        setUploadStatus(null);
      }, 5000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackToUpload = () => {
    setActiveDocument(null);
    setSelectedFile(null);
    const fileInput = document.getElementById("file-upload");
    if (fileInput) fileInput.value = "";
  };

  if (activeDocument) {
    return <ChatInterface onBack={handleBackToUpload} />;
  }

  return (
    <div className="app">
      <h1>Document Upload</h1>
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="file-upload-container">
          <div className="file-input-wrapper">
            <input
              type="file"
              id="file-upload"
              accept=".pdf,.txt"
              onChange={handleFileChange}
              className="file-input"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className={`file-label ${isUploading ? "disabled" : ""}`}
            >
              <div className="file-upload-icon">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
              </div>
              <div className="file-upload-text">
                <p className="file-upload-title">
                  {selectedFile
                    ? selectedFile.name
                    : "Click to select a PDF file"}
                </p>
                <p className="file-upload-subtitle">
                  {selectedFile
                    ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                    : "or drag and drop"}
                </p>
              </div>
            </label>
          </div>

          {selectedFile && (
            <div className="file-preview">
              <div className="file-info">
                <div className="file-icon">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="file-details">
                  <p className="file-name">{selectedFile.name}</p>
                  <p className="file-size">
                    {`${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                </div>
              </div>

              {uploadProgress > 0 && (
                <div className="upload-progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                  <span className="progress-text">
                    {uploadStatus || "Uploading..."}{" "}
                    {Math.round(uploadProgress)}%
                  </span>
                </div>
              )}

              {uploadStatus && uploadStatus.startsWith("Error") && (
                <div className="upload-error">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="error-icon"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>{uploadStatus}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="upload-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={() => {
              setSelectedFile(null);
              setUploadStatus(null);
              setUploadProgress(0);
              const fileInput = document.getElementById("file-upload");
              if (fileInput) fileInput.value = "";
            }}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={`upload-button ${
              !selectedFile || isUploading ? "disabled" : ""
            }`}
            disabled={!selectedFile || isUploading}
          >
            {isUploading ? (
              <>
                <svg className="spinner" viewBox="0 0 24 24">
                  <circle
                    className="path"
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    strokeWidth="4"
                  ></circle>
                </svg>
                {uploadStatus || "Uploading..."}
              </>
            ) : (
              "Upload & Chat"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;
