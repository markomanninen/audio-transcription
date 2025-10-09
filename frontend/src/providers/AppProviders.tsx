import React, { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../hooks/useTheme';
import { ToastProvider } from '../hooks/useToast';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry on circuit breaker blocks
        if (error.message?.includes('circuit breaker')) {
          return false
        }
        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && 'status' in error) {
          const status = (error as any).status
          if (status >= 400 && status < 500) return false
        }
        // Don't retry network errors more than once when backend might be down
        if ((error as any).code === 'ERR_NETWORK' && failureCount >= 1) {
          return false
        }
        // Retry up to 2 times for other errors (reduced from 3)
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(2000 * 2 ** attemptIndex, 10000), // Cap at 10 seconds
      staleTime: 10000, // 10 seconds
      // Disable background refetching to reduce load
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchIntervalInBackground: false,
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on circuit breaker blocks
        if (error.message?.includes('circuit breaker')) {
          return false
        }
        return failureCount < 1
      },
    }
  },
});

interface AppProvidersProps {
  children: ReactNode;
}

export const AppProviders: React.FC<AppProvidersProps> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          {children}
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
