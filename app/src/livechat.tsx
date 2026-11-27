// Live chat with the admin: the user's messages and the admin's replies, refreshed every few seconds.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { api, type SupportMessage } from './api';
import { PageHeader } from './screens';
import { useT } from './i18n';

const timeOf = (at: string) => at.slice(11, 16);
const dayOf = (at: string) => at.slice(0, 10).split('-').reverse().join('-');

export function LiveChatScreen({ onBack }: { onBack: () => void }) {
  const t = useT();
  const [messages, setMessages] = useState<SupportMessage[] | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  useEffect(() => {
    const load = () => api<SupportMessage[]>('GET', '/support/messages').then(setMessages).catch((err: Error) => setError(err.message));
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  // Scroll down only when a message arrives, so reading older ones is not interrupted.
  useEffect(() => {
    if (messages && messages.length !== count.current) {
      count.current = messages.length;
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await api('POST', '/support/messages', { text: body });
      setText('');
      setError('');
      setMessages(await api<SupportMessage[]>('GET', '/support/messages'));
    } catch (err) {
      setError((err as Error).message);
    }
    setSending(false);
  };

  return (
    <div className="phone sub chat">
      <PageHeader title="LIVE CHAT" subtitle="Chat with our support team" onBack={onBack} right={<MessageCircle size={24} />} />
      <div className="chat-list">
        {!messages && <div className="info-box">{error || t('Loading...')}</div>}
        {messages?.length === 0 && <div className="info-box">{t('Say hello. Our team will reply here.')}</div>}
        {messages?.map((m, i) => (
          <div key={m.id}>
            {(i === 0 || dayOf(messages[i - 1].at) !== dayOf(m.at)) && <div className="chat-day">{dayOf(m.at)}</div>}
            <div className={`chat-msg ${m.sender}`}>
              <span>{m.text}</span>
              <small>{timeOf(m.at)}</small>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      {error && messages && <div className="auth-error chat-error">{error}</div>}
      <form className="chat-form" onSubmit={send}>
        <input value={text} maxLength={1000} placeholder={t('Type your message...')} onChange={(e) => { setText(e.target.value); setError(''); }} />
        <button className="chat-send" disabled={!text.trim() || sending} aria-label="Send"><Send size={22} /></button>
      </form>
    </div>
  );
}
