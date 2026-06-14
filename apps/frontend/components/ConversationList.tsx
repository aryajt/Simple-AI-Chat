'use client';

import { ConversationDto } from '../lib/api-client';

interface ConversationListProps {
  conversations: ConversationDto[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-4">
        <p className="text-sm text-gray-500 text-center">
          No conversations yet.
          <br />
          Start a new one!
        </p>
      </div>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {conversations.map((conv) => (
        <li key={conv.id}>
          <button
            onClick={() => onSelect(conv.id)}
            className={`w-full text-left px-4 py-3 text-sm truncate transition-colors hover:bg-gray-800 ${
              conv.id === activeConversationId
                ? 'bg-gray-700 text-white font-medium'
                : 'text-gray-300'
            }`}
          >
            {conv.title}
          </button>
        </li>
      ))}
    </ul>
  );
}
