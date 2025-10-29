import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log('index.tsx loaded');

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
console.log('root created', root);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
