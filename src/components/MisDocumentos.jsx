import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { motion } from 'framer-motion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "@/components/ui/use-toast";
import { FileText, Download, Eye, Loader2, ServerCrash, FolderSearch, Folder, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MisDocumentos = () => {
    const { sessionRole } = useAuth();
    const [groupedFiles, setGroupedFiles] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const formatBytes = (bytes, decimals = 2) => {
        if (bytes === null || typeof bytes === 'undefined' || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    };

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        setError(null);

        if (!sessionRole.empleadoId) {
            setError("No existe empleado vinculado a este usuario. Contacte con el administrador para vincular su usuario a la ficha de empleado. Código: 23503");
            setLoading(false);
            return;
        }

        try {
            const rootPrefix = `${sessionRole.empleadoId}/`;
            const { data: rootItems, error: rootError } = await supabase.storage
                .from('empleados_docs')
                .list(rootPrefix, { limit: 100 });

            if (rootError) throw rootError;

            const allFiles = [];
            const folderPrefixes = [];

            for (const item of rootItems) {
                if (item.id === null) { 
                    folderPrefixes.push(`${rootPrefix}${item.name}/`);
                } else if (item.name !== '.placeholder') {
                    allFiles.push({ ...item, fullPath: `${rootPrefix}${item.name}` });
                }
            }

            const folderPromises = folderPrefixes.map(prefix =>
                supabase.storage.from('empleados_docs').list(prefix, {
                    limit: 100,
                    sortBy: { column: 'created_at', order: 'desc' },
                })
            );

            const folderResults = await Promise.all(folderPromises);

            folderResults.forEach((result, index) => {
                if (result.error) {
                    console.warn(`Could not list files in ${folderPrefixes[index]}:`, result.error.message);
                    return;
                }
                if (result.data) {
                    const filesInFolder = result.data
                        .filter(file => file.id !== null && file.name !== '.placeholder')
                        .map(file => ({
                            ...file,
                            fullPath: `${folderPrefixes[index]}${file.name}`,
                        }));
                    allFiles.push(...filesInFolder);
                }
            });

            const grouped = allFiles.reduce((acc, file) => {
                const pathParts = file.fullPath.split('/');
                const folderName = pathParts.length > 2 ? pathParts[1] : 'Raíz';
                
                if (!acc[folderName]) {
                    acc[folderName] = [];
                }
                acc[folderName].push(file);
                return acc;
            }, {});

            setGroupedFiles(grouped);

        } catch (err) {
            console.error("Error fetching documents:", err);
            setError(err.message.includes("Bucket not found")
                ? "El repositorio de documentos no está disponible. Contacta a soporte."
                : "No se pudieron cargar tus documentos. Inténtalo de nuevo más tarde.");
        } finally {
            setLoading(false);
        }
    }, [sessionRole.empleadoId]);

    useEffect(() => {
        if (sessionRole.loaded) {
            fetchDocuments();
        }
    }, [fetchDocuments, sessionRole.loaded]);

    const handleAction = async (fileObject, action) => {
        if (!fileObject || !fileObject.fullPath) {
            toast({ variant: 'destructive', title: 'Error de archivo', description: "La ruta del archivo no es válida." });
            return;
        }
        try {
            const { data, error } = await supabase.storage
                .from('empleados_docs')
                .createSignedUrl(fileObject.fullPath, 3600); 

            if (error) throw error;

            if (action === 'preview') {
                window.open(data.signedUrl, '_blank');
            } else if (action === 'download') {
                const response = await fetch(data.signedUrl);
                if (!response.ok) throw new Error('Network response was not ok.');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileObject.name;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                a.remove();
            }
        } catch (err) {
            toast({ variant: 'destructive', title: `Error al ${action === 'preview' ? 'previsualizar' : 'descargar'}`, description: "No se pudo acceder al archivo. Inténtalo de nuevo." });
            console.error(`Error handling file action:`, err);
        }
    };

    const folderOrder = ['privado', 'nominas', 'contrato', 'embargos', 'Raíz'];
    const sortedFolderNames = Object.keys(groupedFiles).sort((a, b) => {
        const indexA = folderOrder.indexOf(a);
        const indexB = folderOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    const FileList = ({ files }) => (
        <>
            {/* Mobile View: Cards */}
            <div className="md:hidden grid grid-cols-1 gap-4">
                {files.map(file => (
                    <Card key={file.id || file.name}>
                        <CardHeader>
                            <CardTitle className="text-base font-semibold leading-tight truncate flex-1">
                                <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground shrink-0"/>
                                    <span className="truncate">{file.name || 'Nombre no disponible'}</span>
                                </div>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm text-muted-foreground">
                            <div className="flex justify-between items-center">
                                <span>{formatBytes(file.metadata?.size)}</span>
                                <span>{file.created_at ? new Date(file.created_at).toLocaleDateString() : 'N/A'}</span>
                            </div>
                        </CardContent>
                        <CardFooter className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleAction(file, 'preview')} className="flex-1" disabled={!file.name}>
                                <Eye className="h-4 w-4 mr-2" /> Ver
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleAction(file, 'download')} className="flex-1" disabled={!file.name}>
                                <Download className="h-4 w-4 mr-2" /> Descargar
                            </Button>
                        </CardFooter>
                    </Card>
                ))}
            </div>

            {/* Desktop View: Table */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre de archivo</TableHead>
                            <TableHead className="w-[120px]">Tamaño</TableHead>
                            <TableHead className="w-[150px]">Fecha</TableHead>
                            <TableHead className="text-right w-[120px]">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {files.map(file => (
                            <TableRow key={file.id || file.name}>
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-muted-foreground" />
                                        <span className='truncate max-w-xs'>{file.name || 'Nombre no disponible'}</span>
                                    </div>
                                </TableCell>
                                <TableCell>{formatBytes(file.metadata?.size)}</TableCell>
                                <TableCell>{file.created_at ? new Date(file.created_at).toLocaleDateString() : 'N/A'}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="icon" onClick={() => handleAction(file, 'preview')} aria-label="Previsualizar" disabled={!file.name}>
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleAction(file, 'download')} aria-label="Descargar" disabled={!file.name}>
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </>
    );

    const renderContent = () => {
        if (loading) {
            return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
        }
        if (error) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-center p-4 w-full max-w-2xl mx-auto">
                    {error.includes("23503") ? (
                        <Alert variant="destructive" className="mb-4 text-left">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error de Vinculación</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : (
                        <>
                            <ServerCrash className="w-12 h-12 text-destructive mb-4" />
                            <p className="font-semibold text-lg">Error al cargar documentos</p>
                            <p className="text-muted-foreground">{error}</p>
                        </>
                    )}
                </div>
            );
        }
        if (sortedFolderNames.length === 0) {
            return (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <FolderSearch className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="font-semibold text-lg">No hay documentos todavía</p>
                    <p className="text-muted-foreground">Tu repositorio de documentos está vacío.</p>
                </div>
            );
        }

        return (
            <Accordion type="multiple" className="w-full bg-card border rounded-lg shadow-sm px-4">
                {sortedFolderNames.map(folderName => (
                    <AccordionItem value={folderName} key={folderName}>
                        <AccordionTrigger>
                            <div className="flex items-center gap-3">
                                <Folder className="h-5 w-5 text-primary" />
                                <span className="capitalize font-semibold text-lg">{folderName}</span>
                                <Badge variant="secondary">{groupedFiles[folderName].length}</Badge>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <FileList files={groupedFiles[folderName]} />
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        );
    };

    return (
        <div className="p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <h1 className="text-3xl font-bold tracking-tight">Mis Documentos</h1>
                <p className="text-muted-foreground">Aquí puedes ver y descargar tus documentos personales como nóminas, contratos, etc.</p>
            </motion.div>
            <motion.div className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
                {renderContent()}
            </motion.div>
        </div>
    );
};

export default MisDocumentos;