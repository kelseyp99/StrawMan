


import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import Home from './Home';
import SongRequest from './SongRequest';
import SongList from './SongList';
import Dj from './Dj';

const App: React.FC = () => (
  <Router>
    <Routes>
  <Route path="/" element={<Home />} />
  <Route path="/song-request" element={<SongRequest />} />
  <Route path="/song-list" element={<SongList />} />
  <Route path="/dj" element={<Dj />} />
    </Routes>
  </Router>
);

export default App;
