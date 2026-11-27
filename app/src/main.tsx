import { createRoot } from 'react-dom/client';
import App from './App';
import { LangProvider } from './i18n';
import { clearOldLocalData } from './results';
import './styles.css';
import './screens.css';
import './money.css';
import './games.css';
import './rates.css';
import './charts.css';
import './quiz.css';

clearOldLocalData();

createRoot(document.getElementById('root') as HTMLElement).render(<LangProvider><App /></LangProvider>);
