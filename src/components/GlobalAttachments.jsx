import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import FileManager from '@/components/FileManager';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Image, FolderArchive } from 'lucide-react';

const GlobalAttachments = () => {
    const { sessionRole } = useAuth();
    const canManage = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';

    return (
        <div className="p-4 md:p-8 space-y-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <FolderArchive className="w-8 h-8 text-primary" />
                    Fotos y Adjuntos Globales
                </h1>
                <p className="text-muted-foreground">
                    Repositorio central de archivos y documentación general.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Image className="w-5 h-5 text-blue-500" />
                            Documentación General
                        </CardTitle>
                        <CardDescription>
                            Archivos generales de la empresa y plantillas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[500px]">
                        <FileManager 
                            bucketName="admin_docs" 
                            prefix="general/" 
                            canEdit={canManage} 
                        />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Image className="w-5 h-5 text-green-500" />
                            Fotos de Obras (Vista Global)
                        </CardTitle>
                        <CardDescription>
                            Explorador de archivos de todos los proyectos.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="h-[500px]">
                        <FileManager 
                            bucketName="proyecto_fotos" 
                            prefix="" 
                            canEdit={canManage} 
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default GlobalAttachments;