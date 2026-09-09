import { createRoot } from 'react-dom/client';
import { BoltRuntime } from 'bolt-flow-core';
import { BoltProvider } from 'bolt-flow-react';
import { launchTemplate } from './templates';
import App from './App';
import 'bolt-flow-react/style.css';
import './style.css';

const runtime = new BoltRuntime(launchTemplate());
createRoot(document.getElementById('root')!).render(<BoltProvider runtime={runtime}><App /></BoltProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => runtime.dispose());