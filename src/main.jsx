// ============================================================
// FILE: src/main.jsx
// ============================================================
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ModalProvider } from './context/ModalContext';
import { ToastProvider } from './context/ToastContext';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <ModalProvider>
        <App />
      </ModalProvider>
    </ToastProvider>
  </React.StrictMode>
);
