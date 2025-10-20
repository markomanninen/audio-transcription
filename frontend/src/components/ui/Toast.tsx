import React, { useEffect } from 'react';
import { type VariantProps } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { toastVariants } from './toast-variants';

export interface ToastProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof toastVariants> {
  id: string;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  onClose?: (id: string) => void;
  duration?: number;
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, id, title, description, action, onClose, duration = 5000, ...props }, ref) => {
    useEffect(() => {
      if (duration && onClose) {
        const timer = setTimeout(() => {
          onClose(id);
        }, duration);

        return () => clearTimeout(timer);
      }
    }, [duration, id, onClose]);

    const getIcon = () => {
      switch (variant) {
        case 'success':
          return (
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                clipRule="evenodd"
              />
            </svg>
          );
        case 'error':
          return (
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clipRule="evenodd"
              />
            </svg>
          );
        case 'warning':
          return (
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
          );
        case 'info':
          return (
            <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
                clipRule="evenodd"
              />
            </svg>
          );
        default:
          return null;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), 'animate-slide-in-right', className)}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        {...props}
      >
        {variant && getIcon()}
        <div className="flex-1">
          {title && <div className="font-semibold">{title}</div>}
          {description && <div className="text-sm opacity-90">{description}</div>}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-sm font-medium hover:underline focus-ring rounded px-2 py-1"
          >
            {action.label}
          </button>
        )}
        {onClose && (
          <button
            onClick={() => onClose(id)}
            className="ml-auto flex-shrink-0 rounded-md p-1 hover:bg-black/10 focus-ring dark:hover:bg-white/10"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    );
  }
);

Toast.displayName = 'Toast';

export { Toast };
export default Toast;
