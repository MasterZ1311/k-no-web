import React from 'react';
import { createRoot } from 'react-dom/client';
import '../services/webBridge';
import { App } from './App';
import './styles/index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('[káno̱ Boot] Failed to find root element to mount React DOM.');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
