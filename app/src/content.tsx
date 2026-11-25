import { useEffect, useState } from 'react';
import { Megaphone, PlayCircle } from 'lucide-react';
import { useAppData } from './appdata';
import { PageHeader } from './screens';

/** "+91 98765 43210" -> "9876543210"-style digits for tel: links. */
const digits = (s: string) => s.replace(/\D/g, '');
export const telLink = (phone: string) => (digits(phone) ? `tel:+${digits(phone).length === 10 ? '91' : ''}${digits(phone)}` : '');
export const whatsappLink = (num: string) => (digits(num) ? `https://wa.me/${digits(num).length === 10 ? '91' : ''}${digits(num)}` : '');

/** Turns http(s) links in admin text into tappable links. */
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    i % 2 ? <a key={i} className="text-link" href={part} target="_blank" rel="noreferrer noopener">{part}</a> : part);
}

/** Text set by the admin (How To Play, Notice Board); line breaks are kept and links are tappable. */
function TextScreen({ title, subtitle, text, empty, icon, onBack }: {
  title: string; subtitle: string; text: string; empty: string; icon: React.ReactNode; onBack: () => void;
}) {
  return (
    <div className="phone sub money">
      <PageHeader title={title} subtitle={subtitle} onBack={onBack} right={icon} />
      <div className="hub">
        <div className="info-text">{linkify(text.trim() || empty)}</div>
      </div>
    </div>
  );
}

export function HowToPlayScreen({ onBack }: { onBack: () => void }) {
  const { settings } = useAppData();
  return <TextScreen title="HOW TO PLAY" subtitle="Rules and instructions" text={settings.howToPlay}
    empty="Instructions will appear here soon." icon={<PlayCircle size={24} />} onBack={onBack} />;
}

export function NoticeScreen({ onBack }: { onBack: () => void }) {
  const { settings } = useAppData();
  return <TextScreen title="NOTICE BOARD" subtitle="Rules and announcements" text={settings.notice}
    empty="No notices right now." icon={<Megaphone size={24} />} onBack={onBack} />;
}

/** Home screen banner; shows the admin's slider images and rotates every 4 seconds. */
export function Banner() {
  const { settings } = useAppData();
  const images = settings.sliders;
  const [i, setI] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % images.length), 4000);
    return () => clearInterval(t);
  }, [images.length]);
  if (!images.length) return null;
  const current = i % images.length;
  return (
    <div className="banner">
      <img src={images[current]} alt="" />
      {images.length > 1 && (
        <div className="banner-dots">
          {images.map((_, n) => <button key={n} aria-label={`Slide ${n + 1}`} className={n === current ? 'on' : ''} onClick={() => setI(n)} />)}
        </div>
      )}
    </div>
  );
}
