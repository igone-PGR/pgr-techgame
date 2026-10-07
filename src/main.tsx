import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __HACKER_APP_MOUNTED__?: boolean;
  }
}

const rootEl = document.getElementById('root');
if (rootEl && !window.__HACKER_APP_MOUNTED__) {
  window.__HACKER_APP_MOUNTED__ = true;
  createRoot(rootEl).render(<App />);
}
