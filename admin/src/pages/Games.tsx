import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { PageHeader, Card, Field, DataTable, Modal, YesNo, useToast } from '../ui';
import { ALL_PANAS, panaAnk } from '../data';
import { api, todayIso, useLoad, type AdminMarket, type AdminSettings, type DeclaredResult, type Rates } from '../api';

/** "13:05" -> "1:05 PM" for display. */
const to12h = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/** Puts any 3 digits into matka order (0 counts as the highest), so 821 -> 128. */
const normalizePana = (p: string) => [...p].sort((a, b) => (a === '0' ? 10 : +a) - (b === '0' ? 10 : +b)).join('');

export function DeclareResult() {
  const toast = useToast();
  const { data: markets } = useLoad<AdminMarket[]>('/admin/markets');
  const [marketId, setMarketId] = useState('');
  const [date, setDate] = useState(todayIso);
  const [session, setSession] = useState<'open' | 'close'>('open');
  const [pana, setPana] = useState('');
  const [busy, setBusy] = useState(false);
  const [filterDate, setFilterDate] = useState(todayIso);
  const { data: results, error, reload } = useLoad<DeclaredResult[]>(`/admin/results?date=${filterDate}`);

  const canonical = pana.length === 3 ? normalizePana(pana) : '';
  const valid = ALL_PANAS.includes(canonical);
  const label = session === 'open' ? 'Open' : 'Close';

  const declare = async () => {
    if (!marketId) return toast('Select a game');
    if (!valid) return toast('Enter a valid 3-digit pana');
    setBusy(true);
    try {
      const r = await api<{ pana: string; ank: string; settled: { won: number; lost: number; pending: number } }>(
        'POST', '/admin/results', { marketId: Number(marketId), date, session, pana: canonical });
      toast(`Declared ${r.pana}-${r.ank}. Bids settled: ${r.settled.won} won, ${r.settled.lost} lost.`);
      setPana('');
      if (date === filterDate) reload();
      else setFilterDate(date);
    } catch (err) {
      toast((err as Error).message);
    }
    setBusy(false);
  };

  const remove = async (r: DeclaredResult, closeOnly: boolean) => {
    const what = closeOnly ? 'the Close result' : 'this result';
    if (!confirm(`Delete ${what} for ${r.name}? Any winnings paid from it will be taken back.`)) return;
    try {
      await api('DELETE', `/admin/results?marketId=${r.marketId}&date=${r.date}${closeOnly ? '&session=close' : ''}`);
      toast('Result deleted and payouts reversed');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Declare Game Result" trail="Game Operations" current="Declare Result" />
      <Card style={{ maxWidth: 650 }}>
        <h5 className="card-title" style={{ fontSize: '1.15rem', marginBottom: 6 }}>Declare Numbers</h5>
        <div className="card-sub" style={{ margin: '0 0 18px' }}>
          Declare Open/Close Pana. Winning bids are paid automatically. Declaring again corrects the result and only the difference is paid or taken back.
        </div>
        <Field label="Select Game *" style={{ marginBottom: 16 }}>
          <select className="select" value={marketId} onChange={(e) => setMarketId(e.target.value)}>
            <option value="">-- Select Game --</option>
            {markets?.map((m) => <option key={m.id} value={m.id}>{m.name} ({to12h(m.open)} - {to12h(m.close)})</option>)}
          </select>
        </Field>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <Field label="Result Date *"><input type="date" className="input" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Session *">
            <select className="select" value={session} onChange={(e) => setSession(e.target.value as 'open' | 'close')}>
              <option value="open">OPEN SESSION</option><option value="close">CLOSE SESSION</option>
            </select>
          </Field>
          <Field label={`${label} Pana (3 Digits) *`}>
            <input className="input" list="pana-list" maxLength={3} placeholder="Search or Select Pana (e.g. 123)" value={pana} onChange={(e) => setPana(e.target.value.replace(/\D/g, ''))} />
            <datalist id="pana-list">{ALL_PANAS.map((p) => <option key={p} value={p} />)}</datalist>
            {pana.length === 3 && (
              <div className="hint" style={{ color: valid ? 'var(--success)' : 'var(--danger)' }}>
                {valid ? (canonical !== pana ? `Will be saved as ${canonical}` : 'Valid pana') : 'Not a valid pana'}
              </div>
            )}
          </Field>
          <Field label={`${label} Single Digit (0-9) *`}>
            <input className="input" readOnly placeholder="Auto-calculated (e.g. 6)" value={valid ? panaAnk(canonical) : ''} />
          </Field>
        </div>
        <button className="btn block" style={{ padding: 13 }} disabled={busy} onClick={declare}>{busy ? 'DECLARING...' : 'DECLARE GAME RESULT'}</button>
      </Card>

      <Card>
        <div className="card-head">
          <div>
            <h5 className="card-title">Declared Results History</h5>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: 4 }}>Deleting a result takes back any winnings paid from it.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <b style={{ fontSize: '.85rem' }}>Filter Date:</b>
            <input type="date" className="input" style={{ width: 160 }} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
          </div>
        </div>
        <DataTable rows={results ?? []} empty={error || 'No declared results found for selected date.'} columns={[
          { h: 'Game Name', r: (r) => <b>{r.name}</b> },
          { h: 'Result Date', r: (r) => r.date },
          { h: 'Open Result', r: (r) => (r.open ? `${r.open}-${r.openAnk}` : '***-*') },
          { h: 'Close Result', r: (r) => (r.close ? `${r.closeAnk}-${r.close}` : '*-***') },
          { h: 'Jodi', r: (r) => (r.openAnk && r.closeAnk ? <b>{r.openAnk + r.closeAnk}</b> : '**') },
          {
            h: 'Actions', r: (r) => (
              <div style={{ display: 'flex', gap: 6 }}>
                {r.close && <button className="btn light xs" onClick={() => remove(r, true)}>Delete Close</button>}
                <button className="btn danger xs" onClick={() => remove(r, false)}><Trash2 size={12} /> Delete</button>
              </div>
            ),
          },
        ]} />
      </Card>
    </>
  );
}

