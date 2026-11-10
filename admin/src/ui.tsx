import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { X, CheckCircle2, Search, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { MARKETS, today } from './data';

type ToastFn = (msg: string | null) => void;

const ToastCtx = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return (
    <ToastCtx.Provider value={setMsg}>
      {children}
      {msg && <div className="toast"><CheckCircle2 size={18} color="#34c38f" />{msg}</div>}
    </ToastCtx.Provider>
  );
}

/** Returns an onClick that shows a "demo only" toast. */
export const useDemo = () => {
  const toast = useToast();
  return (label = 'Saved') => () => toast(`${label} (demo — no backend connected)`);
};

export function PageHeader({ title, trail, current }: { title: string; trail: ReactNode; current: ReactNode }) {
  return (
    <div className="page-head">
      <h4>{title}</h4>
      <div className="crumbs">{trail} / <span>{current}</span></div>
    </div>
  );
}

interface CardProps {
  title?: ReactNode;
  sub?: ReactNode;
  right?: ReactNode;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export const Card = ({ title, sub, right, children, style, className = '' }: CardProps) => (
  <div className={'card ' + className} style={style}>
    {(title || right) && (
      <div className="card-head">
        <div>
          {title && <h5 className="card-title">{title}</h5>}
          {sub && <div className="card-sub" style={{ margin: '4px 0 0' }}>{sub}</div>}
        </div>
        {right}
      </div>
    )}
    {children}
  </div>
);

export const Field = ({ label, children, style }: { label?: ReactNode; children?: ReactNode; style?: CSSProperties }) => (
  <div className="field" style={style}>
    {label && <label>{label}</label>}
    {children}
  </div>
);

export const DateInput = (props: { empty?: boolean }) => {
  const [v, setV] = useState(props.empty ? '' : today());
  return <input type="date" className="input" value={v} onChange={(e) => setV(e.target.value)} />;
};

export function GameSelect({ allLabel = 'All Games', placeholder, includeAll = true }: { allLabel?: string; placeholder?: string; includeAll?: boolean }) {
  return (
    <select className="select" defaultValue="">
      {placeholder && <option value="">{placeholder}</option>}
      {includeAll && <option value={placeholder ? 'all' : ''}>{allLabel}</option>}
      {MARKETS.map((m) => <option key={m}>{m}</option>)}
    </select>
  );
}

interface SearchBoxProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  width?: number | string;
  icon?: boolean;
}

export const SearchBox = ({ placeholder = 'Search...', value, onChange, width = 260, icon = false }: SearchBoxProps) => (
  <div className={icon ? 'search' : ''} style={{ width, maxWidth: '100%' }}>
    {icon && <Search size={15} />}
    <input className="input" placeholder={placeholder} value={value} onChange={(e) => onChange?.(e.target.value)} />
  </div>
);

export interface Column<T> {
  h: ReactNode;
  r?: (row: T, index: number) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  head?: string;
  upper?: boolean;
}

export function DataTable<T>({ columns, rows, empty = 'No Data Found!', head = 'light', upper = false }: DataTableProps<T>) {
  return (
    <div className="table-wrap">
      <table>
        <thead className={head + (upper ? ' upper' : '')}>
          <tr>{columns.map((c, i) => <th key={i}>{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td className="empty" colSpan={columns.length}>{empty}</td></tr>
          ) : (
            rows.map((row, ri) => (
              <tr key={ri}>{columns.map((c, ci) => <td key={ci}>{c.r?.(row, ri)}</td>)}</tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ total }: { total: number }) {
  return (
    <div className="pager">
      <div>Showing {total ? 1 : 0} to {total} of {total} entries</div>
      <div className="pages">
        Rows per page:
        <select className="select" style={{ width: 70, padding: '5px 8px' }}><option>10</option><option>25</option><option>50</option></select>
        <button><ChevronsLeft size={14} /></button>
        <button><ChevronLeft size={14} /></button>
        <button className="on">1</button>
        <button><ChevronRight size={14} /></button>
        <button><ChevronsRight size={14} /></button>
      </div>
    </div>
  );
}

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number | string;
}

export function Modal({ title, onClose, children, footer, width }: ModalProps) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={width ? { maxWidth: width } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h5>{title}</h5>
          <button className="icon-btn ghost" onClick={onClose} style={{ width: 30, height: 30 }}><X size={20} /></button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export const YesNo = ({ v }: { v: unknown }) => <span className={'badge ' + (v ? 'yes' : 'no')}>{v ? 'Yes' : 'No'}</span>;
