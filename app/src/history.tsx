import { useEffect, useState } from 'react';
import { Receipt } from 'lucide-react';
import { api, type MyBid } from './api';
import { showDate } from './results';
import { PageHeader } from './screens';

const STATUS = { pending: 'Pending', won: 'Won', lost: 'Lost', reverted: 'Refunded' } as const;

export function BidHistoryScreen({ onBack }: { onBack: () => void }) {
  const [bids, setBids] = useState<MyBid[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<MyBid[]>('GET', '/bids').then(setBids).catch((err: Error) => setError(err.message));
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
