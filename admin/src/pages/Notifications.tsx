import { useEffect, useState } from 'react';
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { PageHeader, Card, Field, DataTable, Modal, YesNo, useToast } from '../ui';
import { api, useLoad, type AdminSettings } from '../api';

interface AdminNotification { id: number; title: string; message: string; active: number; at: string }
interface Form { id?: number; title: string; message: string; active: boolean }

/** The scrolling text on the app's home screen. */
function FloatingText() {
  const toast = useToast();
  const { data } = useLoad<AdminSettings>('/admin/settings');
  const [text, setText] = useState('');
  useEffect(() => { if (data) setText(data.ticker); }, [data]);

  const save = async () => {
    try {
      await api('PUT', '/admin/settings', { ticker: text });
      toast('Saved. The app shows the new text within 30 seconds.');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <Card>
      <h5 className="card-title">Floating Text</h5>
      <div className="card-sub">The message that scrolls across the top of the app's home screen. Up to 300 characters.</div>
      <textarea className="textarea" style={{ minHeight: 90 }} maxLength={300} placeholder="Type the scrolling message..." value={text} onChange={(e) => setText(e.target.value)} />
      <div className="hint">{text.length}/300</div>
      <div className="ticker-preview"><span>{text || 'Preview'}</span></div>
      <button className="btn" style={{ marginTop: 14 }} onClick={save}>Save Floating Text</button>
    </Card>
  );
}

/** The name shown at the top of the app's home screen and on the login screen. */
function AppName() {
  const toast = useToast();
  const { data } = useLoad<AdminSettings>('/admin/settings');
  const [name, setName] = useState('');
  useEffect(() => { if (data) setName(data.app_name); }, [data]);

  const save = async () => {
    try {
      await api('PUT', '/admin/settings', { app_name: name });
      toast('Saved. The app shows the new name within 30 seconds.');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <Card>
      <h5 className="card-title">App Name</h5>
      <div className="card-sub">The name at the top of the app's home screen and on the login screen. Up to 30 characters.</div>
      <Field label="App Name">
        <input className="input" style={{ maxWidth: 320 }} maxLength={30} placeholder="e.g. Kalyan" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="hint">{name.length}/30</div>
      <button className="btn" style={{ marginTop: 14 }} onClick={save} disabled={!name.trim()}>Save App Name</button>
    </Card>
  );
}

/** The WhatsApp number behind the app's Support → WhatsApp Support option. */
function WhatsAppNumber() {
  const toast = useToast();
  const { data } = useLoad<AdminSettings>('/admin/settings');
  const [num, setNum] = useState('');
  useEffect(() => { if (data) setNum(data.whatsapp); }, [data]);

  const save = async () => {
    try {
      await api('PUT', '/admin/settings', { whatsapp: num });
      toast('Saved. The app uses the new WhatsApp number within 30 seconds.');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <Card>
      <h5 className="card-title">Support WhatsApp Number</h5>
      <div className="card-sub">Users who tap Support &rarr; WhatsApp Support in the app are sent to a WhatsApp chat with this number. Leave it blank to switch the option off.</div>
      <Field label="WhatsApp Number (with or without +91)">
        <input className="input" style={{ maxWidth: 320 }} inputMode="tel" maxLength={20} placeholder="e.g. 9928821585" value={num} onChange={(e) => setNum(e.target.value.replace(/[^\d+ ]/g, ''))} />
      </Field>
      <button className="btn" style={{ marginTop: 14 }} onClick={save}>Save WhatsApp Number</button>
    </Card>
  );
}

const TEXTS: [key: 'text_home' | 'text_rates' | 'text_timetable' | 'text_support' | 'text_game', label: string, hint: string][] = [
  ['text_home', 'Home Screen Info Box', 'Shown under the banner on the home screen.'],
  ['text_game', 'Game Screen Guidelines', 'Shown at the top of every game (bid) screen.'],
  ['text_rates', 'Game Rate Note', 'Shown at the top of the Game Rate screen.'],
  ['text_timetable', 'Time Table Note', 'Shown at the top of the Time Table screen.'],
  ['text_support', 'Support Popup Message', 'Shown inside the Support Center popup.'],
];

/** Short messages for individual app screens. A blank one is hidden in the app. */
function ScreenTexts() {
  const toast = useToast();
  const { data } = useLoad<AdminSettings>('/admin/settings');
  const [edits, setEdits] = useState<Partial<Record<(typeof TEXTS)[number][0], string>>>({});
  const value = (k: (typeof TEXTS)[number][0]) => edits[k] ?? data?.[k] ?? '';

  const save = async () => {
    try {
      await api('PUT', '/admin/settings', Object.fromEntries(TEXTS.map(([k]) => [k, value(k)])));
      toast('Saved. The app shows the new texts within 30 seconds.');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <Card>
      <h5 className="card-title">Screen Texts</h5>
      <div className="card-sub">Write short messages or guidelines for each screen. Leave one blank to hide it.</div>
      {TEXTS.map(([k, label, hint]) => (
        <Field key={k} label={label} style={{ marginBottom: 14 }}>
          <textarea className="textarea" style={{ minHeight: 70 }} maxLength={5000} disabled={!data} value={value(k)} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} />
          <div className="hint">{hint}</div>
        </Field>
      ))}
      <button className="btn" onClick={save}>Save Screen Texts</button>
    </Card>
  );
}

/** The reassurance strip on the app's Add Money page; empty lines hide the block. */
function TrustMessages() {
  const toast = useToast();
  const { data } = useLoad<AdminSettings>('/admin/settings');
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (!data) return;
    setTitle(data.trust_title);
    setNote(data.trust_note);
  }, [data]);
  const lines = note.split('\n').filter((line) => line.trim()).length;

  const save = async () => {
    try {
      await api('PUT', '/admin/settings', { trust_title: title, trust_note: note });
      toast('Saved. The app shows these messages within 10 seconds.');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <Card>
      <h5 className="card-title"><ShieldCheck size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Payment Trust &amp; Security Messages</h5>
      <div className="card-sub">Shown on the app's Add Money page, under the payment options. One message per line, up to 5; blank lines are ignored and an empty list hides the block.</div>
      <Field label="Heading" style={{ marginBottom: 14 }}>
        <input className="input" maxLength={300} disabled={!data} placeholder="Your payment is protected" value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field label={`Messages (one per line) — ${lines}/5`}>
        <textarea
          className="textarea"
          style={{ minHeight: 130 }}
          disabled={!data}
          placeholder={'Your payments are safe and secure.\nYour financial information is protected with secure payment processing.'}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <button className="btn" style={{ marginTop: 14 }} disabled={!data || lines > 5} onClick={save}>Save Payment Messages</button>
      {lines > 5 && <div className="hint">Use at most 5 lines, one message each.</div>}
    </Card>
  );
}

export function Notifications() {
  const toast = useToast();
  const { data, error, reload } = useLoad<AdminNotification[]>('/admin/notifications');
  const [modal, setModal] = useState<Form | null>(null);

  const save = async () => {
    if (!modal) return;
    try {
      const body = { title: modal.title, message: modal.message, active: modal.active };
      await (modal.id ? api('PUT', `/admin/notifications/${modal.id}`, body) : api('POST', '/admin/notifications', body));
      toast('Notification saved');
      setModal(null);
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const remove = async (n: AdminNotification) => {
    if (!confirm(`Delete "${n.title}"?`)) return;
    try {
      await api('DELETE', `/admin/notifications/${n.id}`);
      toast('Notification deleted');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Notifications" trail="Settings" current="Notifications" />
      <AppName />
      <FloatingText />
      <WhatsAppNumber />
      <ScreenTexts />
      <TrustMessages />
      <Card>
        <div className="card-head">
          <div>
            <h5 className="card-title">App Notifications</h5>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: 4 }}>Every active message shows on all users' Notifications screen, newest first.</div>
          </div>
          <button className="btn" onClick={() => setModal({ title: '', message: '', active: true })}>+ Add Notification</button>
        </div>
        <DataTable rows={data ?? []} empty={error || (data ? 'No notifications yet.' : 'Loading...')} columns={[
          { h: '#', r: (_, i) => i + 1 },
          { h: 'Title', r: (n) => <b>{n.title}</b> },
          { h: 'Message', r: (n) => n.message || '-' },
          { h: 'Date', r: (n) => n.at.slice(0, 16) },
          { h: 'Shown', r: (n) => <YesNo v={n.active} /> },
          {
            h: 'Action', r: (n) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn xs" onClick={() => setModal({ id: n.id, title: n.title, message: n.message, active: !!n.active })}><Pencil size={12} /></button>
                <button className="btn danger xs" onClick={() => remove(n)}><Trash2 size={12} /></button>
              </div>
            ),
          },
        ]} />
      </Card>
      {modal && (
        <Modal
          title={modal.id ? 'Edit Notification' : 'Add Notification'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn" onClick={save}>Submit</button>
          </>}
        >
          <Field label="Title" style={{ marginBottom: 14 }}>
            <input className="input" maxLength={100} value={modal.title} placeholder="e.g. Kalyan result delayed" onChange={(e) => setModal({ ...modal, title: e.target.value })} />
          </Field>
          <Field label="Message" style={{ marginBottom: 14 }}>
            <textarea className="textarea" style={{ minHeight: 110 }} maxLength={1000} value={modal.message} placeholder="Optional details" onChange={(e) => setModal({ ...modal, message: e.target.value })} />
          </Field>
          <label className="check"><input type="checkbox" checked={modal.active} onChange={(e) => setModal({ ...modal, active: e.target.checked })} /> Show in the app</label>
        </Modal>
      )}
    </>
  );
}
