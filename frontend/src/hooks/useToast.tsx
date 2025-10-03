import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { Toast, type ToastProps } from '../components/ui/Toast';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: string;
  variant?: ToastVariant;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  toast: (message: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const toast = useCallback((message: Omit<ToastMessage, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...message, id }]);
  }, []);

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
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string) => void }> = ({
  toasts,
  removeToast,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          id={toast.id}
          variant={toast.variant}
          title={toast.title}
          description={toast.description}
          action={toast.action}
          onClose={removeToast}
          duration={toast.duration}
        />
      ))}
    </div>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
