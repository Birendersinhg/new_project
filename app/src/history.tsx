import { useEffect, useState } from 'react';
import { BookOpen, Receipt } from 'lucide-react';
import { api, type MyBid, type PassbookRow, type SlotBid } from './api';
import { showDate } from './results';
import { PageHeader } from './screens';

const STATUS = { pending: 'Pending', won: 'Won', lost: 'Lost', reverted: 'Refunded' } as const;

export function BidHistoryScreen({ onBack }: { onBack: () => void }) {
  const [bids, setBids] = useState<MyBid[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    // Market bids and Starline/Jackpot bids are shown together, newest first.
    Promise.all([api<MyBid[]>('GET', '/bids'), api<SlotBid[]>('GET', '/slot-bids')])
      .then(([market, slots]) => {
        const slotRows: MyBid[] = slots.map((s) => ({
          id: -s.id, at: s.at, date: s.date, market: `${s.kind === 'starline' ? 'Starline' : 'Jackpot'} ${s.slot}`,
          game: s.game, session: null, number: s.number, points: s.points, status: s.status, win: s.win,
        }));
        setBids([...market, ...slotRows].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="phone sub money">
      <PageHeader title="BID HISTORY" subtitle="All your placed bids" onBack={onBack} right={<Receipt size={24} />} />
      <div className="hub">
        {!bids && <div className="info-box">{error || 'Loading...'}</div>}
        {bids?.length === 0 && <div className="info-box">No bids yet. Pick a market on the home screen to play.</div>}
        {bids?.map((b) => (
          <div key={b.id} className="bh-row">
            <div className="bh-top">
              <b>{b.market}</b>
              <span className={`bh-status ${b.status}`}>{STATUS[b.status]}{b.status === 'won' ? ` ₹${b.win}` : ''}</span>
            </div>
            <div className="bh-mid">
              <span>{b.game}{b.session ? ` · ${b.session}` : ''}</span>
              <span className="bh-num">{b.number}</span>
            </div>
            <div className="bh-bot">
              <span>{showDate(b.date)}</span>
              <span>₹{b.points}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Every credit and debit on the user's points, with the balance after each one. */
export function PassbookScreen({ onBack }: { onBack: () => void }) {
  const [rows, setRows] = useState<PassbookRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<PassbookRow[]>('GET', '/passbook').then(setRows).catch((err: Error) => setError(err.message));
  }, []);

  return (
    <div className="phone sub money">
      <PageHeader title="PASSBOOK" subtitle="Your points statement" onBack={onBack} right={<BookOpen size={24} />} />
      <div className="hub">
        {!rows && <div className="info-box">{error || 'Loading...'}</div>}
        {rows?.length === 0 && <div className="info-box">No entries yet.</div>}
        {rows?.map((r) => (
          <div key={r.id} className="bh-row">
            <div className="bh-top">
              <b className="pb-remark">{r.remark}</b>
              <span className={`pb-amt ${r.amount >= 0 ? 'cr' : 'dr'}`}>{r.amount >= 0 ? '+' : '-'}{Math.abs(r.amount)}</span>
            </div>
            <div className="bh-bot">
              <span>{showDate(r.at.slice(0, 10))} {r.at.slice(11, 16)}</span>
              <span>Balance: {r.balance}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
