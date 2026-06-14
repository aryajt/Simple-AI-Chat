'use client';

import { useState } from 'react';
import { useMessages } from '../hooks/useMessages';
import { useSSE } from '../hooks/useSSE';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

interface ChatPanelProps {
  conversationId: string | null;
  onTitleChange?: (title: string) => void;
}

export function ChatPanel({ conversationId, onTitleChange }: ChatPanelProps) {
  const { messages, appendMessage } = useMessages(conversationId);
  const [isWaiting, setIsWaiting] = useState(false);

  useSSE(conversationId, (msg) => {
    appendMessage(msg);
    setIsWaiting(false);
  });

  if (!conversationId) {
    return (
      <main className="flex-1 flex items-center justify-center bg-gray-950">
        <p className="text-gray-500 text-sm">Select a conversation or start a new one</p>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-gray-950 min-h-0">
      <MessageList messages={messages} isWaiting={isWaiting} />
      <MessageInput
        conversationId={conversationId}
        isDisabled={isWaiting}
        onMessageSent={(userMessage) => {
          // Rename the conversation to the first message the user sends
          if (messages.length === 0 && onTitleChange) {
            onTitleChange(userMessage.content.trim().substring(0, 255));
          }
          appendMessage(userMessage);
          setIsWaiting(true);
        }}
        onError={() => setIsWaiting(false)}
      />
    </main>
  );
}
