import React, { useState } from "react";

// You can create these as separate SVG components for better organization
const LoadingSpinner = () => (
  <svg
    className="animate-spin h-5 w-5 text-white"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

const App = () => {
  // State management using React hooks
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // --- IMPORTANT ---
  // When you deploy your backend, change this URL to your deployed API's URL.
  const API_URL = "https://query-assistant.onrender.com/ask";

  // Handles the form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;

    // Reset state and start loading
    setResult(null);
    setError("");
    setLoading(true);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || `HTTP error! Status: ${response.status}`
        );
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 text-gray-800 flex items-center justify-center min-h-screen font-sans">
      <div className="w-full max-w-3xl mx-auto bg-white rounded-2xl shadow-lg p-6 md:p-10 border border-gray-100">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            PDF Query Assistant
          </h1>
          <p className="text-gray-500 mt-3 text-lg">
            Ask any question about the content of your PDF documents.
          </p>
        </div>

        {/* Query Form */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col sm:flex-row gap-3 mb-8"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g., What is the policy period?"
            className="flex-grow w-full px-4 py-3 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition duration-200"
            disabled={loading}
            required
          />
          <button
            type="submit"
            className="bg-indigo-600 text-white font-semibold px-6 py-3 rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200 flex items-center justify-center disabled:bg-indigo-400 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? <LoadingSpinner /> : "Ask"}
          </button>
        </form>

        {/* Results Display Area */}
        {error && (
          <div className="mt-6 bg-red-50 border border-red-200 text-red-800 p-4 rounded-lg">
            <p>
              <strong>Error:</strong> {error}
            </p>
          </div>
        )}

        {result && (
          <div className="mt-8 space-y-6 animate-fade-in">
            {/* Answer Card */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-indigo-800 mb-2">
                Answer
              </h2>
              <p className="text-indigo-900 leading-relaxed">{result.answer}</p>
            </div>
            {/* Reasoning Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Reasoning
              </h2>
              <p className="text-gray-700 leading-relaxed">
                {result.reasoning}
              </p>
            </div>
            {/* Source Clause Card */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">
                Source Clause
              </h2>
              <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-gray-100 p-3 rounded-md">
                {result.sourceClause}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
