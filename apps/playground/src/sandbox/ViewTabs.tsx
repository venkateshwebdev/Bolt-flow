export type ExampleView = 'preview' | 'code';

export function ViewTabs({ value, onChange, label }: { value: ExampleView; onChange: (value: ExampleView) => void; label: string }) {
  const views = ['preview', 'code'] as const;
  return <div className="sandbox-segments" role="tablist" aria-label="Example view" onKeyDown={event => {
    const current = views.indexOf(value);
    const next = event.key === 'ArrowRight' ? (current + 1) % views.length : event.key === 'ArrowLeft' ? (current + views.length - 1) % views.length : event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : -1;
    if (next < 0) return;
    event.preventDefault(); onChange(views[next]);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  }}>{views.map(view => <button key={view} type="button" role="tab" id={`${label}-tab-${view}`} aria-controls={`${label}-panel`} tabIndex={value === view ? 0 : -1} aria-selected={value === view} onClick={() => onChange(view)}>{view === 'preview' ? 'Preview' : 'Code'}</button>)}</div>;
}
