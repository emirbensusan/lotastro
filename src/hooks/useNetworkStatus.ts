import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  connectionType: string | null;
  downlink: number | null;
  rtt: number | null;
  saveData: boolean;
}

interface NetworkInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

declare global {
  interface Navigator {
    connection?: NetworkInfo & EventTarget;
    mozConnection?: NetworkInfo & EventTarget;
    webkitConnection?: NetworkInfo & EventTarget;
  }
}

export function useNetworkStatus(): NetworkStatus {
  const getConnection = useCallback(() => {
    return navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  }, []);

  const getNetworkStatus = useCallback((): NetworkStatus => {
    const connection = getConnection();
    
    return {
      isOnline: navigator.onLine,
      isSlowConnection: connection?.effectiveType === '2g' || connection?.effectiveType === 'slow-2g',
      connectionType: connection?.effectiveType || null,
      downlink: connection?.downlink || null,
      rtt: connection?.rtt || null,
      saveData: connection?.saveData || false,
    };
  }, [getConnection]);

  const [status, setStatus] = useState<NetworkStatus>(getNetworkStatus);

  useEffect(() => {
    const updateStatus = () => {
      setStatus(getNetworkStatus());
    };

    // Listen for online/offline events
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);

    // Listen for connection changes if available
    const connection = getConnection();
    if (connection) {
      connection.addEventListener('change', updateStatus);
    }

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      
      if (connection) {
        connection.removeEventListener('change', updateStatus);
      }
    };
  }, [getConnection, getNetworkStatus]);

  return status;
}

export default useNetworkStatus;
