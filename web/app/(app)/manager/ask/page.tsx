'use client';
import ChatPanel from '@/components/ChatPanel';
import { Skeleton } from '@/components/widgets';
import { useJson } from '@/lib/data';
import type { ChatItem } from '@/lib/types';

export default function ManagerAsk() {
  const items = useJson<ChatItem[]>('chat_manager');
  return items ? <ChatPanel items={items} title="اسأل الوكيل" /> : <div className="p-6"><Skeleton h={200} /></div>;
}
