import { useEffect, useRef } from 'react';

import { useConfirm } from '../state/confirm';

export function ConfirmDialog() {
  const request = useConfirm((s) => s.request);
  const close = useConfirm((s) => s.close);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!request) return;
    requestAnimationFrame(() => confirmBtnRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [request, close]);

  if (!request) return null;

  const handleConfirm = () => {
    request.onConfirm();
    close();
  };

  return (
    <div className="modal-backdrop" onMouseDown={close}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-label={request.title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="modal-title">{request.title}</h2>
        <p className="modal-message">{request.message}</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={close}>
            {request.cancelLabel ?? 'Cancel'}
          </button>
          <button
            ref={confirmBtnRef}
            className={`btn ${request.destructive ? 'btn-danger' : 'btn-primary'}`}
            onClick={handleConfirm}
          >
            {request.confirmLabel ?? 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
