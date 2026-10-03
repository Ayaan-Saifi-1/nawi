import { afterEach, describe, expect, it } from 'vitest';
import { useNotificationStore } from './useNotificationStore.js';

afterEach(() => {
  useNotificationStore.setState({ toasts: [] });
});

describe('notification store', () => {
  it('extracts a readable message from API error objects', () => {
    useNotificationStore.getState().addToast({
      type: 'error',
      code: 'VALIDATION_ERROR',
      message: { code: 'VALIDATION_ERROR', message: 'Required test readings are missing.' },
      duration: 0,
    });

    expect(useNotificationStore.getState().toasts[0]).toMatchObject({
      type: 'error',
      code: 'VALIDATION_ERROR',
      message: 'Required test readings are missing.',
    });
  });

  it('uses a safe message when the input cannot be rendered as text', () => {
    useNotificationStore.getState().addToast({ type: 'error', message: { code: 'UNKNOWN' }, duration: 0 });

    expect(useNotificationStore.getState().toasts[0].message).toBe('Something went wrong. Please try again.');
  });
});
