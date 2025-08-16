import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

const rootEl = document.getElementById('root')!;
const hash = window.location.hash;
// Desativa StrictMode em modo teste forçado (#forceStage) para evitar duplo mount que causa loops e erros no MetroStage durante E2E
if (hash.includes('forceStage')) {
  createRoot(rootEl).render(<App />);
} else {
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
