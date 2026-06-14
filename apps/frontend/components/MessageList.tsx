'use client';

import { useEffect, useRef } from 'react';
import { MessageDto } from '../lib/api-client';
import { LoadingIndicator } from './LoadingIndicator';

interface MessageListProps {
  messages: MessageDto[];
  isWaiting?: boolean;
}

export function MessageList({ messages, isWaiting = false }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isWaiting]);

  if (messages.length === 0 && !isWaiting) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-gray-500 text-sm">No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-gray-800 text-gray-100 rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

      {isWaiting && (
        <div className="flex justify-start">
          <div className="bg-gray-800 rounded-2xl rounded-bl-sm">
            <LoadingIndicator />
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
