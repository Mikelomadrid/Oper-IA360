import React from 'react';
import { NotificationCenter } from '@/components/admin/NotificationCenter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';

const BandejaEntradaView = () => {
  const { sessionRole } = useAuth();

  return (
    <div className="p-4 md:p-6 space-y-6 w-full">
      <Helmet>
        <title>Bandeja de Entrada | OrkaLED</title>
      </Helmet>

      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Bandeja de Entrada</h1>
        <p className="text-muted-foreground">Gestión de comunicaciones y notificaciones</p>
      </div>

      <div className="flex flex-col gap-6">
        {/* Centro de Notificaciones Unificado */}
        <Card className="border-none shadow-none bg-transparent p-0">
          <CardHeader className="px-0 pt-0 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-activity"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
              Centro de Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 border rounded-lg bg-card shadow-sm h-[calc(100vh-220px)] min-h-[500px] overflow-hidden flex flex-col">
            {/* 
                NotificationCenter handles all fetching and display. 
                Auto-polling/Intervals have been removed in favor of manual refresh + initial load.
             */}
            <NotificationCenter />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BandejaEntradaView;