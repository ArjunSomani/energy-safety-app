import type { Warning } from '@/lib/types';
export default function WarningStrip({warnings}:{warnings:Warning[]}){return <div className="grid gap-2">{warnings.map(w=><p key={w.id} className="panel p-3 text-sm"><b className="mono">{w.id}</b> — {w.message}</p>)}</div>}
