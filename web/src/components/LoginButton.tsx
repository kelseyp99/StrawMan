import React, { useEffect, useState } from 'react';
import { auth } from '../firebase';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

const LoginButton: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e) {
      alert('Login failed: ' + String(e));
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>{user.displayName || user.email}</span>
        <button onClick={logout} style={{ padding: '4px 10px', fontSize: 13 }}>Sign Out</button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      style={{ padding: '6px 16px', fontSize: 14, background: '#4285F4', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
    >
      Sign in with Google
    </button>
  );
};

export default LoginButton;
