import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { scanForMissingThumbnails, triggerResizeFunction } from '@/lib/imageUtils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle2, Play, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const AdminImageMigration = () => {
    const [scanning, setScanning] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [stats, setStats] = useState(null);
    const [missingFiles, setMissingFiles] = useState([]);
    const [progress, setProgress] = useState(0);
    const [logs, setLogs] = useState([]);

    const addLog = (msg, type = 'info') => {
        setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${type === 'error' ? '❌' : '✅'} ${msg}`, ...prev]);
    };

    const handleScan = async () => {
        setScanning(true);
        setStats(null);
        setMissingFiles([]);
        setLogs([]);
        setProgress(0);

        try {
            addLog('Iniciando escaneo del bucket "herramientas_fotos"...');
            const result = await scanForMissingThumbnails();
            
            setStats({
                totalOriginals: result.totalOriginals,
                totalThumbnails: result.totalThumbnails,
                missingCount: result.missing.length
            });
            setMissingFiles(result.missing);
            addLog(`Escaneo completado. ${result.missing.length} imágenes sin miniatura encontradas.`);
        } catch (error) {
            console.error(error);
            addLog(`Error al escanear: ${error.message}`, 'error');
            toast({ variant: "destructive", title: "Error", description: "No se pudo escanear el bucket." });
        } finally {
            setScanning(false);
        }
    };

    const handleProcess = async () => {
        if (missingFiles.length === 0) return;

        setProcessing(true);
        setProgress(0);
        let successCount = 0;
        let failCount = 0;

        addLog(`Iniciando procesamiento de ${missingFiles.length} imágenes...`);

        // Process in sequence to avoid overwhelming the edge function (or browser)
        // We could do parallel batches (e.g., Promise.all of chunks of 5) if needed.
        for (let i = 0; i < missingFiles.length; i++) {
            const file = missingFiles[i];
            try {
                await triggerResizeFunction(file.name);
                successCount++;
                addLog(`Procesada: ${file.name}`);
            } catch (error) {
                console.error(error);
                failCount++;
                addLog(`Error en ${file.name}: ${error.message}`, 'error');
            }

            // Update progress
            const percent = Math.round(((i + 1) / missingFiles.length) * 100);
            setProgress(percent);
        }

        addLog(`Proceso finalizado. Éxito: ${successCount}, Fallos: ${failCount}.`);
        toast({ 
            title: "Proceso Finalizado", 
            description: `Se generaron ${successCount} miniaturas. ${failCount} errores.` 
        });
        
        setProcessing(false);
        // Optional: Rescan to confirm
        handleScan(); 
    };

    return (
        <>
            <Helmet><title>Migración de Imágenes | Admin</title></Helmet>
            
            <div className="p-6 max-w-4xl mx-auto space-y-6">
                <motion.div 
                    initial={{ opacity: 0, y: 10 }} 
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2 mb-2">
                        <ImageIcon className="w-8 h-8 text-primary" />
                        Utilidad de Migración de Imágenes
                    </h1>
                    <p className="text-muted-foreground">
                        Escanea el bucket de almacenamiento y genera miniaturas para las imágenes antiguas que no fueron procesadas por el webhook.
                    </p>
                </motion.div>

                <Card>
                    <CardHeader>
                        <CardTitle>Estado del Bucket</CardTitle>
                        <CardDescription>
                            Bucket: <code>herramientas_fotos</code>
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {stats ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="p-4 bg-muted rounded-lg text-center">
                                    <div className="text-2xl font-bold">{stats.totalOriginals}</div>
                                    <div className="text-sm text-muted-foreground">Imágenes Originales</div>
                                </div>
                                <div className="p-4 bg-muted rounded-lg text-center">
                                    <div className="text-2xl font-bold">{stats.totalThumbnails}</div>
                                    <div className="text-sm text-muted-foreground">Miniaturas Existentes</div>
                                </div>
                                <div className={`p-4 rounded-lg text-center border-2 ${stats.missingCount > 0 ? 'bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-900' : 'bg-green-50 border-green-100 dark:bg-green-900/20 dark:border-green-900'}`}>
                                    <div className={`text-2xl font-bold ${stats.missingCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                        {stats.missingCount}
                                    </div>
                                    <div className="text-sm font-medium">Pendientes de Procesar</div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <p>Realiza un escaneo para ver el estado actual.</p>
                            </div>
                        )}

                        {stats && stats.missingCount > 0 && !processing && (
                            <Alert variant="warning">
                                <AlertTriangle className="h-4 w-4" />
                                <AlertTitle>Acción Requerida</AlertTitle>
                                <AlertDescription>
                                    Se encontraron {stats.missingCount} imágenes sin miniatura. Esto puede afectar el rendimiento de la galería.
                                </AlertDescription>
                            </Alert>
                        )}

                        {stats && stats.missingCount === 0 && stats.totalOriginals > 0 && (
                            <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900">
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <AlertTitle className="text-green-800 dark:text-green-400">Todo en orden</AlertTitle>
                                <AlertDescription className="text-green-700 dark:text-green-300">
                                    Todas las imágenes tienen su miniatura correspondiente.
                                </AlertDescription>
                            </Alert>
                        )}

                        {(processing || progress > 0) && (
                            <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span>Procesando...</span>
                                    <span>{progress}%</span>
                                </div>
                                <Progress value={progress} />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between border-t pt-6">
                        <Button 
                            variant="outline" 
                            onClick={handleScan} 
                            disabled={scanning || processing}
                        >
                            {scanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            {stats ? "Volver a Escanear" : "Escanear Bucket"}
                        </Button>

                        <Button 
                            onClick={handleProcess} 
                            disabled={!stats || stats.missingCount === 0 || processing || scanning}
                        >
                            {processing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                            Generar Miniaturas Faltantes
                        </Button>
                    </CardFooter>
                </Card>

                {logs.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Registro de Actividad</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[200px] w-full rounded-md border p-4 bg-black/5 dark:bg-black/30 font-mono text-xs">
                                {logs.map((log, index) => (
                                    <div key={index} className="mb-1 whitespace-nowrap">
                                        {log}
                                    </div>
                                ))}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                )}
            </div>
        </>
    );
};

export default AdminImageMigration;