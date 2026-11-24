import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Send,
  Loader2,
  Check,
  CheckCheck,
  Store,
  User,
  ShoppingBag,
  ExternalLink,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { messagingService } from '../../services/messagingService';
import {
  ChatMessage,
  ConversationDetail,
  ConversationItem,
  ProductContext,
} from '../../types/messaging';
import { Link } from 'react-router-dom';

interface ChatWindowProps {
  conversationId: string;
  initialConversation?: ConversationDetail | ConversationItem | null;
  onClose?: () => void;
  asRole?: 'customer' | 'vendor';
  onNewMessageSent?: (msg: ChatMessage) => void;
  className?: string;
  compact?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversationId,
  initialConversation,
  onClose,
  asRole = 'customer',
  onNewMessageSent,
  className = '',
  compact = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversation, setConversation] = useState<ConversationDetail | ConversationItem | null>(
    initialConversation || null
  );
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingTimerRef = useRef<any>(null);
  const isComponentMounted = useRef(true);

  const scrollToBottom = useCallback((smooth = true) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  // Fetch initial detail and messages
  const loadConversationData = useCallback(async (isInitial = false) => {
    try {
      if (isInitial) setLoading(true);
      const [detailData, messageList] = await Promise.all([
        messagingService.getConversationDetail(conversationId, asRole).catch(() => null),
        messagingService.getMessages(conversationId, 60, asRole).catch(() => []),
      ]);

      if (!isComponentMounted.current) return;

      if (detailData) {
        setConversation(detailData);
      }
      const msgs = Array.isArray(messageList) ? messageList : ((messageList as any)?.results ?? []);
      const recent = Array.isArray(detailData?.recent_messages) ? detailData.recent_messages : [];
      if (msgs.length > 0) {
        setMessages(msgs);
      } else if (recent.length > 0) {
        setMessages(recent);
      } else {
        setMessages([]);
      }
      setError(null);
    } catch (err: any) {
      if (isComponentMounted.current) {
        setError(err.message || 'Failed to load conversation');
      }
    } finally {
      if (isComponentMounted.current && isInitial) {
        setLoading(false);
        setTimeout(() => scrollToBottom(false), 80);
      }
    }
  }, [conversationId, asRole, scrollToBottom]);

  // Initial load
  useEffect(() => {
    isComponentMounted.current = true;
    loadConversationData(true);

    return () => {
      isComponentMounted.current = false;
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [loadConversationData]);

  // Polling for live updates every 3.5 seconds
  useEffect(() => {
    pollingTimerRef.current = setInterval(async () => {
      if (!isComponentMounted.current || document.hidden) return;
      try {
        const latestMessages = await messagingService.getMessages(conversationId, 60, asRole);
        if (!isComponentMounted.current) return;

        const safeLatest = Array.isArray(latestMessages) ? latestMessages : ((latestMessages as any)?.results ?? []);
        if (safeLatest.length > 0) {
          setMessages((prev) => {
            const safePrev = Array.isArray(prev) ? prev : [];
            if (safeLatest.length !== safePrev.length ||
                (safeLatest.length > 0 && safePrev.length > 0 &&
                 safeLatest[safeLatest.length - 1]?.id !== safePrev[safePrev.length - 1]?.id)) {
              setTimeout(() => scrollToBottom(true), 60);
              return safeLatest;
            }
            return safePrev;
          });
        }
      } catch {
        // Silently swallow polling hiccups
      }
    }, 3500);

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
      }
    };
  }, [conversationId, asRole, scrollToBottom]);

  // Handle send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || sending) return;

    if (content.length > 2000) {
      setError('Message exceeds 2,000 character limit.');
      return;
    }

    setSending(true);
    setError(null);

    try {
      const newMsg = await messagingService.sendMessage(conversationId, { content }, asRole);
      if (!isComponentMounted.current) return;

      setInputText('');
      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => scrollToBottom(true), 50);

      if (onNewMessageSent) {
        onNewMessageSent(newMsg);
      }
    } catch (err: any) {
      if (isComponentMounted.current) {
        setError(err.message || 'Failed to send message. Please retry.');
      }
    } finally {
      if (isComponentMounted.current) {
        setSending(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Determine other party display details
  const otherParty = conversation?.other_party;
  const otherName = otherParty?.name || (asRole === 'customer' ? conversation?.store_name || conversation?.vendor_name : conversation?.customer_name) || 'User';
  const otherSubtitle = otherParty?.subtitle || (asRole === 'customer' ? 'Store & Seller Support' : 'Customer');
  const otherAvatar = otherParty?.avatar_url || (asRole === 'customer' ? conversation?.store_logo_url : conversation?.customer_avatar_url);
  const product = conversation?.product_context;

  const formatMessageTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-lg ${className}`}>
      {/* Chat Header */}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative shrink-0">
            {otherAvatar ? (
              <img
                src={otherAvatar}
                alt={otherName}
                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                {asRole === 'customer' ? <Store className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {otherName}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              {otherSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => loadConversationData(false)}
            title="Refresh messages"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close chat"
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Product Context Banner (if tied to a specific product) */}
      {product && (
        <div className="px-4 py-2 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/40 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-8 h-8 rounded-lg object-cover bg-white border border-emerald-200 dark:border-emerald-800 shrink-0"
              />
            ) : (
              <ShoppingBag className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 truncate block">
                {product.name}
              </span>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                Rs. {product.price.toLocaleString()}
              </span>
            </div>
          </div>
          {product.slug && (
            <Link
              to={`/product/${product.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0"
            >
              <span>View</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-900/40 min-h-[220px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
            <p className="text-xs">Loading conversation history...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12 text-center px-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mb-3">
              <Store className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Start a direct conversation
            </p>
            <p className="text-xs text-slate-500 max-w-xs">
              Ask about product availability, custom orders, delivery times, or store policies directly.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.is_mine;
            const isSystem = msg.sender_role === 'SYSTEM';

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center my-2">
                  <span className="px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] text-slate-600 dark:text-slate-400">
                    {msg.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-end gap-1.5 max-w-[85%] sm:max-w-[75%]">
                  <div
                    className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-2xs break-words ${
                      isMine
                        ? 'bg-emerald-600 text-white rounded-br-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <div
                      className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                        isMine ? 'text-emerald-100' : 'text-slate-400'
                      }`}
                    >
                      <span>{formatMessageTime(msg.created_at)}</span>
                      {isMine && (
                        msg.is_read ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-200" title="Read" />
                        ) : (
                          <Check className="w-3.5 h-3.5 text-emerald-200/80" title="Delivered" />
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error alert if any */}
      {error && (
        <div className="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900/60 text-red-600 dark:text-red-400 text-xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 cursor-pointer text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Message Input Footer */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (Enter to send)"
            rows={compact ? 1 : 2}
            maxLength={2000}
            disabled={sending}
            className="flex-1 resize-none px-3.5 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 text-slate-900 dark:text-white placeholder-slate-400 transition"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || sending}
            className={`p-2.5 sm:px-4 sm:py-2.5 rounded-xl text-white font-medium text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer shrink-0 ${
              !inputText.trim() || sending
                ? 'bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none'
                : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95'
            }`}
          >
            {sending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </div>
        {inputText.length > 1800 && (
          <div className="text-[10px] text-right text-amber-600 mt-1">
            {2000 - inputText.length} characters remaining
          </div>
        )}
      </form>
    </div>
  );
};