interface GameForm { id?: number; name: string; open: string; close: string; active: boolean }

export function GameNames() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<GameForm | null>(null);
  const { data: games, error, reload } = useLoad<AdminMarket[]>('/admin/markets');
  const rows = (games ?? []).filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const minutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

  const save = async () => {
    if (!modal) return;
    try {
      const body = { name: modal.name, open: modal.open, close: modal.close, active: modal.active };
      await (modal.id ? api('PUT', `/admin/markets/${modal.id}`, body) : api('POST', '/admin/markets', body));
      toast('Game saved');
      setModal(null);
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  const remove = async (g: AdminMarket) => {
    if (!confirm(`Delete ${g.name}?`)) return;
    try {
      const r = await api<{ deactivated?: boolean }>('DELETE', `/admin/markets/${g.id}`);
      toast(r.deactivated ? 'Game has bids, so it was made inactive instead of deleted' : 'Game deleted');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Game Name List" trail="Games Management" current="Game Name" />
      <Card>
        <div className="card-head">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <h5 className="card-title">Game Name List</h5>
            <span className="badge" style={{ border: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 400 }}>Total: {rows.length}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input className="input" style={{ width: 200 }} placeholder="Search game..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" onClick={() => setModal({ name: '', open: '', close: '', active: true })}>+ Add Game</button>
          </div>
        </div>
        <DataTable rows={rows} empty={error || (games ? 'No Games Added!' : 'Loading...')} columns={[
          { h: '#', r: (_, i) => i + 1 },
          { h: 'Game Name', r: (g) => <b>{g.name}</b> },
          { h: 'Today Open', r: (g) => to12h(g.open) },
          { h: 'Today Close', r: (g) => to12h(g.close) },
          { h: 'Active', r: (g) => <YesNo v={g.active} /> },
          {
            h: 'Market Status', r: (g) => {
              const open = !!g.active && nowMin < minutes(g.close);
              return <span className={'badge ' + (open ? 'success' : 'danger')}>{open ? 'Market Open' : 'Market Closed'}</span>;
            },
          },
          {
            h: 'Action', r: (g) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn xs" onClick={() => setModal({ id: g.id, name: g.name, open: g.open, close: g.close, active: !!g.active })}><Pencil size={12} /></button>
                <button className="btn danger xs" onClick={() => remove(g)}><Trash2 size={12} /></button>
              </div>
            ),
          },
        ]} />
      </Card>
      {modal && (
        <Modal
          title={modal.id ? 'Edit Game' : 'Add Game'}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn secondary" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn" onClick={save}>Submit</button>
          </>}
        >
          <Field label="Game Name" style={{ marginBottom: 14 }}>
            <input className="input" value={modal.name} placeholder="Enter Game Name (e.g. KALYAN)" onChange={(e) => setModal({ ...modal, name: e.target.value })} />
          </Field>
          <div className="grid-2" style={{ marginBottom: 14 }}>
            <Field label="Open Time"><input type="time" className="input" value={modal.open} onChange={(e) => setModal({ ...modal, open: e.target.value })} /></Field>
            <Field label="Close Time"><input type="time" className="input" value={modal.close} onChange={(e) => setModal({ ...modal, close: e.target.value })} /></Field>
          </div>
          <label className="check"><input type="checkbox" checked={modal.active} onChange={(e) => setModal({ ...modal, active: e.target.checked })} /> Active (shown in the app)</label>
        </Modal>
      )}
    </>
  );
}

const RATE_FIELDS: [keyof Rates, string][] = [
  ['single', 'Single Digit'], ['jodi', 'Jodi Digit'], ['sp', 'Single Pana'], ['dp', 'Double Pana'],
  ['tp', 'Triple Pana'], ['half', 'Half Sangam'], ['full', 'Full Sangam'],
];

