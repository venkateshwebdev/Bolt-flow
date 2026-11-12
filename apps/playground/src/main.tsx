import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, Link } from 'react-router-dom';
import { BoltRuntime, editingPlugin } from 'bolt-flow-core';
import { BoltProvider } from 'bolt-flow-react';
import { launchTemplate } from './templates';
import { SiteHeader } from './ui';
import 'bolt-flow-react/style.css';
import './style.css';

const Playground = lazy(() => import('./App'));
const Documentation = lazy(() => import('./Documentation'));
const runtime = new BoltRuntime(launchTemplate()).use(editingPlugin());
// Runtime stays alive across client-side navigation. Opening the docs never discards the canvas.
createRoot(document.getElementById('root')!).render(<BrowserRouter><BoltProvider runtime={runtime}>
  <Suspense fallback={<div className="route-loading" role="status">Loading Bolt Flow…</div>}><Routes>
    <Route path="/" element={<Navigate to="/docs" replace />} />
    <Route path="/playground" element={<Playground />} />
    <Route path="/docs/:slug?" element={<Documentation />} />
    <Route path="*" element={<><SiteHeader /><main className="not-found"><h1>Page not found</h1><p>That page does not exist.</p><Link to="/docs">Browse documentation</Link></main></>} />
  </Routes></Suspense>
</BoltProvider></BrowserRouter>);
if (import.meta.hot) import.meta.hot.dispose(() => runtime.dispose());
