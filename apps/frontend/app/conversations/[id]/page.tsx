'use client';

import { useParams } from 'next/navigation';
import { ChatPanel } from '../../../components/ChatPanel';

export default function ConversationPage() {
  const params = useParams();
  const conversationId = typeof params.id === 'string' ? params.id : null;

  return <ChatPanel conversationId={conversationId} />;
}
