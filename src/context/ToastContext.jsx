// ============================================================
// FILE: src/context/ToastContext.jsx
// ============================================================
import React, { createContext, useState, useCallback, useContext } from 'react';
import { Icon } from '../components/Icon';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <Icon icon={toast.type === 'success' ? 'mdi:check-circle' : toast.type === 'error' ? 'mdi:alert-circle' : 'mdi:information'} />
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
