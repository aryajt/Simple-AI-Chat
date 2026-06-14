'use client';

import { useEffect } from 'react';
import { MessageDto } from '../lib/api-client';

const SSE_BASE = process.env.NEXT_PUBLIC_SSE_URL ?? 'http://localhost:3000';

export function useSSE(
  conversationId: string | null,
  onMessage: (message: MessageDto) => void,
) {
  useEffect(() => {
    if (!conversationId) return;

    const url = `${SSE_BASE}/conversations/${conversationId}/events`;
    const source = new EventSource(url);

    source.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as MessageDto;
        onMessage(message);
      } catch (err) {
        console.warn('useSSE: failed to parse message', err);
      }
    };

    source.onerror = (err) => {
      console.warn('useSSE: connection error', err);
      // EventSource automatically reconnects
    };

    return () => {
      source.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);
}
