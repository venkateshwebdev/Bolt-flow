import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import * as Core from 'bolt-flow-core';
import * as Bolt from 'bolt-flow-react';
import * as Draw from 'bolt-flow-plugin-draw';
import * as History from 'bolt-flow-plugin-history';
import * as Layout from 'bolt-flow-plugin-layout';
import * as Storage from 'bolt-flow-plugin-storage';
import * as Export from 'bolt-flow-plugin-export';
import * as ImageExport from 'bolt-flow-plugin-image-export';
import * as XYFlow from '@xyflow/react';
import * as Babel from '@babel/standalone';
import 'bolt-flow-react/style.css';
import * as Demo from './demo';

const session = (window as unknown as { __exampleSession: string }).__exampleSession;
const report = (type: string, value: unknown) => parent.postMessage({ source: 'bolt-example', session, type, value }, '*');
const originalLog = console.log;
console.log = (...args: unknown[]) => { originalLog(...args); report('log', args.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ')); };
console.error = (...args: unknown[]) => report('error', args.map(value => value instanceof Error ? value.message : String(value)).join(' '));
window.alert = message => console.log(message);
window.addEventListener('error', event => report('error', event.message));
window.addEventListener('unhandledrejection', event => report('error', String(event.reason)));
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  componentDidCatch(error: Error) { report('error', error.message); }
  render() { return this.state.error ? <pre role="alert">{this.state.error}</pre> : this.props.children; }
}
const modules: Record<string, unknown> = {
  react: React, 'react-dom/client': ReactDOM, '@xyflow/react': XYFlow,
  'bolt-flow-core': Core, 'bolt-flow-react': Bolt,
  'bolt-flow-plugin-draw': Draw, 'bolt-flow-plugin-history': History,
  'bolt-flow-plugin-layout': Layout, 'bolt-flow-plugin-storage': Storage,
  'bolt-flow-plugin-export': Export, 'bolt-flow-plugin-image-export': ImageExport,
  './demo': Demo,
};
let started = false;
window.addEventListener('message', async event => {
  if (event.source !== parent || event.data?.source !== 'bolt-example-host' || event.data.session !== session || started) return;
  started = true;
  try {
    const { code, css } = event.data;
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const compiled = Babel.transform(code, { filename: 'Example.tsx', presets: ['typescript', ['react', { runtime: 'classic' }]],
      plugins: ['transform-dynamic-import', 'transform-modules-commonjs'], parserOpts: { allowAwaitOutsideFunction: true } })!.code!;
    const exports: { default?: React.ComponentType } = {};
    const require = (id: string) => { if (id.endsWith('.css')) return {}; if (!modules[id]) throw new Error(`Package "${id}" is not bundled in this sandbox.`); return modules[id]; };
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    await new AsyncFunction('require', 'exports', 'React', compiled)(require, exports, React);
    if (!exports.default) throw new Error('Export a default React component to render this example.');
    ReactDOM.createRoot(document.getElementById('root')!).render(<ErrorBoundary><exports.default /></ErrorBoundary>);
    report('ready', 'Example running');
  } catch (error) { report('error', error instanceof Error ? error.message : String(error)); }
});
report('boot', true);
