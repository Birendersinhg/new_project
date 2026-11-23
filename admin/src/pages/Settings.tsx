import { useState } from 'react';
import { Zap, Globe, Smartphone, PlayCircle, Gift, UserPlus, CreditCard, RefreshCw, Target, Dices, Check } from 'lucide-react';
import { PageHeader, Card, Field, DataTable, Modal, useDemo, useToast } from '../ui';
import { api, useLoad, type AdminSettings, type Slider } from '../api';

type TextSetting = Exclude<keyof AdminSettings, 'rates' | 'sliders'>;

/** Settings that the app reads live from the server; edited here and saved with one PUT. */
function useSettingsForm() {
  const toast = useToast();
  const { data, error } = useLoad<AdminSettings>('/admin/settings');
  const [edits, setEdits] = useState<Partial<Record<TextSetting, string>>>({});
  const value = (k: TextSetting) => edits[k] ?? data?.[k] ?? '';
  const input = (k: TextSetting, numeric = false) => ({
    value: value(k),
    disabled: !data,
    onChange: (e: { target: { value: string } }) => setEdits({ ...edits, [k]: numeric ? e.target.value.replace(/\D/g, '') : e.target.value }),
  });
  const set = (k: TextSetting, v: string) => setEdits({ ...edits, [k]: v });
  const save = async (keys: TextSetting[], done: string) => {
    try {
      await api('PUT', '/admin/settings', Object.fromEntries(keys.map((k) => [k, value(k)])));
      toast(done);
    } catch (err) {
      toast((err as Error).message);
    }
  };
  return { input, set, save, error, value };
}

// Labels in the "Add Value's" card that are connected to the app.
const LIVE_VALUES: Record<string, TextSetting> = {
  'Minimum Bid Amount': 'min_bid',
  'Maximum Bid Amount': 'max_bid',
  'Welcome Bonus': 'welcome_bonus',
};

export function AutoActive() {
  const toast = useToast();
  const { data, error, reload } = useLoad<AdminSettings>('/admin/settings');
  const [mode, setMode] = useState<'gaming' | 'quiz' | null>(null);
  const [timer, setTimer] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const current = mode ?? data?.app_mode ?? 'gaming';
  const currentTimer = timer ?? data?.quiz_timer ?? '20';

  const save = async () => {
    setSaving(true);
    try {
      await api('PUT', '/admin/settings', { app_mode: current, quiz_timer: currentTimer });
      toast(current === 'quiz' ? 'Quiz App Mode is live for every user' : 'Gaming Mode is live for every user');
      setMode(null);
      setTimer(null);
      reload();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', color: 'var(--heading)' }}>Auto Active Mode Configuration</h2>
          <div style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: 4 }}>Choose what the user app shows after login: the gaming app or the quiz app.</div>
        </div>
        <div className="crumbs">Dashboard / <span style={{ fontWeight: 600 }}>Auto Active</span></div>
      </div>
      <Card style={{ maxWidth: 720 }}>
        <div className="section-title" style={{ marginBottom: 22 }}>
          <div className="ic" style={{ background: 'var(--primary-soft)', color: 'var(--primary)', width: 42, height: 42 }}><Zap size={20} /></div>
          <div><h5>Auto Active Mode Status</h5><small>{error || (data ? `Currently live: ${data.app_mode === 'quiz' ? 'Quiz App Mode' : 'Gaming Mode'}` : 'Loading current mode...')}</small></div>
        </div>
        <label className={'radio-card' + (current === 'gaming' ? ' on' : '')} onClick={() => setMode('gaming')}>
          <input type="radio" name="app_mode" checked={current === 'gaming'} onChange={() => setMode('gaming')} />
          <div>
            <h6 style={{ color: 'var(--primary-dark)' }}>ON - Direct Play Game <span className="chip" style={{ background: 'var(--primary-soft)', color: 'var(--primary-dark)' }}>Live Gaming Mode</span></h6>
            <p>Users see the gaming dashboard with markets, live bidding and the wallet system after login.</p>
          </div>
        </label>
        <label className={'radio-card' + (current === 'quiz' ? ' on' : '')} onClick={() => setMode('quiz')}>
          <input type="radio" name="app_mode" checked={current === 'quiz'} onChange={() => setMode('quiz')} />
          <div>
            <h6 style={{ color: '#9a3412' }}>OFF - Quiz App Mode <span className="chip" style={{ background: '#ffedd5', color: '#9a3412' }}>Quiz &amp; Q&amp;A Display</span></h6>
            <p>Users see the quiz app instead of the gaming dashboard: 6 subjects, 3 difficulty levels, 5 questions per level, a timer and a final score.</p>
          </div>
        </label>
        <Field label="Time per quiz question" style={{ maxWidth: 320, marginTop: 6 }}>
          <select className="select" value={currentTimer} disabled={!data} onChange={(e) => setTimer(e.target.value)}>
            <option value="20">20 seconds</option>
            <option value="25">25 seconds</option>
            <option value="30">30 seconds</option>
          </select>
        </Field>
        <div className="hint" style={{ marginBottom: 12 }}>
          The app checks this setting every 10 seconds, so open apps switch mode automatically without logging out. Saved with one click.
          <br />Separately, marking a single user inactive in User Management always switches that user to Quiz App Mode.
        </div>
        <button className="btn" disabled={!data || saving} style={{ padding: '12px 28px', boxShadow: '0 4px 12px rgba(0,0,0,.15)' }} onClick={save}>
          {saving ? 'Saving...' : 'Save Auto Active Settings'}
        </button>
      </Card>
    </>
  );
}

