import { useState, useCallback, ReactNode } from 'react';
import { Toast } from '../components/ui/Toast';
import { ToastContext, ToastMessage } from './toast-context';

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast: ToastMessage = {
      id,
      duration: 5000,
      ...message,
    };

    setToasts((prev) => [...prev, newToast]);

    // Auto-remove after duration
    setTimeout(() => {
      removeToast(id);
    }, newToast.duration);
  }, [removeToast]);

  const success = useCallback((title: string, description?: string) => {
    toast({ variant: 'success', title, description });
  }, [toast]);

  const error = useCallback((title: string, description?: string) => {
    toast({ variant: 'error', title, description });
  }, [toast]);

  const warning = useCallback((title: string, description?: string) => {
    toast({ variant: 'warning', title, description });
  }, [toast]);

  const info = useCallback((title: string, description?: string) => {
    toast({ variant: 'info', title, description });
  }, [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, removeToast }}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast: ToastMessage) => (
          <Toast
            key={toast.id}
            id={toast.id}
            variant={toast.variant}
            title={toast.title}
            description={toast.description}
            action={toast.action}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
};