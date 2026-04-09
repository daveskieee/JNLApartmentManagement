import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { FiSend, FiX, FiZap, FiMaximize2, FiMinimize2, FiChevronDown } from 'react-icons/fi';
import toast from 'react-hot-toast';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showQuickQuestions, setShowQuickQuestions] = useState(false);
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

  // Load suggestions on open (always reload to ensure tenant-specific data)
  useEffect(() => {
    if (isOpen) {
      setShowQuickQuestions(false);
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
    // Collapse quick-question list so new replies stay visible.
    setShowQuickQuestions(false);
    setTimeout(() => {
      scrollToBottom();
    }, 0);

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        '/api/chatbot/query',
        { message: textToSend },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Add bot response - handle different response formats
      const botMessage = response.data.message || response.data.reply || 'I understand. How can I help you further?';
      const botMeta = response.data.meta || null;
      setMessages(prev => [...prev, { type: 'bot', message: botMessage, meta: botMeta }]);
      setTimeout(() => {
        scrollToBottom();
      }, 0);
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
        <div className={`bg-white rounded-lg shadow-2xl flex flex-col mb-4 border border-slate-300 overflow-hidden transition-[width,height,max-width,max-height] duration-400 ease-in-out ${
          isExpanded 
            ? 'w-[92vw] max-w-3xl h-[80vh] sm:h-[600px]' 
            : 'w-[92vw] max-w-sm h-[72vh] max-h-[520px] sm:w-96 sm:h-96'
        }`}>
          {/* Header */}
          <div className="bg-[#9d5f51] text-white p-4 rounded-t-lg flex justify-between items-center border-b border-[#7a4f45]">
            <h3 className="font-bold">Smart Assistant</h3>
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(!isExpanded);
                }}
                className="text-white hover:bg-[#7a4f45] p-1 rounded transition-colors"
                title={isExpanded ? "Minimize" : "Expand"}
              >
                {isExpanded ? <FiMinimize2 size={18} /> : <FiMaximize2 size={18} />}
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSuggestions(!showSuggestions);
                }}
                className="text-white hover:bg-[#7a4f45] p-1 rounded transition-colors"
                title="View Suggestions"
              >
                <FiZap size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="text-white hover:bg-[#7a4f45] p-1 rounded">
                <FiX size={20} />
              </button>
            </div>
          </div>

          {/* Suggestions Panel */}
          {showSuggestions && (
            <div className={`border-b border-slate-300 p-4 bg-[#fcf9f8] overflow-y-auto transition-[max-height] duration-400 ease-in-out ${
              isExpanded ? 'max-h-80' : 'max-h-48'
            }`}>
              <h4 className="font-semibold text-sm text-slate-900 mb-3 flex items-center gap-2">
                <FiZap size={16} /> AI Suggestions
              </h4>
              {suggestions.length > 0 ? (
                <div className="space-y-2">
                  {suggestions.map((sugg, idx) => (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg text-sm ${
                        sugg.type === 'warning' ? 'bg-white border border-amber-300 border-l-4 border-l-amber-600' :
                        sugg.type === 'alert' ? 'bg-white border border-rose-300 border-l-4 border-l-rose-700' :
                        sugg.type === 'success' ? 'bg-white border border-emerald-300 border-l-4 border-l-emerald-700' :
                        'bg-white border border-sky-300 border-l-4 border-l-sky-700'
                      }`}
                    >
                      <p className="font-semibold text-slate-900">{sugg.title}</p>
                      <p className="text-slate-800 text-xs mt-1 leading-relaxed">{sugg.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-700 text-sm">Loading suggestions...</p>
              )}
            </div>
          )}

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3">
            <div className="flex-1" />
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-xs">
                  <div
                    className={`px-4 py-3 rounded-lg text-sm leading-relaxed ${
                      msg.type === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white text-slate-900 border border-[#e2cfca] rounded-bl-none shadow-sm'
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
                  {msg.type === 'bot' && msg.meta?.model && (
                    <p className="text-[10px] text-slate-500 mt-1 px-1">
                      via {msg.meta.source || 'assistant'} · {msg.meta.model}
                    </p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white text-slate-900 px-4 py-2 rounded-lg border border-slate-300">
                  <div className="flex space-x-2">
                    <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce delay-100"></div>
                    <div className="w-2 h-2 bg-slate-700 rounded-full animate-bounce delay-200"></div>
                  </div>
                </div>
              </div>
            )}
            {!isLoading && !showSuggestions && (
              <div className="space-y-2 border-t border-[#e2cfca] pt-3 bg-white">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowQuickQuestions(!showQuickQuestions);
                  }}
                  className="w-full flex items-center justify-between text-xs text-slate-600 font-semibold hover:text-slate-900 transition"
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
                        className="w-full text-left text-sm bg-white hover:bg-[#f8efec] px-3 py-2 rounded-lg transition border border-[#d7b3a8] text-slate-900 font-medium"
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
          <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-300 bg-white">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                disabled={isLoading}
                className="flex-1 px-3 py-2 border border-[#d7b3a8] rounded-lg bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9d5f51] focus:border-[#9d5f51] text-sm disabled:bg-slate-200 disabled:text-slate-600"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-[#c77b69] text-white px-4 py-2 rounded-lg hover:bg-[#9d5f51] disabled:opacity-50 disabled:cursor-not-allowed transition"
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
          className="bg-[#c77b69] text-white p-4 rounded-full shadow-lg hover:bg-[#9d5f51] hover:shadow-xl active:scale-95 transition-all duration-200 flex items-center justify-center animate-in fade-in-0 zoom-in-95"
        >
          <span className="text-2xl">💬</span>
        </button>
      )}
    </div>
  );
};

export default Chatbot;
