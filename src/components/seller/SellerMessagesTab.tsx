import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  MessageSquare,
  Search,
  User,
  Loader2,
  RefreshCw,
  ShoppingBag,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { messagingService } from '../../services/messagingService';
import { ConversationItem } from '../../types/messaging';
import { ChatWindow } from '../chat/ChatWindow';

interface SellerMessagesTabProps {
  vendorId?: string;
  vendorName?: string;
  syncTrigger?: number;
}

export const SellerMessagesTab: React.FC<SellerMessagesTabProps> = ({ vendorName, syncTrigger }) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);

  const loadConversations = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const res = await messagingService.getConversations('vendor', searchQuery);
      if (!isMounted.current) return;

      const data = Array.isArray(res) ? res : ((res as any)?.results ?? (res as any)?.data ?? []);
      setConversations(data);
      setError(null);

      if (!selectedConvId && (data?.length ?? 0) > 0 && window.innerWidth >= 768) {
        setSelectedConvId(data[0].id);
      }
    } catch (err: any) {
      if (isMounted.current) {
        setError(err.message || 'Failed to load customer messages');
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [searchQuery, selectedConvId]);

  useEffect(() => {
    if (syncTrigger !== undefined && syncTrigger > 0) {
      loadConversations(true);
    }
  }, [syncTrigger, loadConversations]);

  useEffect(() => {
    isMounted.current = true;
    loadConversations();

    // Real-time polling every 4 seconds while open
    const interval = setInterval(() => {
      if (!document.hidden) {
        loadConversations(true);
      }
    }, 4000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, [loadConversations]);

  const handleSelectConversation = (conv: ConversationItem) => {
    setSelectedConvId(conv.id);
    // Mark as locally read
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
    );
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
    <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col md:flex-row h-[720px] max-h-[84vh] shadow-sm">
      {/* Left Pane: Customer Inquiries List */}
      <div
        className={`w-full md:w-[340px] lg:w-[380px] border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 bg-slate-50/70 dark:bg-slate-950/60 ${selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
      >
        {/* Header & Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-extrabold text-base text-slate-900 dark:text-white">
                Customer Inquiries
              </h2>
            </div>
            <button
              type="button"
              onClick={() => loadConversations(false)}
              disabled={loading || refreshing}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Refresh messages"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customers or messages..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-emerald-600 dark:text-emerald-400 mb-2" />
              <p className="text-xs">Loading inquiries...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <User className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                No customer messages yet
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Direct messages sent by shoppers from your store page will appear here.
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isSelected = conv.id === selectedConvId;
              const hasUnread = conv.unread_count > 0;
              const customerName = conv.customer_name || 'Customer';
              const customerAvatar = conv.customer_avatar_url;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-3.5 text-left transition-colors flex items-start gap-3 cursor-pointer ${isSelected
                    ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-l-4 border-emerald-500'
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                    }`}
                >
                  <div className="relative shrink-0 mt-0.5">
                    {customerAvatar ? (
                      <img
                        src={customerAvatar}
                        alt={customerName}
                        className="w-11 h-11 rounded-full object-cover border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-slate-700">
                        <User className="w-5 h-5" />
                      </div>
                    )}
                    {hasUnread && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-slate-950 rounded-full text-[10px] font-extrabold flex items-center justify-center shadow-xs">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <h4
                        className={`text-sm truncate ${hasUnread
                          ? 'font-extrabold text-slate-900 dark:text-white'
                          : 'font-semibold text-slate-700 dark:text-slate-300'
                          }`}
                      >
                        {customerName}
                      </h4>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                        {formatLastTime(conv.last_message_at)}
                      </span>
                    </div>

                    <p
                      className={`text-xs truncate ${hasUnread
                        ? 'font-bold text-slate-900 dark:text-slate-200'
                        : 'text-slate-500 dark:text-slate-400'
                        }`}
                    >
                      {conv.last_message_preview || 'No messages'}
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

      {/* Right Pane: Vendor Chat Window */}
      <div
        className={`flex-1 flex flex-col h-full bg-white dark:bg-[#0F172A] ${!selectedConvId ? 'hidden md:flex' : 'flex'
          }`}
      >
        {selectedConvId ? (
          <div className="flex-1 flex flex-col h-full">
            {/* Mobile Back Button Bar */}
            <div className="md:hidden px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedConvId(null)}
                className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>All Customer Inquiries</span>
              </button>
            </div>

            <ChatWindow
              conversationId={selectedConvId}
              initialConversation={selectedConversation}
              asRole="vendor"
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
              Select a customer inquiry
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Click any customer on the left to view questions about your products, fulfillment, or store inquiries.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
