import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { registerConfirmation, type Confirmation } from '../lib/confirmation';
import { ui } from '../lib/ui';

export function ConfirmationHost() {
  const [pending, setPending] = useState<Confirmation | null>(null);
  const resolve = useRef<((answer: boolean) => void) | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  function answer(value: boolean) {
    resolve.current?.(value);
    resolve.current = null;
    setPending(null);
  }
  useEffect(() => {
    const unregister = registerConfirmation(value => new Promise<boolean>(done => {
      if (resolve.current) { done(false); return; }
      resolve.current = done;
      setPending(value);
    }));
    return () => { unregister(); resolve.current?.(false); resolve.current = null; };
  }, []);
  useEffect(() => { if (pending) dialog.current?.showModal(); }, [pending]);
  if (!pending) return null;
  return <dialog ref={dialog} aria-labelledby="confirmation-title" aria-describedby="confirmation-detail"
    onCancel={event => { event.preventDefault(); answer(false); }}
    className="fixed inset-0 m-auto w-[min(440px,calc(100%-32px))] rounded-2xl border border-line bg-white p-6 text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm">
    <ShieldCheck className="mb-3 text-brand" size={28} />
    <h2 id="confirmation-title" className="text-lg font-bold">{pending.title}</h2>
    <p id="confirmation-detail" className="my-4 text-sm leading-relaxed text-muted">{pending.detail}</p>
    <div className="flex justify-end gap-2">
      <button autoFocus className={ui('secondary-button')} onClick={() => answer(false)}>Annuler</button>
      <button className={ui('primary-button')} onClick={() => answer(true)}>{pending.destructive ? 'Confirmer la modification' : 'Confirmer'}</button>
    </div>
  </dialog>;
}
