import { Clock, Dice5, SquarePen, Sparkles, Trophy } from 'lucide-react';
import { padTime } from './data';
import { useAppData } from './appdata';
import type { Rates } from './api';
import { PageHeader } from './screens';
import type { LucideIcon } from './types';

interface RateSection {
  title: string;
  icon: LucideIcon;
  rates: [game: string, win: number][];
}

// Main market rates come from the admin; Starline and Gali Disawar games are not playable yet.
const mainRates = (r: Rates): RateSection => ({
  title: 'Game Win Ratio for All Bids',
  icon: Dice5,
  rates: [
    ['Single Digit', r.single],
    ['Jodi Digit', r.jodi],
    ['Single Pana', r.sp],
    ['Double Pana', r.dp],
    ['Triple Pana', r.tp],
    ['Half Sangam', r.half],
    ['Full Sangam', r.full],
  ],
});

const OTHER_SECTIONS: RateSection[] = [
  {
    title: 'Starline Win Ratio for All Bids',
    icon: Sparkles,
    rates: [
      ['Single Digit', 95],
      ['Single Pana', 1500],
      ['Double Pana', 3000],
      ['Triple Pana', 7000],
    ],
  },
  {
    title: 'Gali Disawar Win Ratio for All Bids',
    icon: Trophy,
    rates: [['Jodi Digit', 950]],
  },
];

export function GameRateScreen({ onBack }: { onBack: () => void }) {
  const { settings } = useAppData();
  const sections = [mainRates(settings.rates), ...OTHER_SECTIONS];
  return (
    <div className="phone sub">
      <PageHeader title="GAME RATE" subtitle="Win Ratio for All Games" onBack={onBack} right={<SquarePen size={24} />} />
      <div className="hub">
        {settings.texts.rates && <div className="info-box">{settings.texts.rates}</div>}
        {sections.map(({ title, icon: Icon, rates }) => (
          <section key={title} className="rate-section">
            <h3 className="rate-head"><Icon size={24} /> {title}</h3>
            {rates.map(([game, win]) => (
              <div key={game} className="rate-row">
                <span>{game}</span>
                <b>10 Ka {win}</b>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export function TimeTableScreen({ onBack }: { onBack: () => void }) {
  const { markets, settings } = useAppData();
  return (
    <div className="phone sub">
      <PageHeader title="TIME TABLE" subtitle="Today's Market Schedule" onBack={onBack} right={<Clock size={26} />} />
      <div className="hub tt">
        {settings.texts.timetable && <div className="info-box">{settings.texts.timetable}</div>}
        <div className="tt-head">
          <span>GAME NAME</span>
          <span>OPEN TIME</span>
          <span>CLOSE TIME</span>
        </div>
        {markets.map((m, i) => (
          <div key={m.id} className={`tt-row ${i % 2 ? 'alt' : ''}`}>
            <span className="tt-num">{i + 1}</span>
            <span className="tt-name">{m.name}</span>
            <span className="tt-open">{padTime(m.open)}</span>
            <span className="tt-close">{padTime(m.close)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
