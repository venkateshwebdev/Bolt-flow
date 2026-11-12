import { Children, isValidElement, useEffect, useRef, useState, useMemo, lazy, Suspense, type ReactNode } from 'react';
import { Link, NavLink, useLocation, useParams } from 'react-router-dom';
import Markdown, { type Components } from 'react-markdown';
import { guideSnippets, runnableExample, type RunnableExample } from './sandbox/examples';
import { ViewTabs, type ExampleView } from './sandbox/ViewTabs';
import './sandbox/sandbox.css';
const ExampleSandbox = lazy(() => import('./sandbox/ExampleSandbox'));
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight, Check, Copy, Menu, Search, X } from 'lucide-react';
import { SiteHeader } from './ui';
import './documentation.css';
import { HighlightedCode } from './SourceCode';

const pages = [
  { slug: 'overview', title: 'Introduction', group: 'Get started', description: 'The architecture, packages, and possibilities.' },
  { slug: 'quickstart', title: 'Installation & quickstart', group: 'Get started', description: 'Install locally and build your first React editor.' },
  { slug: 'react-flow', title: 'React Flow-style API', group: 'Get started', description: 'Familiar nodes and edges, optional drawing, and simple JSON saving.' },
  { slug: 'playground', title: 'Using the playground', group: 'Get started', description: 'A hands-on tour of the editor and every workspace panel.' },
  { slug: 'document-model', title: 'Documents & state', group: 'Build your editor', description: 'Nodes, edges, annotations, JSON, and immutable transactions.' },
  { slug: 'react-editor', title: 'Editor layout & UI', group: 'Build your editor', description: 'Compose panels, toolbars, actions, and shortcuts.' },
  { slug: 'nodes-edges', title: 'Custom nodes & edges', group: 'Build your editor', description: 'Render your own components and editable connections.' },
  { slug: 'drawing', title: 'Drawing & annotations', group: 'Build your editor', description: 'Ink, shapes, rich text, comments, and attachment chains.' },
  { slug: 'styling', title: 'Themes & customization', group: 'Build your editor', description: 'Tokens, defaults, custom tools, fonts, and portable presets.' },
  { slug: 'commands-plugins', title: 'Commands & plugins', group: 'Extend the platform', description: 'Build and load optional capabilities with scoped cleanup.' },
  { slug: 'persistence', title: 'Saving & storage', group: 'Extend the platform', description: 'Manual saving, autosave, adapters, and concurrency.' },
  { slug: 'workflow-json', title: 'Workflow & generated JSON', group: 'Extend the platform', description: 'Preserve execution data while restoring canvas presentation.' },
  { slug: 'export', title: 'Import & export', group: 'Extend the platform', description: 'Portable documents, PNG images, and saved viewports.' },
  { slug: 'recipes', title: 'Integration recipes', group: 'Reference', description: 'Practical patterns for custom shells and host actions.' },
  { slug: 'api-reference', title: 'API reference', group: 'Reference', description: 'Exports, properties, commands, settings, and defaults.' },
  { slug: 'troubleshooting', title: 'Troubleshooting & deployment', group: 'Reference', description: 'Diagnose common issues and deploy the documentation site.' },
];
import guide0 from '../../../docs/guide/recipes.md?raw';
import guide1 from '../../../docs/guide/overview.md?raw';
import guide2 from '../../../docs/guide/nodes-edges.md?raw';
import guide3 from '../../../docs/guide/document-model.md?raw';
import guide4 from '../../../docs/guide/troubleshooting.md?raw';
import guide5 from '../../../docs/guide/quickstart.md?raw';
import guide6 from '../../../docs/guide/playground.md?raw';
import guide7 from '../../../docs/guide/persistence.md?raw';
import guide8 from '../../../docs/guide/workflow-json.md?raw';
import guide9 from '../../../docs/guide/react-editor.md?raw';
import guide10 from '../../../docs/guide/styling.md?raw';
import guide11 from '../../../docs/guide/export.md?raw';
import guide12 from '../../../docs/guide/drawing.md?raw';
import guide13 from '../../../docs/guide/commands-plugins.md?raw';
import guide14 from '../../../docs/guide/api-reference.md?raw';
import reactFlowGuide from '../../../docs/guide/react-flow.md?raw';
const sources: Record<string, string> = {
  'react-flow': reactFlowGuide,
  'recipes': guide0,
  'overview': guide1,
  'nodes-edges': guide2,
  'document-model': guide3,
  'troubleshooting': guide4,
  'quickstart': guide5,
  'playground': guide6,
  'persistence': guide7,
  'workflow-json': guide8,
  'react-editor': guide9,
  'styling': guide10,
  'export': guide11,
  'drawing': guide12,
  'commands-plugins': guide13,
  'api-reference': guide14,
};
const sourceFor = (slug: string) => sources[slug] ?? '';
const textOf = (children: ReactNode): string => Children.toArray(children).map(child => typeof child === 'string' || typeof child === 'number' ? String(child) : isValidElement<{ children?: ReactNode }>(child) ? textOf(child.props.children) : '').join('');
const headingId = (text: string) => text.toLowerCase().replace(/[`*]/g, '').replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
function CodeBlock({ children, example, label }: { children?: ReactNode; example?: RunnableExample; label: string }) {
  const [status, setStatus] = useState('Copy'), [view, setView] = useState<ExampleView>('code'), [open, setOpen] = useState(false);
  return <section className="docs-example" data-example={label}>
    {open && example ? <Suspense fallback={<p role="status">Loading example…</p>}><ExampleSandbox example={example} label={label} view={view} onViewChange={setView} onStop={() => { setOpen(false); setView('code'); }} /></Suspense> : <>
      {example && <div className="sandbox-toolbar"><ViewTabs value={view} label={label} onChange={next => { setView(next); if (next !== 'code') setOpen(true); }} /><span className="example-hint">Interactive example</span></div>}
      <div role="tabpanel" id={`${label}-panel`} aria-labelledby={`${label}-tab-code`} className="docs-code"><button type="button" aria-label="Copy code" onClick={async () => { try { await navigator.clipboard.writeText(textOf(children).replace(/\n$/, '')); setStatus('Copied'); } catch { setStatus('Select text to copy'); } }}>{status === 'Copied' ? <Check size={13} /> : <Copy size={13} />}<span aria-live="polite">{status}</span></button><pre><HighlightedCode source={textOf(children)} language={isValidElement<{ className?: string }>(children) ? children.props.className?.replace('language-', '') : 'tsx'} /></pre></div>
    </>}
  </section>;
}
export default function Documentation() {
  const { slug = 'overview' } = useParams();
  const location = useLocation();
  const current = pages.find(page => page.slug === slug);
  const content = sourceFor(slug);
  const [query, setQuery] = useState(''), [menu, setMenu] = useState(false);
  const article = useRef<HTMLElement>(null);
  useEffect(() => {
    document.title = `${current?.title ?? 'Page not found'} · Bolt Flow`;
    setMenu(false); setQuery('');
    if (!location.hash) window.scrollTo(0, 0);
    else requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView());
  }, [slug, location.hash, current?.title]);
  const headings: { title: string; id: string }[] = [];
  let code = false;
  for (const line of content.split('\n')) { if (line.startsWith('```')) code = !code; if (!code && line.startsWith('## ')) { const title = line.slice(3); headings.push({ title, id: headingId(title) }); } }
  const matches = pages.filter(page => `${page.title} ${page.description} ${sourceFor(page.slug)}`.toLowerCase().includes(query.toLowerCase().trim()));
  const index = pages.findIndex(page => page.slug === slug);
  const markdownComponents = useMemo<Components>(() => ({
          h2: ({ children }) => <h2 id={headingId(textOf(children))}><a href={`#${headingId(textOf(children))}`} className="heading-anchor">{children}</a></h2>,
          h3: ({ children }) => <h3 id={headingId(textOf(children))}>{children}</h3>,
          pre: ({ children, node }) => {
            const snippets = guideSnippets(content);
            const index = snippets.findIndex(snippet => snippet.line === node?.position?.start.line);
            if (index < 0) return <pre>{children}</pre>;
            const label = `${slug}-${index}`;
            return <CodeBlock key={label} label={label} example={['sh', 'bash', 'nginx', 'text'].includes(snippets[index].language) ? undefined : runnableExample(slug, index, snippets)}>{children}</CodeBlock>;
          },
          table: ({ children }) => <div className="docs-table"><table>{children}</table></div>,
          a: ({ href = '', children }) => { const local = href.match(/^(?:\.\/)?([a-z0-9-]+)\.md(#[\w-]+)?$/); return local ? <Link to={`/docs/${local[1]}${local[2] ?? ''}`}>{children}</Link> : href.startsWith('/docs') || href === '/playground' ? <Link to={href}>{children}</Link> : <a href={href}>{children}</a>; },
        
  }), [slug, content]);
  return <div className="docs-site">
    <a className="skip-link" href="#documentation-content">Skip to content</a>
    <SiteHeader><Link className="button primary" to="/playground">Open playground<ArrowRight size={14} /></Link></SiteHeader>
    <button className="docs-menu-button" aria-expanded={menu} aria-controls="docs-navigation" onClick={() => setMenu(!menu)}>{menu ? <X size={17} /> : <Menu size={17} />}Browse documentation</button>
    <div className="docs-layout">
      <aside className={`docs-sidebar ${menu ? 'is-open' : ''}`} id="docs-navigation" aria-label="Documentation navigation">
        <label className="docs-search"><Search size={15} /><input type="search" aria-label="Search documentation" placeholder="Search documentation…" value={query} onChange={e => setQuery(e.target.value)} /></label>
        {query ? <div className="docs-search-results"><span className="docs-nav-label" role="status">{matches.length} results</span>{matches.map(page => <Link key={page.slug} to={`/docs/${page.slug}`}><strong>{page.title}</strong><small>{page.description}</small></Link>)}{!matches.length && <p>No matching pages. Try “save”, “toolbar”, or “node”.</p>}</div> : [...new Set(pages.map(page => page.group))].map(group => <nav key={group} aria-label={group}><span className="docs-nav-label">{group}</span>{pages.filter(page => page.group === group).map(page => <NavLink key={page.slug} className={page.slug === slug ? 'current' : ''} to={page.slug === 'overview' ? '/docs' : `/docs/${page.slug}`}>{page.title}</NavLink>)}</nav>)}
        <div className="docs-version"><span className="status-dot" />v0.1.0 · Unpublished alpha<small>React 19 · TypeScript · MIT</small></div>
      </aside>
      <main ref={article} className="docs-article" id="documentation-content" tabIndex={-1}>
        <div className="docs-breadcrumb"><Link to="/docs">Documentation</Link><span>/</span><span>{current?.group ?? 'Not found'}</span></div>
        {current ? <><Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{content}</Markdown><div className="docs-pagination">{pages[index - 1] ? <Link to={`/docs/${pages[index - 1].slug}`}><small><ArrowLeft size={13} />Previous</small><strong>{pages[index - 1].title}</strong></Link> : <span />}{pages[index + 1] && <Link to={`/docs/${pages[index + 1].slug}`}><small>Next<ArrowRight size={13} /></small><strong>{pages[index + 1].title}</strong></Link>}</div><footer className="docs-footer">Bolt Flow documentation · Source-backed examples · MIT licensed</footer></> : <><h1>Page not found</h1><p>Choose a guide from the navigation or return to the introduction.</p><Link to="/docs">Go to introduction</Link></>}
      </main>
      <aside className="docs-toc" aria-label="On this page"><strong>On this page</strong><nav>{headings.map(heading => <a key={heading.id} href={`#${heading.id}`}>{heading.title}</a>)}</nav><div className="docs-toc-card"><span>See it in action</span><p>Experiment with a real canvas while you build.</p><Link to="/playground">Open playground<ArrowRight size={13} /></Link></div></aside>
    </div>
  </div>;
}
