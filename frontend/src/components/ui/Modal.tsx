import type { ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  title: string;
  body: string;
  extra?: ReactNode;
  onClose: () => void;
}

export function Modal({ title, body, extra, onClose }: ModalProps) {
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).classList.contains('modal-backdrop')) {
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-box">
        <div className="modal-title">{title}</div>
        <div className="modal-body">{body}</div>
        {extra && <div style={{ marginBottom: 12 }}>{extra}</div>}
        <Button variant="ghost" fullWidth onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