export function GameRates() {
  const toast = useToast();
  const { data, error } = useLoad<AdminSettings>('/admin/settings');
  const [rates, setRates] = useState<Record<string, string> | null>(null);
  const values = rates ?? (data ? Object.fromEntries(Object.entries(data.rates).map(([k, v]) => [k, String(v)])) : null);

  const save = async () => {
    if (!values) return;
    try {
      await api('PUT', '/admin/settings', { rates: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, Number(v)])) });
      toast('Rates saved. The app shows them right away.');
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title="Game Rates Management" trail="Games Management" current="Game Rates" />
      <Card style={{ maxWidth: 850, margin: '0 auto 24px' }}>
        <h5 className="card-title">Games Rate</h5>
        <div className="card-sub" style={{ margin: '-8px 0 16px' }}>Win amount for every 10 points played (shown in the app as "10 Ka …").</div>
        {!values ? <div>{error || 'Loading...'}</div> : (
          <div className="grid-2">
            {RATE_FIELDS.flatMap(([key, label]) => [
              <Field key={key + 1} label={`${label} Bid`}><input className="input" value="10" readOnly /></Field>,
              <Field key={key + 2} label={`${label} Win`}>
                <input className="input" inputMode="numeric" value={values[key]} onChange={(e) => setRates({ ...values, [key]: e.target.value.replace(/\D/g, '') })} />
              </Field>,
            ])}
          </div>
        )}
        <button className="btn" style={{ marginTop: 22, padding: '10px 28px' }} disabled={!values} onClick={save}>Submit</button>
      </Card>
    </>
  );
}

interface SlotData { slots: string[]; results: { slot: string; pana?: string; jodi?: string }[] }

/** Starline (pana per time) and Disawar (jodi per time) results; one per date and time, re-declaring corrects it. */
function SlotResults({ kind }: { kind: 'starline' | 'disawar' }) {
  const toast = useToast();
  const isStarline = kind === 'starline';
  const [date, setDate] = useState(todayIso);
  const { data, error, reload } = useLoad<SlotData>(`/admin/${kind}?date=${date}`);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const byslot = new Map(data?.results.map((r) => [r.slot, r.pana ?? r.jodi ?? '']));

  const save = async (slot: string) => {
    const value = inputs[slot] ?? '';
    try {
      await api('POST', `/admin/${kind}`, { date, slot, ...(isStarline ? { pana: value } : { jodi: value }) });
      toast(`${slot} result saved`);
      setInputs({ ...inputs, [slot]: '' });
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };
  const remove = async (slot: string) => {
    if (!confirm(`Delete the ${slot} result?`)) return;
    try {
      await api('DELETE', `/admin/${kind}?date=${date}&slot=${encodeURIComponent(slot)}`);
      toast('Result deleted');
      reload();
    } catch (err) {
      toast((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader title={isStarline ? 'Starline Result' : 'Disawar Result'} trail="Game Operations" current={isStarline ? 'Starline Result' : 'Disawar Result'} />
      <Card>
        <div className="card-head">
          <div>
            <h5 className="card-title">Declare {isStarline ? 'Starline Pana' : 'Disawar Jodi'} by Time</h5>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: 4 }}>
              {isStarline ? 'Enter the 3-digit pana; the single digit is worked out automatically.' : 'Enter the 2-digit jodi (00-99).'} Saving again corrects the result. It shows in the app chart right away.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <b style={{ fontSize: '.85rem' }}>Date:</b>
            <input type="date" className="input" style={{ width: 160 }} value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <DataTable rows={data?.slots ?? []} empty={error || 'Loading...'} columns={[
          { h: 'Time', r: (slot) => <b>{slot}</b> },
          {
            h: 'Declared Result', r: (slot) => {
              const v = byslot.get(slot);
              if (!v) return <span style={{ color: 'var(--muted)' }}>Not declared</span>;
              return <b>{isStarline ? `${v} - ${panaAnk(v)}` : v}</b>;
            },
          },
          {
            h: isStarline ? 'Pana' : 'Jodi', r: (slot) => (
              <input className="input" style={{ width: 110 }} inputMode="numeric" maxLength={isStarline ? 3 : 2}
                placeholder={isStarline ? 'e.g. 258' : 'e.g. 32'} value={inputs[slot] ?? ''}
                onChange={(e) => setInputs({ ...inputs, [slot]: e.target.value.replace(/\D/g, '') })} />
            ),
          },
          {
            h: 'Action', r: (slot) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn xs" onClick={() => save(slot)}>{byslot.has(slot) ? 'Update' : 'Declare'}</button>
                {byslot.has(slot) && <button className="btn danger xs" onClick={() => remove(slot)}><Trash2 size={12} /></button>}
              </div>
            ),
          },
        ]} />
      </Card>
    </>
  );
}

export const StarlineResult = () => <SlotResults kind="starline" />;
export const DisawarResult = () => <SlotResults kind="disawar" />;
