import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Search,
  Store,
  Loader2,
  Clock,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react';
import { messagingService } from '../../services/messagingService';
import { ConversationItem } from '../../types/messaging';
import { ChatWindow } from '../chat/ChatWindow';

interface CustomerMessagesTabProps {
  onOpenStore?: (slug: string) => void;
}

export const CustomerMessagesTab: React.FC<CustomerMessagesTabProps> = ({ onOpenStore }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedConvIdFromUrl = searchParams.get('conv');

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(selectedConvIdFromUrl);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  const loadConversations = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await messagingService.getConversations('customer', searchQuery);
      if (!isMounted.current) return;

      const data = Array.isArray(res) ? res : ((res as any)?.results ?? (res as any)?.data ?? []);
      setConversations(data);
      setError(null);

      // If URL has conv id and it exists in data, select it
      if (selectedConvIdFromUrl && data.some((c) => c?.id === selectedConvIdFromUrl)) {
        setSelectedConvId(selectedConvIdFromUrl);
      } else if (!selectedConvId && (data?.length ?? 0) > 0 && window.innerWidth >= 768) {
        // On desktop, auto-select first conversation
        setSelectedConvId(data[0].id);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'Failed to load conversations');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [searchQuery, selectedConvIdFromUrl, selectedConvId]);

  useEffect(() => {
    isMounted.current = true;
    loadConversations();

    const interval = setInterval(() => {
      if (!document.hidden) {
        loadConversations(true);
      }
    }, 8000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [loadConversations]);

  const handleSelectConversation = (conv: ConversationItem) => {
    setSelectedConvId(conv.id);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('tab', 'messages');
    newParams.set('conv', conv.id);
    setSearchParams(newParams, { replace: true });

    // Mark as locally read
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
  };

  const handleBackToList = () => {
    setSelectedConvId(null);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('conv');
    setSearchParams(newParams, { replace: true });
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConvId);

  const formatLastTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-2xs overflow-hidden flex flex-col md:flex-row h-[700px] max-h-[82vh]">
      {/* Left Pane: Conversation List */}
      <div
        className={`w-full md:w-[340px] lg:w-[380px] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/50 dark:bg-slate-900/60 ${
          selectedConvId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Header & Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                Store Messages
              </h2>
            </div>
            <button
              type="button"
              onClick={() => loadConversations(false)}
              disabled={loading || refreshing}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* List of Conversations */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 mb-2" />
              <p className="text-xs">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Store className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No conversations yet
              </p>
              <p className="text-xs text-slate-400 mt-1">
                When you click "Message" on any store or vendor page, your direct chats will appear here.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const hasUnread = conv.unread_count > 0;
              const storeLogo = conv.store_logo_url;
              const storeName = conv.store_name || conv.vendor_name || 'Store';

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-600'
                      : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    {storeLogo ? (
                      <img
                        src={storeLogo}
                        alt={storeName}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
                        <Store className="w-5 h-5" />
                      </div>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center shadow-xs">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4
                        className={`text-sm truncate ${
                          hasUnread
                            ? 'font-extrabold text-slate-900 dark:text-white'
                            : 'font-semibold text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {storeName}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {formatLastTime(conv.last_message_at)}
                      </span>
                    </div>

                    <p
                      className={`text-xs truncate ${
                        hasUnread
                          ? 'font-bold text-slate-900 dark:text-slate-100'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {conv.last_message_preview || 'No messages yet'}
                    </p>

                    {conv.product_context && (
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 truncate">
                        <ShoppingBag className="w-3 h-3 shrink-0" />
                        <span className="truncate">{conv.product_context.name}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Right Pane: Chat Window or Placeholder */}
      <div
        className={`flex-1 flex flex-col h-full bg-white dark:bg-slate-900 ${
          !selectedConvId ? 'hidden md:flex' : 'flex'
        }`}
      >
        {selectedConvId ? (
          <div className="flex-1 flex flex-col h-full">
            {/* Mobile Back Button Bar */}
            <div className="md:hidden px-3 py-2 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <button
                type="button"
                onClick={handleBackToList}
                className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Conversations</span>
              </button>
            </div>

            <ChatWindow
              conversationId={selectedConvId}
              initialConversation={selectedConversation}
              asRole="customer"
              className="rounded-none border-0 shadow-none h-full flex-1"
              onNewMessageSent={(newMsg) => {
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === selectedConvId
                      ? {
                          ...c,
                          last_message_preview: newMsg.content,
                          last_message_at: newMsg.created_at,
                          last_message_sender_role: newMsg.sender_role,
                        }
                      : c
                  )
                );
              }}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
            <div className="w-16 h-16 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 dark:text-slate-500 mb-4">
              <MessageSquare className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-slate-200 mb-1">
              Select a store conversation
            </h3>
            <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
              Choose a store from the list on the left to review your chat history or send a direct message.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
