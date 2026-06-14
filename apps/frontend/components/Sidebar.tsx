'use client';

import { ConversationDto } from '../lib/api-client';
import { ConversationList } from './ConversationList';

interface SidebarProps {
  conversations: ConversationDto[];
  isLoading: boolean;
  error: string | null;
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
}

export function Sidebar({
  conversations,
  isLoading,
  error,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
}: SidebarProps) {
  return (
    <aside className="w-64 flex flex-col bg-gray-900 border-r border-gray-800 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <h1 className="text-lg font-semibold text-white mb-3">Nikan AI Chat</h1>
        <button
          onClick={onNewConversation}
          className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Conversation
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-3 mt-3 px-3 py-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
          {error}
        </div>
      )}

      {/* Conversation list */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-gray-500 text-sm">Loading…</span>
        </div>
      ) : (
        <ConversationList
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelect={onSelectConversation}
        />
      )}
    </aside>
  );
}
