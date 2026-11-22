'use client';
import ChatPanel from '@/components/ChatPanel';
import { Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import type { ChatItem } from '@/lib/types';

export default function SupervisorAsk() {
  const items = useJson<ChatItem[]>('chat_supervisor');
  return items ? <ChatPanel items={items} title="اسأل الوكيل" /> : <div className="p-6"><Skeleton h={200} /></div>;
}
