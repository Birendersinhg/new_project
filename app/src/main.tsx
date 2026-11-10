import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import './screens.css';
import './money.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
