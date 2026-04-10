import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';
import { Helmet } from 'react-helmet';

const DashboardSafe = () => {
    return (
      <>
        <Helmet>
            <title>Dashboard Seguro</title>
            <meta name="description" content="Panel principal en modo seguro." />
        </Helmet>
        <div className="space-y-6">
            <h1 className="text-3xl font-bold">Panel principal</h1>
            <Card className="bg-gradient-to-br from-green-50/80 to-blue-50/80 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800/50">
                <CardHeader className="flex flex-row items-center gap-4">
                    <ShieldCheck className="w-10 h-10 text-green-500" />
                    <div>
                        <CardTitle className="text-green-800 dark:text-green-300">Modo de Arranque Seguro</CardTitle>
                        <p className="text-muted-foreground">Versión de la aplicación sin recargas automáticas para máxima estabilidad.</p>
                    </div>
                </CardHeader>
                <CardContent>
                    <p>Toda la carga de datos se realiza de forma manual para evitar bucles o errores inesperados. Utiliza los botones "Refrescar" en cada sección.</p>
                </CardContent>
            </Card>
        </div>
      </>
    );
};

export default DashboardSafe;