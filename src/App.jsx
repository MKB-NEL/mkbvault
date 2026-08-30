
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue } from 'firebase/database';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Credential from './pages/Credential';
import Note from './pages/Note';
import Project from './pages/Project';
import DesktopLayout from './layouts/DesktopLayout';
import MobileLayout from './layouts/MobileLayout';
import './styles/global.css';


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


const App = () => {
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
        {/* Login - no auth required */}
        <Route path="/login" element={<Login />} />

        {/* Detail pages - auth required */}
        <Route
          path="/credential/:id?"
          element={
            <AuthGuard>
              <Credential />
            </AuthGuard>
          }
        />
        <Route
          path="/note/:id?"
          element={
            <AuthGuard>
              <Note />
            </AuthGuard>
          }
        />
        <Route
          path="/project/:id?"
          element={
            <AuthGuard>
              <Project />
            </AuthGuard>
          }
        />

        {}
        <Route
          path="/"
          element={
            <AuthGuard>
              {isMobile ? <MobileLayout items={items} /> : <DesktopLayout items={items} />}
            </AuthGuard>
          }
        />

        {}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
