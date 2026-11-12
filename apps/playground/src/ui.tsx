import { useEffect, useId, useRef, type ReactNode } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { ArrowUpRight, X, Zap, type LucideIcon } from 'lucide-react';

export function SiteHeader({ children }: { children?: ReactNode }) {
  return <header className="site-header">
    <Link className="brand" to="/docs" aria-label="Bolt Flow home"><span className="brand-mark"><Zap size={19} fill="currentColor" /></span><strong>Bolt Flow</strong><span className="version-badge">alpha</span></Link>
    <nav className="site-nav" aria-label="Main navigation"><NavLink to="/playground">Playground</NavLink><NavLink to="/docs">Documentation</NavLink></nav>
    <div className="header-actions">{children}</div>
  </header>;
}
export function IconButton({ icon: Icon, label, onClick, active, disabled = false }: { icon: LucideIcon; label: string; onClick?: () => void; active?: boolean; disabled?: boolean }) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''}`} aria-label={label} aria-pressed={active} title={label} onClick={onClick} disabled={disabled}><Icon size={17} strokeWidth={1.8} /></button>;
}
export function Modal({ title, subtitle, children, close, wide }: { title: string; subtitle?: string; children: ReactNode; close: () => void; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), titleId = useId(), descriptionId = useId();
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => { ref.current?.close(); previous?.focus({ preventScroll: true }); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} aria-labelledby={titleId} aria-describedby={subtitle ? descriptionId : undefined} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')]
      .filter(item => !item.matches(':disabled, [tabindex="-1"]') && item.getClientRects().length > 0);
    const first = items[0], last = items.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  }}>
    <div className="modal-header"><div><h2 id={titleId}>{title}</h2>{subtitle && <p id={descriptionId}>{subtitle}</p>}</div><IconButton icon={X} label="Close dialog" onClick={close} /></div>
    <div className="modal-body">{children}</div>
  </dialog>;
}
export function DocumentationLink({ to = '/docs', children = 'Read the guide' }: { to?: string; children?: ReactNode }) {
  return <Link className="documentation-link" to={to}>{children}<ArrowUpRight size={14} /></Link>;
}
