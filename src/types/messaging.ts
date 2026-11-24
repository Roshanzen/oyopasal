export type SenderRole = 'CUSTOMER' | 'VENDOR' | 'SYSTEM';

export interface MessageParticipant {
  id: string;
  name: string;
  subtitle?: string;
  avatar_url?: string | null;
  role: 'CUSTOMER' | 'VENDOR' | 'SYSTEM';
  store_slug?: string;
  store_name?: string;
  phone?: string;
}

export interface ProductContext {
  id: string;
  name: string;
  slug: string;
  price: number;
  image_url?: string | null;
}

export interface ConversationItem {
  id: string;
  store_name: string;
  store_slug: string;
  store_logo_url?: string | null;
  vendor_id: string;
  vendor_name: string;
  vendor_slug: string;
  customer_id: string;
  customer_name: string;
  customer_avatar_url?: string | null;
  product_context?: ProductContext | null;
  last_message_at: string;
  last_message_preview: string;
  last_message_sender_role: SenderRole | string;
  unread_count: number;
  other_party: MessageParticipant;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: SenderRole;
  content: string;
  attachment_url?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  is_mine: boolean;
}

export interface ConversationDetail extends ConversationItem {
  recent_messages: ChatMessage[];
}

export interface InitiateConversationPayload {
  store_id: string;
  product_id?: string;
  initial_message?: string;
}

export interface InitiateConversationResponse {
  success: boolean;
  is_new: boolean;
  message: string;
  conversation: ConversationDetail;
}

export interface SendMessagePayload {
  content: string;
  attachment_url?: string;
}

export interface UnreadMessagesCount {
  customer_unread: number;
  vendor_unread: number;
  total: number;
}
