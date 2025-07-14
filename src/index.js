import { TrailReplayApp } from './core/TrailReplayApp.js';
import { inject } from '@vercel/analytics';

window.addEventListener('DOMContentLoaded', async () => {
  // Initialize Vercel Analytics
  inject();
  
  const app = new TrailReplayApp();
  window.app = app; // Make app globally accessible
  await app.init();
}); 