
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Tables from './pages/Tables';
import Reports from './pages/Reports';
import About from './pages/About';
import './App.css';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

function App() {
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const unsub = onAuthStateChanged(auth, setUser);
    return () => unsub();
  }, []);

  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (e) {
      alert('Google sign-in failed');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      alert('Sign out failed');
    }
  };

  return (
    <Router>
      <nav style={{ display: 'flex', gap: 16, padding: 16, alignItems: 'center' }}>
        <Link to="/">Home</Link>
        <Link to="/tables">Tables</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/about">About</Link>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {user ? (
            <>
              <img src={user.photoURL || ''} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} />
              <span>{user.displayName || user.email}</span>
              <button onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <button onClick={handleSignIn}>Sign In with Google</button>
          )}
        </div>
      </nav>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </Router>
  );
}

export default App;
