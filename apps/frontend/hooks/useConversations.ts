'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getConversations,
  createConversation as apiCreateConversation,
  updateConversationTitle,
  ConversationDto,
} from '../lib/api-client';

export function useConversations() {
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getConversations()
      .then((data) => {
        if (!cancelled) {
          setConversations(data);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message ?? 'Failed to load conversations');
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const createConversation = useCallback(async (title?: string) => {
    // Optimistic: create a temporary entry
    const tempId = `temp-${Date.now()}`;
    const optimistic: ConversationDto = {
      id: tempId,
      title: title ?? 'New Conversation',
      createdAt: new Date().toISOString(),
    };
    setConversations((prev) => [optimistic, ...prev]);
    setError(null);

    try {
      const created = await apiCreateConversation(title);
      // Replace optimistic entry with real one
      setConversations((prev) =>
        prev.map((c) => (c.id === tempId ? created : c)),
      );
      return created;
    } catch (err: any) {
      // Roll back optimistic entry
      setConversations((prev) => prev.filter((c) => c.id !== tempId));
      setError(err.message ?? 'Failed to create conversation');
      return null;
    }
  }, []);

  const renameConversation = useCallback(async (id: string, title: string) => {
    // Optimistically update the sidebar title immediately
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title } : c)),
    );
    try {
      const updated = await updateConversationTitle(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? updated : c)),
      );
    } catch {
      // Non-critical — title will correct itself on next page load
    }
  }, []);

  return { conversations, isLoading, error, createConversation, renameConversation };
}
