// Shown instead of the app while the admin has the maintenance notice switched on.
import { Wrench } from 'lucide-react';
import { useT } from './i18n';

export function MaintenanceScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <div className="phone">
      <div className="empty maint">
        <span className="empty-icon"><Wrench size={56} /></span>
        <h3>{t('Under Maintenance')}</h3>
        <p>{message}</p>
        <button className="auth-btn" style={{ maxWidth: 220 }} onClick={onRetry}>{t('TRY AGAIN')}</button>
      </div>
    </div>
  );
}
