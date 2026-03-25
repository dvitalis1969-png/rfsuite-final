import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker for PWA
const updateSW = registerSW({
  onNeedRefresh() {
    // With autoUpdate and skipWaiting, this shouldn't be needed, but just in case:
    console.log('New content available, reloading...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);