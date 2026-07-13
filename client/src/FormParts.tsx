import type { InputHTMLAttributes, ReactNode } from 'react';

export function Choice({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return <button type="button" className={`choice-card ${active ? 'active' : ''}`} onClick={onClick}><span className="choice-indicator"/><strong>{title}</strong><small>{text}</small></button>;
}

export function Field({ label, error, children, hint }: { label: string; error?: string; children: ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}{error && <em>{error}</em>}</label>;
}

export function Toggle({ label, ...props }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="toggle"><input type="checkbox" {...props}/><span/><b>{label}</b></label>;
}

export function Summary({ title, value }: { title: string; value: string }) { return <div className="summary"><small>{title}</small><strong>{value}</strong></div>; }
