export {}
import React, { useState } from 'react';
import {loadStripe} from '@stripe/stripe-js';
import {Elements, CardElement, useStripe, useElements} from '@stripe/react-stripe-js';
import { Link } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getFirestore, addDoc, collection } from 'firebase/firestore';

interface SongForm {
  name: string;
  song: string;
  artist: string;
  notes: string;
}

// Firebase config for StrawMan web app
const firebaseConfig = {
  apiKey: "AIzaSyC1dU8xLrg-c7qS_ALHBi3p1VuH049vePk",
  authDomain: "strawman-42.firebaseapp.com",
  projectId: "strawman-42",
  storageBucket: "strawman-42.firebasestorage.app",
  messagingSenderId: "894321564476",
  appId: "1:894321564476:android:4845037cdd1169f2e25c39"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


const stripePromise = loadStripe('pk_test_51HxxxxxxReplaceWithYourTestKey');

const SongRequestForm: React.FC = () => {
  const [form, setForm] = useState<SongForm>({ name: '', song: '', artist: '', notes: '' });
  const [tip, setTip] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [error, setError] = useState<string>('');
  const stripe = useStripe();
  const elements = useElements();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleTipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTip(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSuccess('');
    setError('');
    let tipAmount = parseFloat(tip) || 0;
    // Stripe payment
    if (tipAmount > 0 && stripe && elements) {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        setError('Card info missing');
        return;
      }
      // Simulate payment intent (replace with backend call in production)
      setSuccess('Tip processed (test mode).');
    }
    try {
      await addDoc(collection(db, 'songRequests'), {
        ...form,
        tip: tipAmount,
        timestamp: new Date().toISOString()
      });
      setSuccess('Request submitted!');
      setForm({ name: '', song: '', artist: '', notes: '' });
      setTip('');
    } catch (err: any) {
      setError('Error: ' + err.message);
    }
  };

  return (
    <div style={{maxWidth:500,margin:'60px auto',padding:32,background:'#222',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.3)',textAlign:'center',color:'#fff'}}>
  <img src="/StrawMan.png" alt="StrawMan Logo" style={{width:'160px',marginBottom:'24px'}} />
      <h1>Song Request</h1>
      <div style={{background:'#232323',color:'#fff',borderRadius:8,padding:'18px',marginBottom:'2em',boxShadow:'0 2px 8px rgba(0,0,0,0.10)'}}>
        <strong>Thanks for your song request!</strong><br />
        As DJ&apos;s, we strive to stay connected always.<br />
        We&apos;ll do our best to play it if it fits the vibe.<br />
        <span style={{color:'#00e676'}}>Clean versions only – no explicit lyrics.</span>
      </div>
      <form onSubmit={handleSubmit}>
        <label htmlFor="name">Your Name</label>
        <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required />
        <label htmlFor="song">Song Title</label>
        <input type="text" id="song" name="song" value={form.song} onChange={handleChange} required />
        <label htmlFor="artist">Artist</label>
        <input type="text" id="artist" name="artist" value={form.artist} onChange={handleChange} required />
        <label htmlFor="notes">Notes (optional)</label>
        <textarea id="notes" name="notes" rows={3} value={form.notes} onChange={handleChange}></textarea>
        <label htmlFor="tip">Tip Amount (USD)</label>
        <input type="number" id="tip" name="tip" value={tip} onChange={handleTipChange} min="0" step="0.01" style={{marginBottom:'1em'}} />
        {parseFloat(tip) > 0 && (
          <div style={{marginBottom:'1em'}}>
            <CardElement options={{hidePostalCode:true}} />
          </div>
        )}
        <button type="submit">Submit Request & Tip</button>
      </form>
      <div style={{color:'#00e676',marginTop:'1em'}}>{success}</div>
      <div style={{color:'#ff5252',marginTop:'1em'}}>{error}</div>
      <Link to="/dj" style={{color:'#00e676',fontSize:'1.1rem',textDecoration:'underline',display:'inline-block',marginTop:'2em'}}>Go to DJ Page</Link>
      <br />
      <Link to="/" style={{color:'#00e676',textDecoration:'none',display:'inline-block',marginTop:'2em'}}>&#8592; Back to Home</Link>
    </div>
  );
};

const Home: React.FC = () => (
  <Elements stripe={stripePromise}>
    <SongRequestForm />
  </Elements>
);



export default Home;
