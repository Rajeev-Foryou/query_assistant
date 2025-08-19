import React, { useState } from 'react';
import './App.css';

const ChatInterface = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    { 
      text: "Hello! I'm your AI assistant. I can help you find information across all the documents in the knowledge base. How may I help you today?", 
      sender: 'bot' 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);

  // Check if the message is a greeting
  const isGreeting = (text) => {
    const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'];
    return greetings.some(greeting => 
      text.toLowerCase().trim().startsWith(greeting) || 
      text.toLowerCase().trim() === greeting
    );
  };

  // Check if the message is a thank you
  const isThankYou = (text) => {
    const thanks = ['thank', 'thanks', 'appreciate'];
    return thanks.some(thank => text.toLowerCase().includes(thank));
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const userMessage = query.trim();
    if (!userMessage) return;

    // Add user message
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setQuery('');
    setIsLoading(true);

    // Handle greetings and thanks without API call
    if (isGreeting(userMessage)) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          text: userMessage.toLowerCase().includes('good') 
            ? `${userMessage.split(' ')[0]} ${userMessage.split(' ')[1]}! How can I assist you today?`
            : "Hello! How can I assist you today?", 
          sender: 'bot' 
        }]);
        setIsLoading(false);
      }, 500);
      return;
    }

    if (isThankYou(userMessage)) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          text: "You're welcome! Is there anything else I can help with?", 
          sender: 'bot' 
        }]);
        setIsLoading(false);
      }, 500);
      return;
    }

    try {
      console.log('Sending message with query:', query);
      
      // No need to check for uploaded file as we're using all available documents

      // Call the backend API to get the response
      const response = await fetch('http://localhost:3000/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: query,
          context: {
            useAllDocuments: true,
            conversationId: 'user-' + Date.now() // Generate a unique conversation ID
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Add the bot's response to the messages
      const botResponse = {
        text: data.answer || "I couldn't generate a response. Please try again.",
        sender: 'bot'
      };
      
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { 
        text: 'Sorry, there was an error processing your request. Please try again later.', 
        sender: 'bot' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button onClick={onBack} className="back-button">
          ← Back to Upload
        </button>
        <h2>Document Knowledge Base</h2>
      </div>
      
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.sender}`}>
            {msg.text}
          </div>
        ))}
        {isLoading && (
          <div className="message bot">
            <div className="typing-indicator">Typing...</div>
          </div>
        )}
      </div>

      <form onSubmit={handleSendMessage} className="chat-input-container">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about the document..."
          className="chat-input"
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!query.trim() || isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
};

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const handleFileChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);

    try {
      console.log('Uploading file...');
      const response = await fetch('http://localhost:3000/upload', {
        method: 'POST',
        body: formData,
        // Important: Don't set Content-Type header when using FormData
        // The browser will set it automatically with the correct boundary
      });

      const data = await response.json();
      console.log('Upload response:', data);
      
      if (response.ok && data.file) {
        // Use the filename from the server response
        setUploadedFile(data.file.filename);
        console.log('File uploaded successfully:', data.file.filename);
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleBackToUpload = () => {
    setUploadedFile(null);
    setSelectedFile(null);
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
  };

  if (uploadedFile) {
    return <ChatInterface 
      fileName={uploadedFile} 
      uploadedFile={selectedFile} 
      onBack={handleBackToUpload} 
    />;
  }

  return (
    <div className="app">
      <h1>Document Upload</h1>
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="file-input-container">
          <input
            type="file"
            id="file-upload"
            accept=".pdf,.doc,.docx"
            onChange={handleFileChange}
            className="file-input"
          />
          <label htmlFor="file-upload" className="file-label">
            {selectedFile ? selectedFile.name : 'Choose a file (PDF/DOC/DOCX)'}
          </label>
        </div>
        <button 
          type="submit" 
          className="upload-button"
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload & Chat'}
        </button>
      </form>
    </div>
  );
}

export default App;
