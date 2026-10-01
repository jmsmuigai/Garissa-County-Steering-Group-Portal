import React, { useState } from 'react';
import { Send, Bot, User, Globe2 } from 'lucide-react';

const Chatbot = () => {
  const [messages] = useState([
    { role: 'ai', content: 'Welcome to the Garissa CSG Agentic Portal. I am your Gemini-powered assistant. How can I help you analyze flood risks or visualize data today? (Ndiyo, ninaweza kuongea Kiswahili. Haa, waan ku hadli karaa Af-Soomaali.)' }
  ]);

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

      {/* Messages Area (Placeholder) */}
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col space-y-4">
        <div className="text-xs text-center text-gray-500 mb-2">
          Secure connection established. Powered by Google Gemini Pro.
        </div>
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'ai' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] rounded-xl p-3 text-sm shadow-sm ${msg.role === 'ai' ? 'bg-white border border-gray-200 text-gray-800' : 'bg-garissa-water text-white'}`}>
              {msg.content}
            </div>
          </div>
        ))}

        <div className="flex justify-start">
           <div className="max-w-[80%] rounded-xl p-4 text-sm shadow-sm bg-blue-50 border border-blue-200 text-blue-800">
              <strong className="block mb-1 text-garissa-water">Placeholder Note:</strong>
              This component is ready to be hooked up to the Gemini Pro API. Once your API key is active in the `.env` file, Claude/Gemini can wire this UI to send and receive real-time GIS commands and data queries.
           </div>
        </div>
      </div>

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-200">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Ask about flood risks or map layers..." 
            className="w-full pl-4 pr-12 py-3 rounded-full border border-gray-300 focus:outline-none focus:border-garissa-water focus:ring-1 focus:ring-garissa-water bg-gray-50 text-sm"
            disabled
          />
          <button disabled className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-garissa-water text-white rounded-full opacity-50 cursor-not-allowed">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
