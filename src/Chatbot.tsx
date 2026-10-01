import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Globe2, Loader2 } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini API
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || 'dummy-key');
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

type Message = { role: 'ai' | 'user'; content: string };

const Chatbot = () => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', content: 'Welcome to the Garissa CSG Agentic Portal. I am your Gemini-powered assistant. How can I help you analyze flood risks or visualize data today? (Ndiyo, ninaweza kuongea Kiswahili. Haa, waan ku hadli karaa Af-Soomaali.)' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      setError("API Key is missing! Please configure VITE_GEMINI_API_KEY in the .env file.");
      return;
    }

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      // Build context from previous messages for the model
      const promptContext = messages.map(m => `${m.role === 'ai' ? 'Assistant' : 'User'}: ${m.content}`).join('\n');
      const finalPrompt = `You are a helpful, smart AI assistant for the Garissa County Steering Group (CSG) Disaster Risk Management Portal. 
You answer questions about flood risks, El Nino, Health and WASH analytics, and Nature-based solutions in Garissa.
You can respond in English, Swahili, or Somali depending on the user's language. Keep answers concise, factual, and helpful.

Context:
${promptContext}
User: ${input}
Assistant:`;

      const result = await model.generateContent(finalPrompt);
      const responseText = result.response.text();
      
      setMessages(prev => [...prev, { role: 'ai', content: responseText }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to communicate with Gemini API.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] glass-panel flex flex-col z-50 overflow-hidden shadow-2xl border border-garissa-water">
      {/* Header */}
      <div className="bg-garissa-water text-white p-4 flex justify-between items-center">
        <div className="flex items-center">
          <Bot className="w-6 h-6 mr-2" />
          <h3 className="font-bold">CSG Agentic AI</h3>
        </div>
        <Globe2 className="w-5 h-5 opacity-70" title="Multilingual Enabled" />
      </div>

      {/* Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col space-y-4">
        <div className="text-xs text-center text-gray-500 mb-2">
          Secure connection established. Powered by Google Gemini Pro.
        </div>
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] rounded-xl p-3 text-sm shadow-sm whitespace-pre-wrap ${msg.role === 'ai' ? 'bg-white border border-gray-200 text-gray-800' : 'bg-garissa-water text-white'}`}>
              {msg.content}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-xl p-3 text-sm shadow-sm bg-white border border-gray-200 text-gray-800 flex items-center">
              <Loader2 className="w-4 h-4 animate-spin mr-2 text-garissa-water" /> Thinking...
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-center">
            <div className="max-w-[90%] rounded-xl p-3 text-xs shadow-sm bg-red-50 border border-red-200 text-red-800">
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Ask about flood risks or map layers..." 
            className="w-full pl-4 pr-12 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-garissa-water focus:ring-1 focus:ring-garissa-water bg-gray-50 text-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading || !input.trim()} 
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-garissa-water text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
