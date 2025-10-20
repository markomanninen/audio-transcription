/**
 * Utility function to get consistent status badge colors across the application
 */
export const getStatusBadgeColors = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'completed':
      return 'bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200'
    case 'processing':
      return 'bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200'
    case 'pending':
      return 'bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200'
    case 'model-loading':
      return 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200'
    case 'ready-to-start':
      return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
    case 'model-download-needed':
      return 'bg-orange-100 dark:bg-orange-950 text-orange-800 dark:text-orange-200'
    case 'failed':
      return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200'
    default:
      return 'bg-gray-100 dark:bg-gray-950 text-gray-800 dark:text-gray-200'
  }
}