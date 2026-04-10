import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Camera, Image as ImageIcon, UploadCloud, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

const SmartImageUploader = ({ 
    bucketName = 'tarea_evidencias', 
    pathPrefix = 'uploads', 
    onUploadComplete, 
    onCancel,
    maxSizeMB = 10 
}) => {
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

    // Detect device type for optimized UX
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = typeof window.navigator === "undefined" ? "" : navigator.userAgent;
            const mobile = Boolean(userAgent.match(/Android|BlackBerry|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i));
            setIsMobile(mobile || window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleFileSelect = (e) => {
        const selectedFile = e.target.files?.[0];
        if (!selectedFile) return;

        // Validate type
        if (!selectedFile.type.startsWith('image/')) {
            toast({ variant: "destructive", title: "Formato no válido", description: "Por favor sube solo imágenes (JPG, PNG)." });
            return;
        }

        // Validate size
        if (selectedFile.size > maxSizeMB * 1024 * 1024) {
            toast({ variant: "destructive", title: "Archivo muy grande", description: `El límite es de ${maxSizeMB}MB.` });
            return;
        }

        setFile(selectedFile);
        const objectUrl = URL.createObjectURL(selectedFile);
        setPreviewUrl(objectUrl);
        setError(null);
        setSuccess(false);
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(10); // Fake start

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}.${fileExt}`;
            // Ensure pathPrefix doesn't end with slash and fileName doesn't start with one
            const cleanPrefix = pathPrefix.replace(/\/$/, '');
            const filePath = `${cleanPrefix}/${fileName}`;

            setUploadProgress(40);

            const { data, error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            setUploadProgress(80);

            // Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from(bucketName)
                .getPublicUrl(filePath);

            setUploadProgress(100);
            setSuccess(true);
            
            // Notify parent with both URL and Path
            if (onUploadComplete) {
                // Wait a moment for the success animation
                setTimeout(() => {
                    onUploadComplete(publicUrl, filePath);
                }, 800);
            }

        } catch (err) {
            console.error('Upload failed:', err);
            setError(err.message || 'Error al subir la imagen');
            toast({ variant: "destructive", title: "Error de subida", description: "No se pudo guardar la imagen. Inténtalo de nuevo." });
        } finally {
            setIsUploading(false);
        }
    };

    const resetSelection = () => {
        setFile(null);
        setPreviewUrl(null);
        setError(null);
        setSuccess(false);
        if (galleryInputRef.current) galleryInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
        if (onCancel) onCancel();
    };

    return (
        <div className="w-full">
            <AnimatePresence mode="wait">
                {!file ? (
                    <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 md:p-10 text-center shadow-sm hover:shadow-md transition-all duration-300 group"
                    >
                        <div className="flex flex-col items-center justify-center gap-4">
                            <div className="p-4 bg-white dark:bg-slate-950 rounded-full shadow-sm group-hover:scale-110 transition-transform duration-300">
                                <UploadCloud className="w-8 h-8 text-primary/80" />
                            </div>
                            
                            <div className="space-y-1">
                                <h3 className="text-sm font-semibold text-foreground">Añadir Evidencia</h3>
                                <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                                    Toma una foto o selecciona de la galería
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-3 justify-center w-full mt-2">
                                {/* Hidden Inputs */}
                                <input 
                                    type="file" 
                                    ref={galleryInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={handleFileSelect} 
                                />
                                <input 
                                    type="file" 
                                    ref={cameraInputRef} 
                                    className="hidden" 
                                    accept="image/*" 
                                    capture="environment" 
                                    onChange={handleFileSelect} 
                                />

                                {isMobile ? (
                                    <>
                                        <Button 
                                            variant="outline"
                                            className="h-12 px-6 rounded-full border-primary/20 hover:border-primary/50 hover:bg-primary/5 gap-2 shadow-sm"
                                            onClick={() => cameraInputRef.current?.click()}
                                        >
                                            <Camera className="w-5 h-5 text-primary" />
                                            <span>Cámara</span>
                                        </Button>
                                        <Button 
                                            variant="secondary"
                                            className="h-12 px-6 rounded-full gap-2 shadow-sm"
                                            onClick={() => galleryInputRef.current?.click()}
                                        >
                                            <ImageIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                                            <span>Galería</span>
                                        </Button>
                                    </>
                                ) : (
                                    <Button 
                                        onClick={() => galleryInputRef.current?.click()}
                                        className="h-11 px-8 rounded-full bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all"
                                    >
                                        <UploadCloud className="w-5 h-5 mr-2" />
                                        Seleccionar Archivo
                                    </Button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative overflow-hidden rounded-xl bg-slate-950 shadow-xl border border-slate-800"
                    >
                        {/* Preview Image */}
                        <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden group">
                            <img 
                                src={previewUrl} 
                                alt="Preview" 
                                className={cn(
                                    "max-h-[300px] w-full object-contain transition-opacity duration-300",
                                    isUploading ? "opacity-50 blur-sm" : "opacity-100"
                                )} 
                            />
                            
                            {/* Overlay Controls */}
                            {!isUploading && !success && (
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                    <Button size="icon" variant="destructive" className="rounded-full h-12 w-12" onClick={resetSelection}>
                                        <X className="w-6 h-6" />
                                    </Button>
                                </div>
                            )}

                            {/* Loading State */}
                            {isUploading && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-6">
                                    <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary" />
                                    <p className="text-sm font-medium mb-2">Subiendo evidencia...</p>
                                    <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-primary transition-all duration-300" 
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Success State */}
                            {success && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm text-white animate-in fade-in zoom-in duration-300">
                                    <div className="rounded-full bg-green-500/20 p-4 mb-2">
                                        <CheckCircle2 className="w-12 h-12 text-green-500" />
                                    </div>
                                    <p className="font-bold text-lg">¡Subida completada!</p>
                                </div>
                            )}

                            {/* Error State */}
                            {error && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white p-6">
                                    <AlertCircle className="w-12 h-12 text-red-500 mb-2" />
                                    <p className="text-center text-sm mb-4 max-w-[200px]">{error}</p>
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" onClick={resetSelection} className="bg-transparent text-white border-white/20 hover:bg-white/10">
                                            Cancelar
                                        </Button>
                                        <Button size="sm" onClick={handleUpload}>
                                            <RefreshCw className="w-4 h-4 mr-2" /> Reintentar
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Controls */}
                        {!isUploading && !success && !error && (
                            <div className="p-4 bg-white dark:bg-slate-900 border-t flex justify-between items-center">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={resetSelection} 
                                    className="text-muted-foreground hover:text-destructive"
                                >
                                    Cancelar
                                </Button>
                                <Button onClick={handleUpload} className="gap-2 px-6">
                                    <UploadCloud className="w-4 h-4" />
                                    Confirmar y Subir
                                </Button>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default SmartImageUploader;