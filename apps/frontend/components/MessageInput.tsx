'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { sendMessage, MessageDto } from '../lib/api-client';

interface MessageInputProps {
  conversationId: string;
  isDisabled: boolean;
  onMessageSent: (userMessage: MessageDto) => void;
  onError: () => void;
}

export function MessageInput({
  conversationId,
  isDisabled,
  onMessageSent,
  onError,
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || isDisabled) return;

    setContent('');
    setError(null);

    try {
      const userMessage = await sendMessage(conversationId, trimmed);
      onMessageSent(userMessage);
    } catch (err: any) {
      setError(err.message ?? 'Failed to send message');
      onError();
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-800 p-4">
      {error && (
        <div className="mb-2 px-3 py-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-xs">
          {error}
        </div>
      )}
      <div className="flex gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          placeholder={isDisabled ? 'Waiting for response…' : 'Type a message…'}
          rows={1}
          className="flex-1 resize-none bg-gray-800 text-gray-100 placeholder-gray-500 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed max-h-40 overflow-y-auto"
          style={{ minHeight: '48px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={isDisabled || !content.trim()}
          className="shrink-0 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  );
}
