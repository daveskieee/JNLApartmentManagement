import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FiSend, FiX, FiZap, FiMaximize2, FiMinimize2, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(true);
  const [messages, setMessages] = useState([
    { type: 'bot', message: 'Hi! I\'m your smart apartment assistant. I can help with rent, utilities, complaints, and more. How can I help?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const suggestedQuestions = [
    'What about my rent?',
    'Water consumption',
    'How do I submit a complaint?',
    'Maintenance help',
    'Give me suggestions'
  ];

  const scrollToBottom = () => {
    // scroll the messages container to the bottom
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // When messages change, only auto-scroll if suggestions panel is closed
  useEffect(() => {
    if (!showSuggestions) {
      scrollToBottom();
    }
  }, [messages, showSuggestions]);

  // When suggestions panel opens, scroll messages to top so suggestions are visible
  useEffect(() => {
    if (showSuggestions && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = 0;
    }
  }, [showSuggestions]);

  // Load suggestions on open
  useEffect(() => {
    if (isOpen && suggestions.length === 0) {
      loadSuggestions();
    }
  }, [isOpen]);

  const loadSuggestions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/chatbot/suggestions', { headers: { Authorization: `Bearer ${token}` } });
      setSuggestions(response.data.data || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
    }
  };

  const handleSendMessage = async (e, message = null) => {
    e.preventDefault();
    const textToSend = message || input;
    if (!textToSend.trim()) return;

    // Add user message
    setMessages(prev => [...prev, { type: 'user', message: textToSend }]);
    setInput('');
    setIsLoading(true);
    // Auto-hide suggestions panel so quick questions reappear
    setShowSuggestions(false);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/chatbot/query',
        { message: textToSend },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add bot response - handle different response formats
      const botMessage = response.data.message || response.data.reply || 'I understand. How can I help you further?';
      setMessages(prev => [...prev, { type: 'bot', message: botMessage }]);
    } catch (error) {
      toast.error('Failed to get response');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen && (
        <div className={`bg-white rounded-lg shadow-2xl flex flex-col mb-4 border border-gray-200 overflow-hidden transition-[width,height,max-width,max-height] duration-400 ease-in-out ${
          isExpanded 
            ? 'w-[90vw] max-w-3xl h-[600px]' 
            : 'w-96 h-96'
        }`}>
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
            <h3 className="font-bold">Smart Assistant</h3>
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
                title={isExpanded ? "Minimize" : "Expand"}
              >
                {isExpanded ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSuggestions(!showSuggestions);
                }}
                className="hover:bg-blue-700 p-1 rounded transition-colors"
                title="View Suggestions"
              >
                <FiZap size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="hover:bg-blue-700 p-1 rounded">
                <FiX size={20} />
              </button>
            </div>
          </div>

          {/* Suggestions Panel */}
          {showSuggestions && (
            <div className={`border-b border-gray-200 p-4 bg-blue-50 overflow-y-auto transition-[max-height] duration-400 ease-in-out ${
              isExpanded ? 'max-h-80' : 'max-h-48'
            }`}>
              <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <FiZap size={16} /> AI Suggestions
              </h4>
              {suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((sugg, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg text-sm ${
                        sugg.type === 'warning' ? 'bg-yellow-100 border-l-4 border-yellow-500' :
                        sugg.type === 'alert' ? 'bg-red-100 border-l-4 border-red-500' :
                        sugg.type === 'success' ? 'bg-green-100 border-l-4 border-green-500' :
                        'bg-blue-100 border-l-4 border-blue-500'
                      }`}
                    >
                      <p className="font-semibold text-gray-800">{sugg.title}</p>
                      <p className="text-gray-700 text-xs mt-1">{sugg.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-sm">Loading suggestions...</p>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} className={`flex-1 overflow-y-auto p-4 space-y-3 transition-[max-height] duration-400 ease-in-out ${
            isExpanded ? 'max-h-96' : 'max-h-64'
          }`}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-xs px-4 py-3 rounded-lg text-sm leading-relaxed ${
                    msg.type === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-gradient-to-r from-blue-50 to-blue-100 text-gray-900 border border-blue-200 rounded-bl-none shadow-sm'
                  }`}
                  style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordWrap: 'break-word', 
                    overflowWrap: 'break-word',
                    minHeight: '2.5rem',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {msg.message}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-gray-600 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            {!isLoading && !showSuggestions && (
              <div className="space-y-2 mt-4 border-t pt-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickQuestions(!showQuickQuestions);
                  }}
                  className="w-full flex items-center justify-between text-xs text-gray-500 font-semibold hover:text-gray-700 transition"
                >
                  <span>Quick questions</span>
                  <FiChevronDown size={14} className={`transition-transform duration-300 ${showQuickQuestions ? 'rotate-180' : ''}`} />
                </button>
                {showQuickQuestions && (
                  <div className="space-y-2 animate-in fade-in-0 slide-in-from-top-2">
                    {suggestedQuestions.map((question, idx) => (
                      <button
                        key={idx}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendMessage(e, question);
                        }}
                        className="w-full text-left text-sm bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 px-3 py-2 rounded-lg transition border border-blue-200 text-gray-700 font-medium"
                      >
                        ✨ {question}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 text-sm disabled:bg-gray-100 disabled:text-gray-500"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <FiSend size={18} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Toggle Button - Hidden when chatbot is open */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white p-4 rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center animate-in fade-in-0 zoom-in-95"
        >
          <span className="text-2xl">💬</span>
        </button>
      )}
    </div>
  );
};

export default Chatbot;
