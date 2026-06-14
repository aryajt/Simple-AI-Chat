'use client';

import { useState } from 'react';
import { useConversations } from '../hooks/useConversations';
import { Sidebar } from '../components/Sidebar';
import { ChatPanel } from '../components/ChatPanel';

export default function Home() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const { conversations, isLoading, error, createConversation, renameConversation } = useConversations();

  const handleNew = async () => {
    const created = await createConversation();
    if (created) setActiveConversationId(created.id);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        conversations={conversations}
        isLoading={isLoading}
        error={error}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewConversation={handleNew}
      />
      <ChatPanel
        conversationId={activeConversationId}
        onTitleChange={(title) => {
          if (activeConversationId) renameConversation(activeConversationId, title);
        }}
      />
    </div>
  );
}
