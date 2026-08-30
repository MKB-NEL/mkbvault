
import React, { useState, useEffect } from 'react';

const AuthGuard = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isAuth = sessionStorage.getItem('vault_authenticated');
    const loginTime = parseInt(sessionStorage.getItem('vault_login_time') || '0');
    const duration = 24 * 60 * 60 * 1000;

    if (isAuth === 'true' && Date.now() - loginTime < duration) {
      setAuthenticated(true);
    } else {
      sessionStorage.removeItem('vault_authenticated');
      sessionStorage.removeItem('vault_login_time');
      window.location.href = 'index.html';
    }
    setChecking(false);
  }, []);

  if (checking) {
    return (
      <div id="authGuard">
        <div className="spinner-ring"></div>
        <p>Verifying session ...</p>
      </div>
    );
  }

  return authenticated ? children : null;
};

export default AuthGuard;
