import { useState } from 'react';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import { PageHeader, Card, Field, DateInput, DataTable, Modal, useDemo, YesNo } from '../ui';
import { GAMES, MARKETS, ALL_PANAS, panaAnk } from '../data';

export function DeclareResult() {
  const demo = useDemo();
  const [session, setSession] = useState('OPEN');
  const [pana, setPana] = useState('');
  const valid = ALL_PANAS.includes(pana);
  const label = session === 'OPEN' ? 'Open' : 'Close';

  return (
    <>
      <PageHeader title="Declare Game Result" trail="Game Operations" current="Declare Result" />
      <Card style={{ maxWidth: 650 }}>
        <h5 className="card-title" style={{ fontSize: '1.15rem', marginBottom: 6 }}>Declare Numbers</h5>
        <div className="card-sub" style={{ margin: '0 0 18px' }}>Declare Open/Close Pana &amp; Result digits. Winner settlements and payouts will be executed automatically.</div>
        <Field label="Select Game *" style={{ marginBottom: 16 }}>
          <select className="select"><option value="">-- Select Game --</option>{MARKETS.map((m) => <option key={m}>{m}</option>)}</select>
        </Field>
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <Field label="Result Date *"><DateInput /></Field>
          <Field label="Session *">
            <select className="select" value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="OPEN">OPEN SESSION</option><option value="CLOSE">CLOSE SESSION</option>
            </select>
          </Field>
          <Field label={`${label} Pana (3 Digits) *`}>
            <input className="input" list="pana-list" maxLength={3} placeholder="Search or Select Pana (e.g. 123)" value={pana} onChange={(e) => setPana(e.target.value.replace(/\D/g, ''))} />
            <datalist id="pana-list">{ALL_PANAS.map((p) => <option key={p} value={p} />)}</datalist>
          </Field>
          <Field label={`${label} Single Digit (0-9) *`}>
            <input className="input" readOnly placeholder="Auto-calculated (e.g. 6)" value={valid ? panaAnk(pana) : ''} />
          </Field>
        </div>
        <div className="grid-2">
          <button className="btn outline" style={{ padding: 13 }} onClick={demo('Winners preview loaded')}><Eye size={15} /> SHOW WINNERS PREVIEW</button>
          <button className="btn" style={{ padding: 13 }} onClick={demo('Result declared')}>DECLARE GAME RESULT</button>
        </div>
      </Card>

      <Card>
        <div className="card-head">
          <div>
            <h5 className="card-title">Declared Results History</h5>
            <div style={{ color: 'var(--muted)', fontSize: '.82rem', marginTop: 4 }}>View declared results and delete/revert winning payouts if needed.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><b style={{ fontSize: '.85rem' }}>Filter Date:</b><div style={{ width: 150 }}><DateInput /></div></div>
        </div>
        <DataTable rows={[]} empty="No declared results found for selected date." columns={[
          { h: 'Game Name' }, { h: 'Result Date' }, { h: 'Open Result' }, { h: 'Close Result' }, { h: 'Actions' },
        ]} />
      </Card>
    </>
  );
}

export function GameNames() {
  const demo = useDemo();
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const rows = GAMES.filter((g) => g.name.toLowerCase().includes(q.toLowerCase()));

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
            <button className="btn" onClick={() => setModal({})}>+ Add Game</button>
          </div>
        </div>
        <DataTable rows={rows} empty="No Games Added!" columns={[
          { h: '#', r: (_, i) => i + 1 },
          { h: 'Game Name', r: (g) => <b>{g.name}</b> },
          { h: 'Today Open', r: (g) => g.open },
          { h: 'Today Close', r: (g) => g.close },
          { h: 'Active', r: (g) => <YesNo v={g.active} /> },
          { h: 'Market Status', r: (g) => <span className={'badge ' + (g.market === 'Open' ? 'success' : 'danger')}>{g.market === 'Open' ? 'Market Open' : 'Market Closed'}</span> },
          {
            h: 'Action', r: (g) => (
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn xs" onClick={() => setModal(g)}><Pencil size={12} /></button>
                <button className="btn danger xs" onClick={demo('Game deleted')}><Trash2 size={12} /></button>
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
            <button className="btn" onClick={() => { setModal(null); demo('Game saved')(); }}>Submit</button>
          </>}
        >
          <Field label="Game Name" style={{ marginBottom: 14 }}><input className="input" defaultValue={modal.name} placeholder="Enter Game Name (e.g. KALYAN)" /></Field>
          <div className="grid-2">
            <Field label="Open Time"><input type="time" className="input" defaultValue={modal.open} /></Field>
            <Field label="Close Time"><input type="time" className="input" defaultValue={modal.close} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

const RATES = ['Single Digit', 'Jodi Digit', 'Single Pana', 'Double Pana', 'Tripple Pana', 'Half Sangam', 'Full Sangam'];

export function GameRates() {
  const demo = useDemo();
  return (
    <>
      <PageHeader title="Game Rates Management" trail="Games Management" current="Game Rates" />
      <Card style={{ maxWidth: 850, margin: '0 auto 24px' }}>
        <h5 className="card-title">Add Games Rate</h5>
        <div className="grid-2">
          {RATES.flatMap((n) => [
            <Field key={n + 1} label={`${n} Value 1`}><input className="input" placeholder="Bid amount" /></Field>,
            <Field key={n + 2} label={`${n} Value 2`}><input className="input" placeholder="Win amount" /></Field>,
          ])}
        </div>
        <button className="btn" style={{ marginTop: 22, padding: '10px 28px' }} onClick={demo('Rates saved')}>Submit</button>
      </Card>
    </>
  );
}
