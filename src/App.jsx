// ============================================================
// FILE: src/App.jsx
// ============================================================
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import DesktopLayout from './layouts/DesktopLayout';
import MobileLayout from './layouts/MobileLayout';
import './styles/global.css';

// ============================================================
// FIREBASE CONFIG
// ============================================================
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

export const app = initializeApp(firebaseConfig);
export const database = getDatabase(app);
export const itemsRef = ref(database, 'vault-items');

// ============================================================
// MAIN APP
// ============================================================
const App = () => {
  const [items, setItems] = useState([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Listen to Firebase for real-time updates
  useEffect(() => {
    const unsubscribe = onValue(itemsRef, (snapshot) => {
      const data = snapshot.val();
      const all = data
        ? Object.entries(data).map(([id, value]) => ({
            id,
            ...value,
            createdAt: value.createdAt || Date.now()
          }))
        : [];
      setItems(all);
    });

    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Login route - no auth required */}
        <Route path="/login" element={<Login />} />

        {/* Main dashboard - auth required */}
        <Route
          path="/"
          element={
            <AuthGuard>
              {isMobile ? (
                <MobileLayout items={items} />
              ) : (
                <DesktopLayout items={items} />
              )}
            </AuthGuard>
          }
        />

        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
