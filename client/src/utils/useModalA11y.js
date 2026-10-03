import { useEffect, useRef } from 'react';

export function useModalA11y(isOpen, onClose) {
  const modalRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const modal = modalRef.current;
    const focusable = () => [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled);
    const firstField = modal.querySelector('input:not(:disabled), select:not(:disabled), textarea:not(:disabled)');
    (firstField || focusable()[0])?.focus({ preventScroll: true });
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    modal?.addEventListener('keydown', handleKeyDown);
    return () => modal?.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return modalRef;
}
