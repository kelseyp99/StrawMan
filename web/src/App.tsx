import React, { useEffect, useState } from 'react';

import { BrowserRouter as Router, Routes, Route, Link, useNavigate } from 'react-router-dom';
import { auth, db } from './firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import Home from './pages/Home';
import Tables from './pages/Tables';
import Reports from './pages/Reports';
import About from './pages/About';
import Ballot from './pages/Ballot';
import './App.css';



function AppRoutes() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
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
        alert(e.message);
      }
    }
  };

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/');
  };

  return (
    <>
      <nav style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'center' }}>
        <Link to="/">Home</Link>
        <Link to="/ballot">Ballot</Link>
        <Link to="/tables">Tables</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/about">About</Link>
        <div style={{ marginLeft: 'auto' }}>
          {user ? (
            <>
              <span style={{ marginRight: 12 }}>{user.email}</span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button onClick={handleLogin}>Login</button>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ballot" element={<Ballot address={profile?.address || "123 Main St, City, State ZIP"} electionId={profile?.electionId || "2000"} />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/reports" element={<Reports electionId={profile?.electionId || "2000"} />} />
        <Route path="/about" element={<About />} />
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
