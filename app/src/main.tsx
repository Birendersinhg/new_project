import { createRoot } from 'react-dom/client';
import App from './App';
import { clearOldLocalData } from './results';
import './styles.css';
import './screens.css';
import './money.css';
import './games.css';
import './rates.css';
import './charts.css';

clearOldLocalData();

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
