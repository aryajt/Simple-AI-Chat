'use client';

import { useState, useEffect } from 'react';
import { getMessages, MessageDto } from '../lib/api-client';

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    getMessages(conversationId)
      .then((data) => {
        if (!cancelled) {
          setMessages(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load messages');
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  const appendMessage = (message: MessageDto) => {
    setMessages((prev) => [...prev, message]);
  };

  return { messages, isLoading, error, setMessages, appendMessage };
}
