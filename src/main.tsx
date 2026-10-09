import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './app/theme/tokens.css';
import './app/theme/base.css';
import { App } from './App.tsx';
import { listenForInstall } from './app/install.ts';
import { watchSystemScheme } from './app/theme/theme.ts';

watchSystemScheme();
listenForInstall();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
