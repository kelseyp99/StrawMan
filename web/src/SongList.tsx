// ...existing imports...


import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { initializeApp } from 'firebase/app';
import { getFirestore, getDocs, collection } from 'firebase/firestore';

type Song = {
  id: string;
  name: string;
  song: string;
  artist: string;
  notes: string;
  genre?: string;
  mood?: string;
  tempo?: string;
  timestamp?: string;
};

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

const SongList: React.FC = () => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchSongs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'songRequests'));
        const songData: Song[] = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || '',
            song: data.song || '',
            artist: data.artist || '',
            notes: data.notes || '',
            genre: data.genre,
            mood: data.mood,
            tempo: data.tempo,
            timestamp: data.timestamp
          };
        });
        setSongs(songData);
        setLoading(false);
      } catch (err: any) {
        setError('Error fetching songs: ' + err.message);
        setLoading(false);
      }
    };
    fetchSongs();
  }, []);

  return (
    <div style={{maxWidth:600,margin:'60px auto',padding:32,background:'#222',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.3)',color:'#fff'}}>
      <h1>Song Requests</h1>
      {loading && <div>Loading...</div>}
      {error && <div style={{color:'#ff5252'}}>{error}</div>}
      {!loading && !error && (
        <ul style={{listStyle:'none',padding:0}}>
          {songs.length === 0 ? (
            <li>No song requests found.</li>
          ) : (
            songs.map(song => (
              <li key={song.id} style={{marginBottom:'18px',background:'#333',borderRadius:8,padding:'12px'}}>
                <strong>{song.song}</strong> by {song.artist}<br />
                <span style={{color:'#00e676'}}>Requested by: {song.name}</span><br />
                {song.notes && <span>Notes: {song.notes}</span>}<br />
                <span style={{fontSize:'0.8em',color:'#aaa'}}>Submitted: {song.timestamp ? new Date(song.timestamp).toLocaleString() : ''}</span>
              </li>
            ))
          )}
        </ul>
      )}
      <Link to="/" style={{color:'#00e676',textDecoration:'none',display:'inline-block',marginTop:'2em'}}>&#8592; Back to Home</Link>
    </div>
  );
};

export default SongList;
