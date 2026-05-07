import React, { useEffect, useState } from 'react';

import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithRedirect, getRedirectResult, signInAnonymously } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Home from './pages/Home';
import AdminParameters from './pages/AdminParameters';
import Elections from './pages/Elections';
import UserSetup from './pages/UserSetup';
import Reports from './pages/Reports';
import About from './pages/About';
import Ballot from './pages/Ballot';
import Betting from './pages/Betting';
import LoginButton from './components/LoginButton';
import './App.css';

console.log('App.tsx loaded');

function AppRoutes() {
  console.log('AppRoutes rendering');
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Dev-only: prefer seeded email/password (if set) or fallback to anonymous on localhost
    if (typeof window !== 'undefined' && window.location.hostname.includes('localhost')) {
      (async () => {
        try {
          console.log('Dev login: checking env vars', { devEmail: import.meta.env.VITE_DEV_EMAIL, devPass: !!import.meta.env.VITE_DEV_PASSWORD });
          const already = localStorage.getItem('dev:seeded-signed-strawman');
          const devEmail = import.meta.env.VITE_DEV_EMAIL;
          const devPass = import.meta.env.VITE_DEV_PASSWORD;
          if (!auth.currentUser && !already) {
            if (devEmail && devPass) {
              console.log('Dev login: attempting seeded sign-in with', devEmail);
              try {
                await signInWithEmailAndPassword(auth, devEmail, devPass);
                localStorage.setItem('dev:seeded-signed-strawman', '1');
                console.log('Dev login: seeded sign-in successful');
                return;
              } catch (e) {
                console.error('Dev login: seeded sign-in failed', e);
                // seeded login failed, only fall back to anonymous if still not signed in
                if (!auth.currentUser) {
                  console.log('Dev login: falling back to anonymous');
                  try {
                    await signInAnonymously(auth);
                    localStorage.setItem('dev:seeded-signed-strawman', '1');
                    console.log('Dev login: anonymous sign-in successful');
                  } catch (e) {
                    console.error('Dev login: anonymous failed', e);
                    // ignore
                  }
                }
              }
            } else {
              // Only sign in anonymously if not already signed in
              if (!auth.currentUser) {
                console.log('Dev login: falling back to anonymous');
                try {
                  await signInAnonymously(auth);
                  localStorage.setItem('dev:seeded-signed-strawman', '1');
                  console.log('Dev login: anonymous sign-in successful');
                } catch (e) {
                  console.error('Dev login: anonymous failed', e);
                  // ignore
                }
              }
            }
          } else {
            console.log('Dev login: already signed in or skipped', { currentUser: !!auth.currentUser, already });
          }
        } catch (e) {
          console.error('Dev login: error', e);
          // dev helper - ignore
        }
      })();
    }
    // Process redirect result (if returning from Google redirect sign-in)
    (async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // user signed in via redirect; onAuthStateChanged will also fire
          // give explicit feedback so devs see the result immediately
          try {
            // result.user may be undefined in some flows; guard defensively
            // eslint-disable-next-line no-alert
            alert('Signed in as ' + ((result as any).user?.email || 'unknown'));
          } catch {
            // ignore alert errors
          }
          setLoginError?.(null);
        }
      } catch (e: any) {
        const details = {
          message: e?.message,
          code: e?.code,
          customData: e?.customData,
          raw: e
        };
        (window as any).__LAST_SIGNIN_ERROR = details;
        setLoginError?.(e?.message || String(e));
      }
    })();

    const unsub = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u && u.email) {
        try {
          // Fetch user profile directly from Firestore
          const userDoc = await getDoc(doc(db, 'users', String(u.email)));
          if (userDoc.exists()) {
            setProfile(userDoc.data());
          } else {
            setProfile({
              electionId: "2000",
              name: u.email,
              email: u.email
            });
          }
        } catch {
          setProfile({
            electionId: "2000",
            name: u.email,
            email: u.email
          });
        }
      } else {
        setProfile(null);
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    // Simple email/password login prompt
    const email = prompt('Email:');
    const password = prompt('Password:');
    if (email && password) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (e: any) {
        // store error on window so user can copy it if needed
        // Some Firebase errors expose additional JSON in e.customData or e.code.
        const details = {
          message: e?.message,
          code: e?.code,
          customData: e?.customData,
          raw: e
        };
        (window as any).__LAST_SIGNIN_ERROR = details;
        // Prefer a short human message for UI
        setLoginError?.(e?.message || String(e));
      }
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithRedirect(auth, provider);
    } catch (e: any) {
      const details = {
        message: e?.message,
        code: e?.code,
        customData: e?.customData,
        raw: e
      };
      (window as any).__LAST_SIGNIN_ERROR = details;
      setLoginError?.(e?.message || String(e));
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  return (
    <>
      {/* Admob Banner Placeholder - Top of every page */}
      <div style={{
        width: '100%',
        height: 80,
        background: 'linear-gradient(90deg, #f8fafc 0%, #e0eafc 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 2px 8px #0001',
        marginBottom: 0,
        position: 'relative',
        zIndex: 100,
      }}>
        <span style={{ color: '#bbb', fontSize: 18 }}>Admob Banner</span>
      </div>
  <nav style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'center' }}>
  <Link to="/">Home</Link>
  <Link to="/ballot">Ballot</Link>
  <Link to="/reports">Reports</Link>
  <Link to="/betting">Betting</Link>
  <Link to="/setup">User Setup</Link>
  <Link to="/elections">Elections</Link>
  <Link to="/about">About</Link>
  <Link to="/admin-parameters">Admin Parameters</Link>
        <div style={{ marginLeft: 'auto' }}>
          {loginError && <span style={{ color: 'red', marginRight: 12 }}>{loginError}</span>}
          {user ? (
            <>
              <span style={{ marginRight: 12 }}>{user.email}</span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <>
              <LoginButton />
            </>
          )}
        </div>
      </nav>
      {user?.isAnonymous && (
        <div style={{position:'fixed',right:12,top:96,zIndex:9999,background:'#ffeb3b',color:'#000',padding:'6px 10px',borderRadius:6,fontSize:12,fontWeight:600}}>DEV: anon {String(user.uid).slice(0,8)}</div>
      )}
      <Routes>
  <Route path="/" element={<Home />} />
  <Route path="/ballot" element={<Ballot />} />
  <Route path="/reports" element={<Reports />} />
  <Route path="/betting" element={<Betting />} />
  <Route path="/setup" element={<UserSetup />} />
  <Route path="/elections" element={<Elections />} />
  <Route path="/about" element={<About />} />
  <Route path="/admin-parameters" element={<AdminParameters />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppRoutes />
    </Router>
  );
}

export default App;
