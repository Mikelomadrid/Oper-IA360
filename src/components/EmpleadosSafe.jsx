import React from 'react';
import { Helmet } from 'react-helmet';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { UserCog } from 'lucide-react';

const EmpleadosSafe = () => {
    return (
        <>
            <Helmet>
                <title>Gestión de Personal</title>
                <meta name="description" content="Gestión de personal en modo seguro (placeholder)." />
            </Helmet>
            <div className="space-y-6">
                <h1 className="text-3xl font-bold">Gestión de Personal</h1>
                <Card>
                    <CardHeader className="flex flex-row items-center gap-4">
                        <UserCog className="w-10 h-10 text-muted-foreground" />
                        <div>
                            <CardTitle>Página en Construcción</CardTitle>
                            <p className="text-muted-foreground">Este módulo está actualmente en desarrollo.</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p>Aquí podrás gestionar a todos los empleados de la empresa.</p>
                    </CardContent>
                </Card>
            </div>
        </>
    );
};

export default EmpleadosSafe;