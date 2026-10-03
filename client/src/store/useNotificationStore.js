import { create } from 'zustand';

let toastId = 0;

function getNoticeText(value, fallback) {
  if (typeof value === 'string' && value.trim()) return value;
  if (value && typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
  }
  return fallback;
}

export const useNotificationStore = create((set) => ({
  toasts: [],
  addToast: ({ type = 'info', message, code, duration = 5000 } = {}) => {
    const id = ++toastId;
    set((s) => ({
      toasts: [...s.toasts, {
        id,
        type,
        message: getNoticeText(message, 'Something went wrong. Please try again.'),
        code: typeof code === 'string' ? code : undefined,
      }],
    }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
