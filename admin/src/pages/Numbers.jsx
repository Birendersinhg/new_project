import { PageHeader, Card } from '../ui';
import { SINGLE_DIGITS, JODI_DIGITS, TRIPLE_PANA, SINGLE_PANA_BY_ANK, DOUBLE_PANA_BY_ANK, ALL_PANAS } from '../data';

const Grid = ({ items, wide }) => (
  <div className="num-grid">
    {items.map((n) => <div key={n} className={'num-box' + (wide ? ' wide' : '')}>{n}</div>)}
  </div>
);

const Page = ({ title, current, children }) => (
  <>
    <PageHeader title={title} trail="Game & Numbers" current={current} />
    {children}
  </>
);

const ByAnk = ({ groups }) => groups.map((g) => (
  <div className="ank-group" key={g.ank}>
    <div className="ank-label">Single Ank <span className="ank-chip">{g.ank}</span></div>
    <Grid items={g.items} wide />
  </div>
));

export const SingleDigit = () => (
  <Page title="Single Digit Numbers" current="Single Digit">
    <Card title="Single Digit Numbers"><Grid items={SINGLE_DIGITS} /></Card>
  </Page>
);

export const JodiDigit = () => (
  <Page title="Jodi Digit Numbers" current="Jodi Digit">
    <Card title="Jodi Digit Numbers (Total 100)"><Grid items={JODI_DIGITS} wide /></Card>
  </Page>
);

export const SinglePana = () => (
  <Page title="Single Pana Numbers" current="Single Pana">
    <Card title="Single Pana Numbers"><ByAnk groups={SINGLE_PANA_BY_ANK} /></Card>
  </Page>
);

export const DoublePana = () => (
  <Page title="Double Pana Numbers" current="Double Pana">
    <Card title="Double Pana Numbers"><ByAnk groups={DOUBLE_PANA_BY_ANK} /></Card>
  </Page>
);

export const TriplePana = () => (
  <Page title="Tripple Pana Numbers" current="Tripple Pana">
    <Card title="Tripple Pana Numbers"><Grid items={TRIPLE_PANA} wide /></Card>
  </Page>
);

export const HalfSangam = () => (
  <Page title="Half Sangam Numbers" current="Half Sangam">
    <Card>
      <h5 className="card-title">Open Ank</h5>
      <Grid items={SINGLE_DIGITS} />
      <h5 className="card-title" style={{ marginTop: 28 }}>Close Ank (Total {ALL_PANAS.length} Panas)</h5>
      <Grid items={ALL_PANAS} wide />
    </Card>
  </Page>
);

export const FullSangam = () => (
  <Page title="Full Sangam Numbers" current="Full Sangam">
    <Card>
      <h5 className="card-title">Open Ank (Total {ALL_PANAS.length} Panas)</h5>
      <Grid items={ALL_PANAS} wide />
      <h5 className="card-title" style={{ marginTop: 28 }}>Close Ank (Total {ALL_PANAS.length} Panas)</h5>
      <Grid items={ALL_PANAS} wide />
    </Card>
  </Page>
);
