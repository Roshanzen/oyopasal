import React from 'react';
import { ChatWindow } from './ChatWindow';
import { ConversationDetail, ConversationItem } from '../../types/messaging';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  initialConversation?: ConversationDetail | ConversationItem | null;
  asRole?: 'customer' | 'vendor';
}

export const ChatModal: React.FC<ChatModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  initialConversation,
  asRole = 'customer',
}) => {
  if (!isOpen || !conversationId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dimmed backdrop on mobile */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity sm:hidden"
        onClick={onClose}
      />

      {/* Floating Widget / Slide-over container */}
      <div className="fixed inset-x-0 bottom-0 sm:bottom-4 sm:right-4 sm:left-auto w-full sm:w-[420px] max-w-full h-[90vh] sm:h-[580px] max-h-[92vh] z-50 flex flex-col pointer-events-auto">
        <ChatWindow
          conversationId={conversationId}
          initialConversation={initialConversation}
          onClose={onClose}
          asRole={asRole}
          compact
          className="shadow-2xl h-full border-t sm:border border-slate-300 dark:border-slate-700 rounded-t-2xl sm:rounded-2xl"
        />
      </div>
    </div>
  );
};
