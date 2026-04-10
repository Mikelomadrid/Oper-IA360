import React from 'react';
import { AlertTriangle, WifiOff, RefreshCw, ServerCrash } from 'lucide-react';
import { useNetworkStatus } from '@/contexts/NetworkStatusContext';
import { Button } from '@/components/ui/button';

const GlobalErrorBanner = () => {
  const { isOnline, isSupabaseConnected, checkConnection } = useNetworkStatus();

  // If everything is fine, render nothing
  if (isOnline && isSupabaseConnected) return null;

  return (
    <div className={`w-full px-4 py-3 text-sm font-medium flex items-center justify-center gap-3 shadow-md transition-colors duration-300 z-50 ${
      !isOnline ? 'bg-red-600 text-white' : 'bg-amber-600 text-white'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff className="w-5 h-5" />
          <span>Estás desconectado. La aplicación funcionará en modo limitado.</span>
        </>
      ) : (
        <>
          <ServerCrash className="w-5 h-5" />
          <span>No se puede conectar con el servidor. Es posible que los datos no se guarden.</span>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 bg-white/20 border-white/40 hover:bg-white/30 text-white ml-2"
            onClick={() => checkConnection()}
          >
            <RefreshCw className="w-3 h-3 mr-2" />
            Reintentar
          </Button>
        </>
      )}
    </div>
  );
};

export default GlobalErrorBanner;