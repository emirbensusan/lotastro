import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Initialize performance tracking early
import { markPerformance } from './hooks/usePerformanceMetrics'
markPerformance('main_tsx_start');

// Fix iOS Safari 100vh issue by setting --vh CSS variable
const setVH = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

setVH();
window.addEventListener('resize', setVH);
window.addEventListener('orientationchange', setVH);

markPerformance('before_render');
createRoot(document.getElementById("root")!).render(<App />);
markPerformance('after_render_call');
