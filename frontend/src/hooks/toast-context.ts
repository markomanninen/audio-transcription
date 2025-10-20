import { createContext } from 'react';

export type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
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

export interface ToastContextType {
  toasts: ToastMessage[];
  toast: (message: Omit<ToastMessage, 'id'>) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);