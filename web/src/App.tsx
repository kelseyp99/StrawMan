import React from 'react';

import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import Tables from './pages/Tables';
import Reports from './pages/Reports';
import About from './pages/About';
import './App.css';


function App() {
  return (
    <Router>
      <nav style={{ display: 'flex', gap: 16, padding: 16 }}>
        <Link to="/">Home</Link>
        <Link to="/tables">Tables</Link>
        <Link to="/reports">Reports</Link>
        <Link to="/about">About</Link>
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
