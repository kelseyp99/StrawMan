import React from 'react';
import { Link } from 'react-router-dom';

const Dj: React.FC = () => (
  <div style={{maxWidth:600,margin:'80px auto',padding:32,background:'#222',borderRadius:16,boxShadow:'0 4px 24px rgba(0,0,0,0.3)',textAlign:'center',color:'#fff'}}>
    <img src="/sequoia logo.png" alt="Sequoia Logo" style={{width:'160px',marginBottom:'24px'}} />
    <video
      src="/daji-intro.mp4"
      autoPlay
      loop
      muted
      style={{ width: '100%', maxHeight: '320px', objectFit: 'cover', borderRadius: '16px', marginBottom: '32px' }}
    />
    <h1>DaJi</h1>
    <h2 style={{color:'#00e676',fontWeight:600,marginTop:-10,marginBottom:24}}>AI Powered DJ Software by Sequoia</h2>
    <p style={{fontWeight:500, color:'#00e676', marginBottom:'2em'}}>Written for DJ&apos;s by DJ&apos;s</p>
    <p style={{fontSize:'1.3rem',marginBottom:'2em'}}>Revolutionize your sets with DaJi, the world&apos;s first AI-driven platform for DJs.<br />
      Mix, automate, and create with intelligent tools designed for music professionals and enthusiasts alike.</p>
    <ul style={{textAlign:'left',maxWidth:400,margin:'0 auto 2em auto',fontSize:'1.1rem',color:'#b2ffb2'}}>
      <li>🎧 AI-assisted mixing and transitions</li>
      <li>🔊 Smart track recommendations</li>
      <li>⚡ Real-time crowd response analysis</li>
      <li>🛠️ Automated set building and scheduling</li>
      <li>🌐 Cloud sync and collaboration</li>
    </ul>
    <p style={{marginBottom:'2em'}}>DaJi is built for the next generation of DJs.<br />
      <span style={{color:'#00e676',fontWeight:500}}>Powered by Sequoia AI.</span></p>
    <a href="#" style={{display:'inline-block',background:'#00e676',color:'#181818',fontWeight:600,padding:'12px 32px',borderRadius:8,textDecoration:'none',fontSize:'1.1rem',boxShadow:'0 2px 8px rgba(0,0,0,0.15)',marginBottom:'2em'}}>Get Early Access</a>
    <br /><br />
  <Link to="/" style={{color:'#00e676',fontSize:'1.1rem',textDecoration:'underline'}}>Request a Song</Link>
    <br /><br />
    <Link to="/song-list" style={{color:'#00e676',fontSize:'1.1rem',textDecoration:'underline'}}>View Song Requests</Link>
    <div style={{marginTop:'2em',fontSize:'0.9em',color:'#aaa'}}>&copy; 2025 Sequoia. All rights reserved.<br />Follow us for updates and launch announcements.</div>
  </div>
);

export default Dj;
