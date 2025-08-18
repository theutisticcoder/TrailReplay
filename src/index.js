import { TrailReplayApp } from './core/TrailReplayApp.js';
import { inject } from '@vercel/analytics';
import { setupFeedbackForm } from './ui/feedback.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Initialize Vercel Analytics
  inject();
  
  const app = new TrailReplayApp();
  window.app = app; // Make app globally accessible
  await app.init();
  // Wire feedback form after header/footer load
  setupFeedbackForm();
}); 