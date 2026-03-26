import { useState, useEffect } from 'react'

/**
 * Hook to read a localStorage value and listen to changes
 * @param {string} key - The localStorage key to read
 * @param {any} defaultValue - Default value if not found
 * @returns {any} The value from localStorage
 */
export function useLocalStorage(key, defaultValue = null) {
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    // Read initial value from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(key)
      const finalValue = stored !== null ? stored : defaultValue
      console.log(`[useLocalStorage] initializing key="${key}" with value:`, finalValue)
      setValue(finalValue)
    }
  }, [key, defaultValue])

  useEffect(() => {
    // Listen for storage changes (especially from other tabs)
    function handleStorageChange(e) {
      if (e.key === key) {
        setValue(e.newValue !== null ? e.newValue : defaultValue)
      }
    }

    // Also listen for a custom event we'll emit when changing role
    function handleCustomChange(e) {
      if (e.detail && e.detail.key === key) {
        setValue(e.detail.value !== null ? e.detail.value : defaultValue)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange)
      window.addEventListener('localStorageChanged', handleCustomChange)
      return () => {
        window.removeEventListener('storage', handleStorageChange)
        window.removeEventListener('localStorageChanged', handleCustomChange)
      }
    }
  }, [key, defaultValue])

  return value
}
