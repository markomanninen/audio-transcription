import { cva } from 'class-variance-authority';

export const toastVariants = cva(
  'pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-lg border p-4 shadow-lg transition-all',
  {
    variants: {
      variant: {
        default: 'bg-card text-card-foreground border-border',
        success: 'bg-green-50 text-green-900 border-green-200 dark:bg-green-900/80 dark:text-green-100 dark:border-green-800',
        error: 'bg-red-50 text-red-900 border-red-200 dark:bg-red-900/80 dark:text-red-100 dark:border-red-800',
        warning: 'bg-yellow-50 text-yellow-900 border-yellow-200 dark:bg-yellow-900/80 dark:text-yellow-100 dark:border-yellow-800',
        info: 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/80 dark:text-blue-100 dark:border-blue-800',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);