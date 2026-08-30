
import React, { createContext, useState, useCallback, useContext, useRef } from 'react';

const ModalContext = createContext();

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState({ open: false, title: '', body: '', actions: '' });
  const resolveRef = useRef(null);

  const showModal = useCallback((title, body, actions) => {
    return new Promise((resolve) => {
      setModalState({ open: true, title, body, actions });
      resolveRef.current = resolve;
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState({ open: false, title: '', body: '', actions: '' });
    if (resolveRef.current) resolveRef.current(null);
  }, []);

  const handleAction = useCallback((result) => {
    setModalState({ open: false, title: '', body: '', actions: '' });
    if (resolveRef.current) resolveRef.current(result);
  }, []);

  const prompt = useCallback((title, label, defaultValue = '', inputType = 'text', options = null) => {
    return new Promise((resolve) => {
      let body = `<label>${label}</label>`;
      if (options) {
        body += `<select id="modalSelect">${options.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
      } else {
        body += `<input type="${inputType}" id="modalInput" value="${defaultValue || ''}" />`;
      }
      const actions = `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-primary" data-action="confirm">OK</button>
      `;
      showModal(title, body, actions).then((result) => {
        if (result === null) resolve(null);
        else {
          const input = document.getElementById('modalInput');
          const select = document.getElementById('modalSelect');
          resolve(input ? input.value : select ? select.value : '');
        }
      });
    });
  }, [showModal]);

  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      const body = `<p>${message}</p>`;
      const actions = `
        <button class="btn btn-secondary" data-action="cancel">Cancel</button>
        <button class="btn btn-danger" data-action="confirm">Confirm</button>
      `;
      showModal('Confirm', body, actions).then((result) => {
        resolve(result === 'confirm');
      });
    });
  }, [showModal]);

  return (
    <ModalContext.Provider value={{ prompt, confirm }}>
      {children}
      {modalState.open && (
        <div className="modal-overlay active" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-box">
            <div className="modal-title">{modalState.title}</div>
            <div className="modal-body" dangerouslySetInnerHTML={{ __html: modalState.body }} />
            <div className="modal-actions" dangerouslySetInnerHTML={{ __html: modalState.actions }}
              onClick={(e) => {
                const btn = e.target.closest('[data-action]');
                if (btn) handleAction(btn.dataset.action);
              }}
            />
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useModal = () => useContext(ModalContext);
