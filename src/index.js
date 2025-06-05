import { TrailReplayApp } from './core/TrailReplayApp.js';

window.addEventListener('DOMContentLoaded', async () => {
  const app = new TrailReplayApp();
  window.app = app; // Make app globally accessible
  await app.init();
}); 