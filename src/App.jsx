import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import Vault from './components/Vault';

const firebaseConfig = {
  apiKey: 'AIzaSyBbrRHlakmOdKwuDGwYAx5qf-e6DOHW7s0',
  authDomain: 'joefootball-15e7a.firebaseapp.com',
  databaseURL: 'https://joefootball-15e7a-default-rtdb.firebaseio.com',
  projectId: 'joefootball-15e7a',
  storageBucket: 'joefootball-15e7a.firebasestorage.app',
  messagingSenderId: '976347287101',
  appId: '1:976347287101:web:93a93c519fff7e60986454',
  measurementId: 'G-3Q10KV3HE3'
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
export const itemsRef = ref(database, 'vault-items');

function App() {
  const [items, setItems] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      setItems(data ? Object.entries(data).map(([id, value]) => ({ id, ...value, createdAt: value.createdAt || Date.now() })) : []);
    });
    return () => unsubscribe();
  }, []);

  // Check auth
  const [auth, setAuth] = useState(null);
  useEffect(() => {
    const isAuth = sessionStorage.getItem('vault_authenticated');
    const loginTime = parseInt(sessionStorage.getItem('vault_login_time') || '0');
    if (isAuth === 'true' && Date.now() - loginTime < 24 * 60 * 60 * 1000) {
      setAuth(true);
    } else {
      sessionStorage.removeItem('vault_authenticated');
      sessionStorage.removeItem('vault_login_time');
      setAuth(false);
    }
  }, []);

  if (auth === null) {
    return (
      <div className="auth-guard">
        <div className="spinner"></div>
        <p>Verifying session ...</p>
      </div>
    );
  }

  if (!auth) {
    // Show login
    return <LoginPage />;
  }

  return <Vault items={items} isMobile={isMobile} />;
}

// ===== LOGIN PAGE (inline) =====
function LoginPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [showPassword, setShowPassword] = useState(false);

  const hashPassword = async (pwd) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' });

    const entered = password.trim();
    if (!entered) {
      setFeedback({ message: 'Please enter your master password.', type: 'warning' });
      return;
    }

    setLoading(true);
    setFeedback({ message: 'Verifying credentials ...', type: 'warning' });

    try {
      const { getFirestore, doc, getDoc } = await import('firebase/firestore');
      const db = getFirestore(app);
      const docRef = doc(db, 'password', 'master-key');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setFeedback({ message: 'No master password set.', type: 'error' });
        setLoading(false);
        return;
      }

      const storedHash = docSnap.data().value;
      const enteredHash = await hashPassword(entered);

      if (enteredHash === storedHash) {
        setFeedback({ message: 'Access granted! Redirecting ...', type: 'success' });
        sessionStorage.setItem('vault_authenticated', 'true');
        sessionStorage.setItem('vault_login_time', Date.now().toString());
        setLoading(false);
        setTimeout(() => window.location.reload(), 600);
      } else {
        setFeedback({ message: 'Incorrect password.', type: 'error' });
        setPassword('');
        setLoading(false);
      }
    } catch (error) {
      setFeedback({ message: 'Connection error.', type: 'error' });
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-grid">
        <div className="login-left">
          <img src="https://i.ibb.co/whjyTVcM/759803063-18074799167426474-8240875063787582035-n.jpg" alt="MK Bertrand" />
          <h1>Private Vault</h1>
          <p>Designed exclusively for <strong>MK Bertrand</strong></p>
          <div className="sep"><span className="line"></span><span className="diamond"></span><span className="line"></span></div>
          <p className="contact"><span>📞</span> Need one? Contact: <span className="highlight">+250 795 065 789</span></p>
        </div>
        <div className="login-right">
          <h2>Secure Access</h2>
          <p>Enter your master password to unlock</p>
          <form className="login-form" onSubmit={handleSubmit}>
            <div>
              <label>Master Password</label>
              <div className="input-wrap">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your master password" autoFocus required />
                <button type="button" className="toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>
            <div className={`feedback ${feedback.message ? 'show' : ''} ${feedback.type}`}>
              {feedback.message}
            </div>
            <button type="submit" className={`btn ${loading ? 'loading' : ''}`} disabled={loading}>
              <span className="btn-text">{loading ? 'Verifying...' : 'Unlock Vault'}</span>
              <span className="spinner-small"></span>
            </button>
          </form>
        </div>
      </div>
      <div className="footer">
        <span>&copy; {new Date().getFullYear()} · PIReactive · MK Bertrand</span>
        <div>
          <a href="https://pireactive.vercel.app/" target="_blank">🏢 PIReactive</a>
          <span style={{ margin: '0 8px', opacity: 0.3 }}>●</span>
          <a href="https://www.instagram.com/kai_b3rt" target="_blank">📷 Instagram</a>
          <span style={{ margin: '0 8px', opacity: 0.3 }}>●</span>
          <a href="mailto:contact@pireactive.com">✉️ Support</a>
        </div>
      </div>
    </div>
  );
}

export default App;
