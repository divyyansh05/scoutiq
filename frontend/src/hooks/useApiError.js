import { useState, useCallback } from 'react'

/**
 * Tracks an API error message for display in an ErrorBanner.
 * Returns [error, handleError, clearError].
 *
 * Usage:
 *   const [error, handleError, clearError] = useApiError()
 *   ...
 *   .catch(handleError)
 *   ...
 *   <ErrorBanner error={error} onClose={clearError} />
 */
export default function useApiError() {
  const [error, setError] = useState(null)

  const handleError = useCallback((err) => {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.error ||
      err?.message ||
      'Something went wrong. Please try again.'
    setError(msg)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return [error, handleError, clearError]
}