const REF_MODELS = [
  { k: 'signup', icon: Gift, title: 'Fixed One-Time Bonus on Signup', tag: 'Registration Bonus', desc: 'Referrer receives a fixed bonus amount in their wallet immediately when a new user registers using their referral phone number.' },
  { k: 'first_dep', icon: CreditCard, title: 'First Deposit Commission (%)', tag: '1st Deposit', desc: 'Referrer receives a percentage commission on the FIRST approved deposit made by the referred user.' },
  { k: 'every_dep', icon: RefreshCw, title: 'Every Deposit Commission (%)', tag: 'All Deposits', desc: 'Referrer receives a percentage commission on EVERY approved deposit made by the referred user.' },
  { k: 'first_bet', icon: Target, title: 'First Bet / Bid Commission (%)', tag: '1st Game Bid', desc: 'Referrer receives a percentage commission when the referred user places their VERY FIRST game bid.' },
  { k: 'every_bet', icon: Dices, title: 'Every Bet / Bid Commission (%)', tag: 'All Game Bids', desc: 'Referrer receives a percentage commission on EVERY game bid placed by the referred user.' },
];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function MainSettings() {
  const demo = useDemo();
  const [refOn, setRefOn] = useState(false);
  const [model, setModel] = useState('signup');
  const [days, setDays] = useState(new Set(DAYS));
  const [mpin, setMpin] = useState('off');
  const [slider, setSlider] = useState('on');
  const toggleDay = (d: string) => setDays((s) => { const n = new Set(s); n.has(d) ? n.delete(d) : n.add(d); return n; });
  const settings = useSettingsForm();

  return (
    <>
      <PageHeader title="Main Settings" trail="Settings" current="Main Settings" />
      <AdminPassword />
      <div className="grid-2" style={{ gap: 24 }}>
        <Card style={{ marginBottom: 0 }}>
          <h5 className="card-title">Add Bank Details</h5>
          <Field label="Account Holder Name" style={{ marginBottom: 14 }}><input className="input" placeholder="Account holder name" /></Field>
          <Field label="Account Number" style={{ marginBottom: 14 }}><input className="input" placeholder="Account number" /></Field>
          <Field label="IFSC Code" style={{ marginBottom: 18 }}><input className="input" placeholder="IFSC code" /></Field>
          <button className="btn" onClick={demo('Bank details saved')}>Submit</button>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <h5 className="card-title">UPI Payments (Add Fund)</h5>
          <div className="card-sub" style={{ margin: '-8px 0 14px' }}>
            The app builds UPI payment links from these details. The customer pays in their own UPI app and sends you the
            12-digit UTR; nothing is credited until you approve it under Wallet &rarr; Fund Request.
          </div>
          <Field label="UPI ID (payee) *" style={{ marginBottom: 14 }}>
            <input className="input" placeholder="shop@okhdfc" autoCapitalize="none" {...settings.input('upi_id')} />
          </Field>
          <Field label="Payee name (shown in the UPI app)" style={{ marginBottom: 14 }}>
            <input className="input" placeholder="My Shop" {...settings.input('upi_name')} />
          </Field>
          <Field label="Payment note (tn)" style={{ marginBottom: 14 }}>
            <input className="input" placeholder="Wallet top-up" {...settings.input('upi_note')} />
          </Field>
          <div className="row" style={{ marginBottom: 14 }}>
            <Field label="Minimum deposit"><input className="input" inputMode="numeric" placeholder="10" {...settings.input('min_deposit', true)} /></Field>
            <Field label="Minimum withdrawal"><input className="input" inputMode="numeric" placeholder="100" {...settings.input('min_withdraw', true)} /></Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={settings.value('upi_enabled') === '1'} onChange={(e) => settings.set('upi_enabled', e.target.checked ? '1' : '0')} />
            {' '}Show UPI payment buttons in the app
          </label>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => settings.save(['upi_id', 'upi_name', 'upi_note', 'upi_enabled', 'min_deposit', 'min_withdraw'], 'UPI settings saved. The app shows them within 10 seconds.')}>
            Save UPI Settings
          </button>
          <div className="hint" style={{ marginTop: 10 }}>{settings.error}</div>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <h5 className="card-title">M-PIN Lock Screen Setting</h5>
          <div className="card-sub" style={{ margin: '-8px 0 14px' }}>Enable or disable the 4-digit M-PIN lock screen when the user app opens.</div>
          <Field label="M-PIN Status" style={{ marginBottom: 18 }}>
            <select className="select" value={mpin} onChange={(e) => setMpin(e.target.value)} style={{ color: mpin === 'on' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              <option value="on">🟢 Active (Enable M-PIN Lock Screen)</option>
              <option value="off">🔴 Inactive (Disable M-PIN Lock Screen)</option>
            </select>
          </Field>
          <button className="btn" onClick={demo('M-PIN setting updated')}>Update M-PIN Setting</button>
        </Card>
        <Card style={{ marginBottom: 0 }}>
          <h5 className="card-title">Slider Images Display Setting</h5>
          <div className="card-sub" style={{ margin: '-8px 0 14px' }}>Show or hide the slider images on the app home page.</div>
          <Field label="Slider Display Status" style={{ marginBottom: 18 }}>
            <select className="select" value={slider} onChange={(e) => setSlider(e.target.value)} style={{ color: slider === 'on' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
              <option value="on">🟢 Active (Show Slider Images on Home Page)</option>
              <option value="off">🔴 Inactive (Hide Slider Images)</option>
            </select>
          </Field>
          <button className="btn" onClick={demo('Slider setting updated')}>Update Slider Setting</button>
        </Card>
      </div>

      <Card style={{ marginTop: 24 }}>
        <h5 className="card-title">Add Value's</h5>
        <div className="grid-4">
          {[
            'Minimum Deposite', 'Maximum Deposite', 'Minimum Withdrawal', 'Maximum Withdrawal',
            'Minimum Transfer', 'Maximum Transfer', 'Minimum Bid Amount', 'Maximum Bid Amount',
            'Welcome Bonus', 'Minimum Wallet Amount',
          ].map((l) => (
            <Field key={l} label={l}>
              {LIVE_VALUES[l]
                ? <input className="input" inputMode="numeric" placeholder="Enter amount" {...settings.input(LIVE_VALUES[l], true)} />
                : <input className="input" placeholder="Enter amount" />}
            </Field>
          ))}
          <Field label="Alert Marquee Message"><input className="input" placeholder="Scrolling message for app users" {...settings.input('ticker')} /></Field>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', margin: '14px 0 4px', flexWrap: 'wrap' }}>
          <button className="btn" onClick={() => settings.save(['min_bid', 'max_bid', 'welcome_bonus', 'ticker'], 'Saved. The app shows the new values within 10 seconds.')}>
            Save App Values
          </button>
          <span className="hint" style={{ margin: 0 }}>{settings.error || 'Saves Minimum/Maximum Bid Amount, Welcome Bonus and Alert Marquee Message to the app.'}</span>
        </div>

        <div className="panel-left blue">
          <h6><Globe size={17} color="var(--info)" /> Landing Website &amp; APK Controls</h6>
          <p className="sub">Configure the APK Download Button Link and How to Play Website Link displayed on the public landing portal.</p>
          <div className="grid-2">
            <Field label={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Smartphone size={14} /> Official APK Download Link (app_link)</span>}>
              <input className="input" placeholder="https://..." />
              <div className="hint">Controls the 'Download App' button link on landing website.</div>
            </Field>
            <Field label={<span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><PlayCircle size={14} color="var(--info)" /> How to Play Website / Video Link (how_to_play)</span>}>
              <input className="input" placeholder="https://..." />
              <div className="hint">Controls the 'How to Play' button link on landing website.</div>
            </Field>
          </div>
        </div>

        <div className="panel-left red">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h6><UserPlus size={17} color="var(--accent)" /> Referral Program &amp; Commission Settings</h6>
              <p className="sub">Configure referral commission rates, toggle system active/inactive status, and select active referral model.</p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <b style={{ fontSize: '.85rem' }}>Referral Status:</b>
              <button className="toggle-pill" style={{ background: refOn ? 'var(--success)' : 'var(--danger)' }} onClick={() => setRefOn((v) => !v)}>
                {refOn ? 'ACTIVE (Enabled)' : 'INACTIVE (Disabled)'}
              </button>
            </div>
          </div>
          <Field label="Referral Commission / Bonus Value (% or ₹) *" style={{ maxWidth: 300, marginBottom: 6 }}><input className="input" placeholder="e.g. 5" /></Field>
          <div className="hint" style={{ marginBottom: 18 }}>* For Deposit / Bid types, this value acts as Percentage (%).<br />For Signup type, this value acts as Fixed Points (₹).</div>
          <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--heading)' }}>Select Active Referral Model (Only One Can Be Active):</div>
          {REF_MODELS.map((m) => (
            <label key={m.k} className={'ref-option' + (model === m.k ? ' on' : '')}>
              <input type="radio" checked={model === m.k} onChange={() => setModel(m.k)} />
              <div className="t">
                <h6 style={{ display: 'flex', gap: 8, alignItems: 'center' }}><m.icon size={15} /> {m.title}</h6>
                <p>{m.desc}</p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span className="badge" style={{ background: 'var(--surface-3)', color: model === m.k ? 'var(--primary)' : 'var(--muted)', borderRadius: 12 }}>{m.tag}</span>
                {model === m.k && <span className="badge" style={{ background: 'var(--success)', color: '#fff', borderRadius: 12 }}><Check size={11} style={{ verticalAlign: -1 }} /> ACTIVE</span>}
              </div>
            </label>
          ))}
        </div>

        <div className="row" style={{ maxWidth: 440, marginBottom: 18 }}>
          <Field label="Withdraw Open Time"><input type="time" className="input" /></Field>
          <Field label="Withdraw Close Time"><input type="time" className="input" /></Field>
        </div>
        <div style={{ fontWeight: 600, marginBottom: 10, color: 'var(--heading)', fontSize: '.88rem' }}>Allowed Withdrawal Days:</div>
        <div className="days">
          {DAYS.map((d) => (
            <span key={d} className={'day' + (days.has(d) ? '' : ' off')} onClick={() => toggleDay(d)}>{days.has(d) ? '✓ ' : ''}{d}</span>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 22, padding: '10px 28px' }} onClick={demo('Settings saved')}>Submit</button>
      </Card>
    </>
  );
}

export function ContactSettings() {
  const settings = useSettingsForm();
  const fields = ['Mobile Number', 'WhatsApp Number', 'Landline 1 (Optional)', 'Landline 2 (Optional)', 'Email 1', 'Email 2 (Optional)', 'Facebook (Optional)', 'Twitter (Optional)'];
  const live: Record<string, TextSetting> = { 'Mobile Number': 'contact_phone', 'WhatsApp Number': 'whatsapp' };
  return (
    <>
      <PageHeader title="Contact Settings" trail="Settings" current="Contact Settings" />
      <Card style={{ maxWidth: 900 }}>
        <h5 className="card-title">Contact Settings</h5>
        <div className="grid-3">
          {fields.map((f) => (
            <Field key={f} label={f}>
              <input className="input" placeholder={f.replace(' (Optional)', '')} {...(live[f] ? settings.input(live[f]) : {})} />
            </Field>
          ))}
        </div>
        <Field label="Address" style={{ marginTop: 16 }}><textarea className="textarea" placeholder="Business address" /></Field>
        <div className="hint" style={{ marginTop: 10 }}>{settings.error || 'Mobile Number is shown on the app home screen.'}</div>
        <button className="btn" style={{ marginTop: 14, padding: '10px 28px' }} onClick={() => settings.save(['contact_phone', 'whatsapp'], 'Contact settings saved')}>Submit</button>
      </Card>
    </>
  );
}

export function SliderImages() {
  const toast = useToast();
  const { data, error, reload } = useLoad<AdminSettings>('/admin/settings');
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [order, setOrder] = useState('1');
  const sliders = data?.sliders ?? [];

  const save = async (next: Slider[], done: string) => {
    try {
      await api('PUT', '/admin/settings', { sliders: next });
      toast(done);
      reload();
      return true;
    } catch (err) {
      toast((err as Error).message);
      return false;
    }
  };
  const add = async () => {
    if (await save([...sliders, { url: url.trim(), order: Number(order) || 1 }], 'Slider image added. It shows on the app home screen.')) {
      setOpen(false);
      setUrl('');
      setOrder('1');
    }
  };

  return (
    <>
      <PageHeader title="Slider Image Management" trail="Settings" current="Slider Images" />
      <Card title="Slider Images List" right={<button className="btn" disabled={!data} onClick={() => setOpen(true)}>+ Add Slider Image</button>}>
        <DataTable rows={sliders} empty={error || (data ? 'No slider images yet. The app hides the banner until you add one.' : 'Loading...')} columns={[
          { h: '#', r: (_, i) => i + 1 },
          { h: 'Slider Image', r: (s) => <img src={s.url} alt="" style={{ width: 140, height: 70, objectFit: 'cover', borderRadius: 6 }} /> },
          { h: 'Display Order', r: (s) => s.order },
          { h: 'Link', r: (s) => <a href={s.url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>{s.url}</a> },
          { h: 'Action', r: (_, i) => <button className="btn danger xs" onClick={() => save(sliders.filter((_, j) => j !== i), 'Slider image removed')}>Delete</button> },
        ]} />
      </Card>
      {open && (
        <Modal
          title="Add Slider Image"
          onClose={() => setOpen(false)}
          width={500}
          footer={<>
            <button className="btn secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn" onClick={add}>Submit</button>
          </>}
        >
          <Field label="Image Link (https://...) *" style={{ marginBottom: 6 }}>
            <input className="input" placeholder="https://example.com/banner.jpg" value={url} onChange={(e) => setUrl(e.target.value)} />
          </Field>
          <div className="hint" style={{ marginBottom: 14 }}>Paste a public image link (wide images, about 2:1, look best). Image upload from your computer is not supported yet.</div>
          {/^https?:\/\//.test(url) && <img src={url} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', borderRadius: 8, marginBottom: 14 }} />}
          <Field label="Display Order"><input className="input" inputMode="numeric" value={order} onChange={(e) => setOrder(e.target.value.replace(/\D/g, ''))} /></Field>
        </Modal>
      )}
    </>
  );
}

export function HowToPlay() {
  const settings = useSettingsForm();
  return (
    <>
      <PageHeader title="How To Play" trail="Settings" current="How To Play" />
      <Card style={{ maxWidth: 850 }}>
        <h5 className="card-title">How To Play Content</h5>
        <Field label="Instructions / Rules Content (shown in the app under How To Play)">
          <textarea className="textarea" style={{ minHeight: 200 }} placeholder="Write the game rules and instructions shown to users..." {...settings.input('how_to_play')} />
        </Field>
        <Field label="Notice Board / Rules (shown in the app under Notice board/ Rules)" style={{ marginTop: 18 }}>
          <textarea className="textarea" style={{ minHeight: 140 }} placeholder="Announcements and rules for users..." {...settings.input('notice_board')} />
        </Field>
        <div className="hint" style={{ marginTop: 10 }}>{settings.error}</div>
        <button className="btn" style={{ marginTop: 14, padding: '10px 28px' }} onClick={() => settings.save(['how_to_play', 'notice_board'], 'Saved. The app shows it within 10 seconds.')}>Submit</button>
      </Card>
    </>
  );
}

/** Lets the logged-in admin change their own password. */
function AdminPassword() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const submit = async () => {
    if (next !== confirmPw) return toast('New passwords do not match');
    try {
      await api('POST', '/admin/password', { current, next });
      toast('Admin password changed');
      setCurrent('');
      setNext('');
      setConfirmPw('');
    } catch (err) {
      toast((err as Error).message);
    }
  };
  return (
    <Card style={{ marginBottom: 24, maxWidth: 520 }}>
      <h5 className="card-title">Change Admin Password</h5>
      <Field label="Current Password" style={{ marginBottom: 12 }}><input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} /></Field>
      <Field label="New Password (min 8 characters)" style={{ marginBottom: 12 }}><input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <Field label="Confirm New Password" style={{ marginBottom: 16 }}><input className="input" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} /></Field>
      <button className="btn" onClick={submit}>Change Password</button>
    </Card>
  );
}
