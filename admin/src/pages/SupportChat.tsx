import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, MessageSquare, Send } from 'lucide-react';
import { PageHeader, useToast } from '../ui';
import { api } from '../api';

interface Chat { id: number; name: string; mobile: string; last: string; lastBy: 'user' | 'admin'; at: string; unread: number }
interface Message { id: number; sender: 'user' | 'admin'; text: string; at: string }

const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** Time for today's messages, date for older ones. */
const when = (at: string) => (at.slice(0, 10) === localDate(new Date()) ? at.slice(11, 16) : at.slice(0, 10).split('-').reverse().join('/'));

/** All support chats: the list on the left (pending ones flagged), the open conversation on the right. */
export function SupportChat() {
  const toast = useToast();
  const [chats, setChats] = useState<Chat[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const count = useRef(0);

  const loadChats = () => api<Chat[]>('GET', '/admin/support/chats').then(setChats).catch((err: Error) => setError(err.message));
  const loadMessages = (id: number) => api<Message[]>('GET', `/admin/support/chats/${id}`).then(setMessages).catch(() => {});

  useEffect(() => {
    loadChats();
    const t = setInterval(loadChats, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (openId === null) return;
    count.current = 0;
    setMessages([]);
    loadMessages(openId);
    const t = setInterval(() => loadMessages(openId), 4000);
    return () => clearInterval(t);
  }, [openId]);

  useEffect(() => {
    if (messages.length !== count.current) {
      count.current = messages.length;
      end.current?.scrollIntoView({ block: 'end' });
    }
  }, [messages]);

  const open = chats?.find((c) => c.id === openId);
  const rows = (chats ?? []).filter((c) => (!pendingOnly || c.unread > 0)
    && `${c.name} ${c.mobile}`.toLowerCase().includes(q.toLowerCase()));
  const pending = (chats ?? []).filter((c) => c.unread > 0).length;

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || openId === null || sending) return;
    setSending(true);
    try {
      await api('POST', `/admin/support/chats/${openId}`, { text: body });
      setText('');
      await Promise.all([loadMessages(openId), loadChats()]);
    } catch (err) {
      toast((err as Error).message);
    }
    setSending(false);
  };

  return (
    <>
      <PageHeader title="Live Support Chat" trail="Support" current="Live Support Chat" />
      <div className={'sc-grid' + (openId !== null ? ' has-chat' : '')}>
        <div className="sc-list">
          <input className="input" placeholder="Search user..." value={q} onChange={(e) => setQ(e.target.value)} />
          <label className="check" style={{ margin: '10px 2px' }}>
            <input type="checkbox" checked={pendingOnly} onChange={(e) => setPendingOnly(e.target.checked)} /> Pending only ({pending})
          </label>
          {!chats && <div className="sc-empty">{error || 'Loading...'}</div>}
          {chats && !rows.length && <div className="sc-empty">{chats.length ? 'No chats match.' : 'No messages from users yet.'}</div>}
          {rows.map((c) => (
            <button key={c.id} className={'sc-item' + (c.id === openId ? ' on' : '')} onClick={() => setOpenId(c.id)}>
              <div className="sc-top">
                <b>{c.name} <small>({c.mobile})</small></b>
                <span>{when(c.at)}</span>
              </div>
              <div className="sc-bottom">
                <span className="sc-last">{c.lastBy === 'admin' ? 'You: ' : ''}{c.last}</span>
                {c.unread > 0 && <span className="sc-badge">{c.unread}</span>}
              </div>
            </button>
          ))}
        </div>

        <div className="sc-chat">
          {!open ? (
            <div className="sc-placeholder"><MessageSquare size={44} /><span>Select a user to start chatting</span></div>
          ) : (
            <>
              <div className="sc-head">
                <button className="sc-back" onClick={() => setOpenId(null)} aria-label="Back"><ArrowLeft size={18} /></button>
                <b>{open.name}</b> <small>{open.mobile}</small>
              </div>
              <div className="sc-messages">
                {messages.map((m) => (
                  <div key={m.id} className={`sc-msg ${m.sender}`}>
                    <span>{m.text}</span>
                    <small>{m.at.slice(0, 10).split('-').reverse().join('/')} {m.at.slice(11, 16)}</small>
                  </div>
                ))}
                <div ref={end} />
              </div>
              <form className="sc-form" onSubmit={send}>
                <input className="input" maxLength={1000} placeholder="Type a reply..." value={text} onChange={(e) => setText(e.target.value)} />
                <button className="btn" disabled={!text.trim() || sending}><Send size={16} /> Send</button>
              </form>
            </>
          )}
        </div>
      </div>
    </>
  );
}
