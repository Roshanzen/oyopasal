import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, MapPin, ExternalLink, RefreshCw, ChevronDown, ShoppingBag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GroundingMapChunk {
  maps?: {
    uri?: string;
    title?: string;
    placeAnswerSources?: {
      reviewSnippets?: Array<{
        reviewText?: string;
      }>;
    };
  };
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingChunks?: GroundingMapChunk[];
}

const DEFAULT_SUGGESTIONS = [
  '🥦 Find fresh organic vegetables near Baneshwor',
  '🥖 Which artisan bakery is closest to Patan?',
  '🍳 What can I cook with tomatoes, eggs & cilantro?',
  '🏷️ What are today\'s best discount promo codes?'
];

export const ChatConcierge: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: 'Namaste! 🙏 I am your **OyoPasal Concierge** powered by Gemini. Ask me about fresh local groceries, 10–15 minute express delivery coverage, recipe ideas, or neighborhood marts in Kathmandu Valley!',
      timestamp: 'Just now'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get user location for maps grounding if permitted
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude
          });
        },
        () => {
          // Default to central Kathmandu Valley
          setUserCoords({ latitude: 27.7172, longitude: 85.3240 });
        },
        { timeout: 5000 }
      );
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query || loading) return;

    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');
    setLoading(true);

    try {
      // Send conversation history to backend /api/v1/chat/
      const res = await fetch('/api/v1/chat/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newHistory.map(m => ({ role: m.role, content: m.content })),
          userLocation: userCoords
        })
      });

      const data = await res.json();

      const assistantMsg: Message = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: data.reply || "Here is the freshest produce and information for your order!",
        groundingChunks: data.groundingChunks || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `msg-${Date.now() + 1}`,
          role: 'assistant',
          content: "I had a momentary connection hiccup. Fresh staples are always in stock in our catalog—please try again!",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: 'Conversation refreshed! How can I assist your grocery shopping today?',
        timestamp: 'Just now'
      }
    ]);
  };

  return (
    <AnimatePresence>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-5 z-40 flex items-center gap-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white px-4 py-3 rounded-full shadow-xl shadow-emerald-900/25 group focus:outline-none focus:ring-4 focus:ring-emerald-400/40 select-none cursor-pointer"
          title="Ask OyoPasal Concierge (Gemini AI)"
        >
          <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-white/20">
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold leading-tight flex items-center gap-1.5">
              <span>OyoPasal AI</span>
              <span className="bg-emerald-400 text-emerald-950 text-xs font-black uppercase px-1.5 py-0.5 rounded-full">3.8 Flash</span>
            </div>
            <div className="text-xs text-emerald-100 font-medium">Grocery & Maps Guide</div>
          </div>
        </motion.button>
      )}

      {/* Floating Chat Modal / Drawer with Spring Scale */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 350, damping: 28 }}
          className={`fixed z-50 ${
            isMinimized 
              ? 'bottom-6 right-5 w-76' 
              : 'bottom-4 sm:bottom-6 right-3 sm:right-6 w-[calc(100vw-24px)] sm:w-[440px] max-w-[460px] h-[600px] max-h-[85vh]'
          } bg-white dark:bg-[#111726] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden select-none`}
        >
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 text-white p-3.5 flex items-center justify-between select-none shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-base leading-tight text-white">OyoPasal Concierge</h3>
                  <span className="text-xs bg-emerald-500/80 text-white font-semibold px-1.5 py-0.5 rounded">Gemini 3.8</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-100">
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-ping" />
                  <span>Google Maps Grounded • Instant Delivery</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Restart chat"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand" : "Minimize"}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronDown className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close chat"
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/70 dark:bg-[#090D16] text-slate-800 dark:text-slate-100 text-sm">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-200 dark:border-emerald-800">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className={`max-w-[85%] ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-none shadow-sm'
                        : 'bg-white dark:bg-[#111726] text-slate-800 dark:text-slate-100 rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-800 shadow-sm'
                    } p-3`}>
                      {/* Message Content */}
                      <div className="whitespace-pre-line text-sm leading-relaxed">
                        {msg.content}
                      </div>

                      {/* Google Maps Grounding Chunks */}
                      {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-1.5">
                          <div className="flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <MapPin className="w-3.5 h-3.5 text-red-500" />
                            <span>Google Maps Verified Places:</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.groundingChunks.map((chunk, idx) => {
                              if (!chunk.maps) return null;
                              return (
                                <a
                                  key={idx}
                                  href={chunk.maps.uri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(chunk.maps.title || 'Kathmandu')}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-xs bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800 transition-colors font-medium group"
                                >
                                  <span>{chunk.maps.title || 'View on Google Maps'}</span>
                                  <ExternalLink className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform" />
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className={`text-xs mt-1.5 text-right ${
                        msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                      }`}>
                        {msg.timestamp}
                      </div>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-lg bg-slate-800 dark:bg-slate-700 text-white flex items-center justify-center shrink-0 mt-0.5">
                        <User className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2.5 justify-start">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="bg-white dark:bg-[#111726] rounded-2xl rounded-tl-none border border-slate-200 dark:border-slate-800 p-3 shadow-sm flex items-center gap-2">
                      <div className="flex space-x-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Checking live catalog & maps...</span>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Suggestions */}
              {messages.length <= 2 && (
                <div className="p-2.5 bg-slate-100/70 dark:bg-slate-900/60 border-t border-slate-200/80 dark:border-slate-800">
                  <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5 px-1 flex items-center gap-1">
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Quick Questions:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {DEFAULT_SUGGESTIONS.map((sug, i) => (
                      <button
                        key={i}
                        onClick={() => handleSendMessage(sug)}
                        className="text-xs bg-white dark:bg-[#111726] hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-700 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors text-left cursor-pointer"
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input Footer */}
              <div className="p-3 bg-white dark:bg-[#111726] border-t border-slate-200 dark:border-slate-800">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about groceries, recipes, or locations..."
                    className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 active:scale-95 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500 mt-1.5 px-1">
                  <span>Powered by Gemini 3.8 Flash</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                    Kathmandu Valley Grounded
                  </span>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
