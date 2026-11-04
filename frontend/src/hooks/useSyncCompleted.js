import { useEffect, useState } from 'react'

export function useSyncCompleted() {
  const [syncRevision, setSyncRevision] = useState(0)

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onSyncCompleted?.(() => {
      setSyncRevision(revision => revision + 1)
    })

    return () => unsubscribe?.()
  }, [])

  return syncRevision
}
