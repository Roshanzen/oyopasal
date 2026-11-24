import { httpClient } from './httpClient';
import {
  ConversationItem,
  ConversationDetail,
  ChatMessage,
  InitiateConversationPayload,
  InitiateConversationResponse,
  SendMessagePayload,
  UnreadMessagesCount,
} from '../types/messaging';

export const messagingService = {
  /**
   * Find existing or initiate a new conversation with a store/vendor.
   * Atomic and prevents duplicate threads between customer and vendor for the same store.
   */
  async initiateConversation(
    payload: InitiateConversationPayload,
    asRole: 'customer' | 'vendor' = 'customer'
  ): Promise<InitiateConversationResponse> {
    return httpClient.request<InitiateConversationResponse>(
      '/messaging/conversations/initiate/',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      asRole === 'vendor'
    );
  },

  /**
   * List conversations for current authenticated user.
   * Can scope by role ('customer' or 'vendor') and query term 'q'.
   */
  async getConversations(
    role: 'customer' | 'vendor' = 'customer',
    q?: string
  ): Promise<ConversationItem[]> {
    const params = new URLSearchParams();
    if (role) params.set('as_role', role);
    if (q && q.trim()) params.set('q', q.trim());
    const queryString = params.toString() ? `?${params.toString()}` : '';

    interface PaginatedResponse {
      results?: ConversationItem[];
      data?: ConversationItem[];
      conversations?: ConversationItem[];
    }

    const response = await httpClient.request<PaginatedResponse | ConversationItem[]>(
      `/messaging/conversations/${queryString}`,
      { method: 'GET' },
      role === 'vendor'
    );

    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray(response.results)) {
      return response.results;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    if (response && Array.isArray(response.conversations)) {
      return response.conversations;
    }
    return [];
  },

  /**
   * Get detail for a specific conversation.
   * Reading automatically marks unread messages as read on the backend.
   */
  async getConversationDetail(
    id: string,
    asRole: 'customer' | 'vendor' = 'customer'
  ): Promise<ConversationDetail> {
    const response = await httpClient.request<{ success: boolean; conversation: ConversationDetail }>(
      `/messaging/conversations/${id}/`,
      { method: 'GET' },
      asRole === 'vendor'
    );
    return response.conversation;
  },

  /**
   * Get paginated messages for a conversation.
   */
  async getMessages(
    conversationId: string,
    limit: number = 50,
    asRole: 'customer' | 'vendor' = 'customer'
  ): Promise<ChatMessage[]> {
    interface PaginatedMessages {
      results?: ChatMessage[];
      data?: ChatMessage[];
      messages?: ChatMessage[];
    }

    const response = await httpClient.request<PaginatedMessages | ChatMessage[]>(
      `/messaging/conversations/${conversationId}/messages/?limit=${limit}`,
      { method: 'GET' },
      asRole === 'vendor'
    );

    if (Array.isArray(response)) {
      return response;
    }
    if (response && Array.isArray((response as any).messages)) {
      return (response as any).messages;
    }
    if (response && Array.isArray(response.data)) {
      return response.data;
    }
    if (response && Array.isArray(response.results)) {
      return response.results;
    }
    return [];
  },

  /**
   * Send a new message to a conversation.
   */
  async sendMessage(
    conversationId: string,
    payload: SendMessagePayload,
    asRole: 'customer' | 'vendor' = 'customer'
  ): Promise<ChatMessage> {
    const response = await httpClient.request<{ success: boolean; message: string; data: ChatMessage }>(
      `/messaging/conversations/${conversationId}/messages/`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      asRole === 'vendor'
    );
    return (response as any)?.data || (response as any)?.message_data || response;
  },

  /**
   * Explicitly mark conversation as read.
   */
  async markAsRead(
    conversationId: string,
    asRole: 'customer' | 'vendor' = 'customer'
  ): Promise<void> {
    await httpClient.request(
      `/messaging/conversations/${conversationId}/read/`,
      {
        method: 'POST',
      },
      asRole === 'vendor'
    );
  },

  /**
   * Retrieve total unread messages count for badges.
   * Pauses polling when the user is logged out (no token) and handles 401s gracefully.
   */
  async getUnreadCount(asRole: 'customer' | 'vendor' = 'customer'): Promise<UnreadMessagesCount> {
    const token = asRole === 'vendor' ? (httpClient.getSellerToken() || httpClient.getToken()) : httpClient.getToken();
    if (!token) {
      return { customer_unread: 0, vendor_unread: 0, total: 0 };
    }
    try {
      const response = await httpClient.request<{ success: boolean; data: UnreadMessagesCount }>(
        '/messaging/unread-count/',
        { method: 'GET', silent401: true },
        asRole === 'vendor'
      );
      return response?.data ?? (response as any) ?? { customer_unread: 0, vendor_unread: 0, total: 0 };
    } catch {
      return { customer_unread: 0, vendor_unread: 0, total: 0 };
    }
  },
};
