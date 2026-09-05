import {createRoot} from 'react-dom/client';
import './shared/styles.css';
import {App} from './app/App';
createRoot(document.getElementById('app')!).render(<App />);
