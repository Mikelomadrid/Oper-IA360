import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { XCircle, PackageOpen, Wrench } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RevisarDevoluciones from '@/components/RevisarDevoluciones';
import ToolRequests from '@/components/ToolRequests';

const SolicitudesHerramientasView = () => {
    const { sessionRole } = useAuth();

    // Explicitly allow both 'admin' and 'encargado' roles
    const isAdminOrEncargado = ["admin", "encargado"].includes(sessionRole?.rol);

    const [searchParams, setSearchParams] = useSearchParams();

    // Manage tab from URL query param
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'solicitudes');
    const highlightedId = searchParams.get('id');

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && ['solicitudes', 'devoluciones'].includes(tab)) {
            setActiveTab(tab);
        } else if (!tab) {
            // Default to solicitudes if not specified
            setSearchParams({ tab: 'solicitudes' }, { replace: true });
            setActiveTab('solicitudes');
        }
    }, [searchParams, setSearchParams]);

    const handleTabChange = (value) => {
        setActiveTab(value);
        setSearchParams({ tab: value }, { replace: true }); // Removing ID on tab change to avoid confusion
    };

    if (!isAdminOrEncargado) {
        return (
            <div className="p-8 flex flex-col items-center justify-center text-center">
                <XCircle className="w-16 h-16 text-destructive mb-4" />
                <h2 className="text-2xl font-bold">Acceso Restringido</h2>
                <p className="text-muted-foreground">Solo administradores y encargados pueden gestionar solicitudes.</p>
            </div>
        );
    }

    return (
        <>
            <Helmet><title>Gestión de Solicitudes | Inventario</title></Helmet>

            <div className="p-6 w-full space-y-6">
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-3"
                >
                    <div className="p-2 bg-primary/10 rounded-full">
                        <Wrench className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Gestión de Solicitudes</h1>
                        <p className="text-muted-foreground">Administra solicitudes de entrega y devoluciones de herramientas.</p>
                    </div>
                </motion.div>

                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
                        <TabsTrigger value="solicitudes" className="gap-2">
                            <Wrench className="w-4 h-4" /> Solicitudes de Entrega
                        </TabsTrigger>
                        <TabsTrigger value="devoluciones" className="gap-2">
                            <PackageOpen className="w-4 h-4" /> Revisar Devoluciones
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="solicitudes">
                        <ToolRequests highlightId={highlightedId} />
                    </TabsContent>

                    <TabsContent value="devoluciones">
                        <RevisarDevoluciones highlightId={highlightedId} />
                    </TabsContent>
                </Tabs>
            </div>
        </>
    );
};

export default SolicitudesHerramientasView;