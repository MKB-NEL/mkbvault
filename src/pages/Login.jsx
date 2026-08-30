 
import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../App';

const db = getFirestore(app);

const Login = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: '', type: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [shimmerVisible, setShimmerVisible] = useState(true);

  const passwordInputRef = useRef(null);

  useEffect(() => {
    // Hide shimmer after 600ms
    const timer = setTimeout(() => setShimmerVisible(false), 600);
    // Auto-focus
    setTimeout(() => passwordInputRef.current?.focus(), 800);
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    // Check existing session
    const isAuth = sessionStorage.getItem('vault_authenticated');
    if (isAuth === 'true') {
      const loginTime = parseInt(sessionStorage.getItem('vault_login_time') || '0');
      if (Date.now() - loginTime < 24 * 60 * 60 * 1000) {
        window.location.href = 'vault.html';
      }
    }
    return () => clearTimeout(timer);
  }, []);

  const hashPassword = async (pwd) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(pwd);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: '', type: '' });

    const enteredPassword = password.trim();
    if (!enteredPassword) {
      setFeedback({ message: 'Please enter your master password.', type: 'warning' });
      passwordInputRef.current?.focus();
      return;
    }

    setLoading(true);
    setFeedback({ message: 'Verifying credentials ...', type: 'warning' });

    try {
      const docRef = doc(db, 'password', 'master-key');
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        setFeedback({ message: 'No master password set. Please contact your administrator.', type: 'error' });
        setLoading(false);
        return;
      }

      const storedHash = docSnap.data().value;
      if (!storedHash) {
        setFeedback({ message: 'Invalid password configuration. Please contact support.', type: 'error' });
        setLoading(false);
        return;
      }

      const enteredHash = await hashPassword(enteredPassword);

      if (enteredHash === storedHash) {
        setFeedback({ message: 'Access granted! Redirecting ...', type: 'success' });
        sessionStorage.setItem('vault_authenticated', 'true');
        sessionStorage.setItem('vault_login_time', Date.now().toString());
        setLoading(false);
        setTimeout(() => {
          window.location.href = 'vault.html';
        }, 600);
      } else {
        setFeedback({ message: 'Incorrect password. Please try again.', type: 'error' });
        setPassword('');
        passwordInputRef.current?.focus();
        setLoading(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setFeedback({ message: 'Unable to connect to secure storage. Please check your connection.', type: 'error' });
      setLoading(false);
    }
  };

  return (
    <>
      {/* Shimmer Loading */}
      {shimmerVisible && (
        <div className="shimmer-loading" role="status" aria-label="Loading">
          <div className="loader">
            <div className="spinner-ring"></div>
            <p>Securing your vault ...</p>
          </div>
        </div>
      )}

      <div className="page-wrapper" role="main" aria-label="Login panel">
        <div className="login-grid">
          {/* Left Column - Brand */}
          <div className="brand-column">
            <img
              src="https://i.ibb.co/whjyTVcM/759803063-18074799167426474-8240875063787582035-n.jpg"
              alt="MK Bertrand"
              className="brand-image"
              loading="lazy"
            />
            <h1>Private Vault</h1>
            <p className="owner-name">Designed exclusively for <strong>MK Bertrand</strong></p>

            <div className="separator" aria-hidden="true">
              <span className="line"></span>
              <span className="diamond"></span>
              <span className="line"></span>
            </div>

            <p className="contact-info">
              <Icon icon="mdi:phone" />
              Need one? Contact: <span className="highlight">+250 795 065 789</span>
            </p>
            <p className="contact-note">
              <Icon icon="mdi:shield-check" style={{ fontSize: '0.8rem' }} />
              Secure · Encrypted · Private
            </p>
          </div>

          {/* Right Column - Form */}
          <div className="form-column">
            <div className="form-header">
              <h2>Secure Access</h2>
              <p>Enter your master password to unlock</p>
            </div>

            <form className="login-form" onSubmit={handleSubmit} autoComplete="off" noValidate>
              <div className="form-group">
                <label htmlFor="passwordInput">Master Password</label>
                <div className="input-wrapper">
                  <span className="input-icon" aria-hidden="true">
                    <Icon icon="mdi:key-round" />
                  </span>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    id="passwordInput"
                    placeholder="Enter your master password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    aria-describedby="feedbackMessage"
                  />
                  <button
                    type="button"
                    className="toggle-visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label="Toggle password visibility"
                    tabIndex="-1"
                  >
                    <Icon icon={showPassword ? 'mdi:eye-off' : 'mdi:eye'} id="eyeIcon" />
                  </button>
                </div>
              </div>

              <div className={`feedback-message ${feedback.message ? 'visible' : ''} ${feedback.type}`} id="feedbackMessage" role="alert">
                <Icon icon={feedback.type === 'error' ? 'mdi:alert-circle' : feedback.type === 'success' ? 'mdi:check-circle' : 'mdi:alert'} id="feedbackIcon" />
                <span id="feedbackText">{feedback.message}</span>
              </div>

              <button type="submit" className={`submit-btn ${loading ? 'loading' : ''}`} id="submitBtn" disabled={loading}>
                <span className="btn-icon" aria-hidden="true">
                  <Icon icon="mdi:unlock" />
                </span>
                <span className="btn-text">{loading ? 'Verifying...' : 'Unlock Vault'}</span>
                <span className="spinner" aria-hidden="true"></span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer className="professional-footer">
          <span className="footer-copy">
            &copy; <span id="currentYear"></span> ·
            <span className="brand-highlight">PIReactive</span> ·
            <span className="mono">MK Bertrand</span> ·
            All rights reserved
          </span>
          <div className="footer-links">
            <a href="https://pireactive.vercel.app/" target="_blank" rel="noopener noreferrer">
              <Icon icon="mdi:building" /> PIReactive
            </a>
            <span className="dot" aria-hidden="true">●</span>
            <a href="https://www.instagram.com/kai_b3rt" target="_blank" rel="noopener noreferrer">
              <Icon icon="mdi:instagram" /> Instagram
            </a>
            <span className="dot" aria-hidden="true">●</span>
            <a href="#" aria-label="Privacy Policy">
              <Icon icon="mdi:shield" /> Privacy
            </a>
            <span className="dot" aria-hidden="true">●</span>
            <a href="mailto:contact@pireactive.com" aria-label="Contact support">
              <Icon icon="mdi:email" /> Support
            </a>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Login;
