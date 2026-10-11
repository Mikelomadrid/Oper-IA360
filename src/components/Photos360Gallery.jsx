import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, View, X, Image as ImageIcon, Video, Play } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Sphere360Viewer from '@/components/Sphere360Viewer';

const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'];
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_VIDEO_SIZE_MB = 500;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

// Visor de vídeo inline con URL firmada refrescada en el momento de abrir
function VideoPlayer({ photo, bucketName }) {
    const [videoUrl, setVideoUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let cancelled = false;
        const loadUrl = async () => {
            setLoading(true);
            setError(null);
            try {
                // URL firmada fresca con 12h de validez para que el streaming funcione
                const { data, error: signError } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(photo.storage_path, 43200); // 12 horas
                if (signError) throw signError;
                if (!cancelled) setVideoUrl(data.signedUrl);
            } catch (e) {
                if (!cancelled) setError('No se pudo cargar el vídeo.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        loadUrl();
        return () => { cancelled = true; };
    }, [photo.id]);

    if (loading) return (
        <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-white/60" />
        </div>
    );

    if (error) return (
        <div className="flex-1 flex items-center justify-center text-white/60 text-sm">{error}</div>
    );

    return (
        <video
            key={videoUrl}
            src={videoUrl}
            controls
            autoPlay
            playsInline
            preload="auto"
            className="w-full h-full object-contain"
            style={{ paddingTop: '3.5rem', background: '#000' }}
            onError={(e) => {
                console.error('Video error:', e.target.error);
                setError(`Error al reproducir: ${e.target.error?.message || 'formato no compatible'}`);
            }}
        />
    );
}

export default function Photos360Gallery({ 
    entityId, 
    entityType,
    viewName,
    bucketName = 'proyecto_fotos_360' 
}) {
    const { toast } = useToast();
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerMounted, setViewerMounted] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const fileInputRef = useRef(null);

    const idColumn = entityType === 'lead' ? 'lead_id' : 'proyecto_id';
    const storageFolder = entityType === 'lead' ? 'leads' : 'proyectos';

    useEffect(() => {
        if (entityId) fetchPhotos();
    }, [entityId, entityType]);

    const getSignedUrl = async (path, isVideo = false) => {
        try {
            const expiry = isVideo ? 43200 : 3600; // 12h vídeos, 1h fotos
            const { data, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(path, expiry);
            if (error) throw error;
            return data.signedUrl;
        } catch (error) {
            console.error("Error signing URL:", error);
            return null;
        }
    };

    const fetchPhotos = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('proyecto_fotos_360')
                .select('*')
                .eq(idColumn, entityId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const photosData = data || [];
            const uploaderIds = [...new Set(photosData.map(p => p.created_by).filter(Boolean))];
            let creatorsMap = {};
            
            if (uploaderIds.length > 0) {
                const { data: employees, error: empError } = await supabase
                  .from('empleados')
                  .select('auth_user_id, nombre, apellidos')
                  .in('auth_user_id', uploaderIds);
                
                if (!empError && employees) {
                  employees.forEach(emp => {
                    creatorsMap[emp.auth_user_id] = emp;
                  });
                }
            }

            const photosWithUrls = await Promise.all(photosData.map(async (photo) => {
                const isVideo = photo.tipo_media === 'video';
                // Para vídeos solo generamos la URL del thumbnail (el player la regenera al abrir)
                // Para imágenes generamos la URL de preview normalmente
                const url = isVideo ? null : await getSignedUrl(photo.storage_path, false);
                const creator = creatorsMap[photo.created_by];
                const creatorName = creator ? `${creator.nombre} ${creator.apellidos || ''}` : 'Sistema';
                return { ...photo, url, creatorName };
            }));

            setPhotos(photosWithUrls);
        } catch (error) {
            console.error("Error fetching media:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los archivos multimedia." });
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const isVideo = VIDEO_MIME_TYPES.includes(file.type);
        const isImage = IMAGE_MIME_TYPES.includes(file.type);

        if (!isVideo && !isImage) {
            toast({ 
                variant: "destructive", 
                title: "Formato no permitido", 
                description: "Solo se permiten imágenes (JPG, PNG, WebP) o vídeos (MP4, MOV, AVI, WebM)." 
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        if (isVideo && file.size > MAX_VIDEO_SIZE_BYTES) {
            toast({ 
                variant: "destructive", 
                title: "Vídeo demasiado grande", 
                description: `El vídeo supera el límite de ${MAX_VIDEO_SIZE_MB} MB.` 
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `${storageFolder}/${entityId}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type,
                });

            if (uploadError) throw uploadError;

            const insertPayload = {
                [idColumn]: entityId,
                titulo: uploadTitle || file.name,
                descripcion: isVideo ? 'Vídeo subido por usuario' : 'Foto 360 subida por usuario',
                storage_path: filePath,
                tipo_media: isVideo ? 'video' : 'foto',
            };

            const { error: dbError } = await supabase
                .from('proyecto_fotos_360')
                .insert(insertPayload);

            if (dbError) throw dbError;

            toast({ title: "¡Subido!", description: isVideo ? "Vídeo subido correctamente." : "Foto 360º subida correctamente." });
            setUploadTitle('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            fetchPhotos();

        } catch (error) {
            console.error("Upload error:", error);
            toast({ variant: "destructive", title: "Error de subida", description: error.message });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (photo) => {
        if (!window.confirm(`¿Estás seguro de eliminar este ${photo.tipo_media === 'video' ? 'vídeo' : 'foto 360º'}?`)) return;

        try {
            const { error: dbError } = await supabase
                .from('proyecto_fotos_360')
                .delete()
                .eq('id', photo.id);

            if (dbError) throw dbError;

            const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([photo.storage_path]);

            if (storageError) console.warn("Storage delete warning:", storageError);

            toast({ title: photo.tipo_media === 'video' ? "Vídeo eliminado" : "Foto eliminada" });
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el archivo." });
        }
    };

    const openViewer = (photo) => {
        setSelectedPhoto(photo);
        setViewerMounted(false);
        setViewerOpen(true);
        // Delay mounting the viewer content to avoid DOM conflicts
        setTimeout(() => setViewerMounted(true), 100);
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    const fotos = photos.filter(p => p.tipo_media !== 'video');
    const videos = photos.filter(p => p.tipo_media === 'video');

    const MediaCard = ({ photo }) => {
        const isVideo = photo.tipo_media === 'video';
        return (
            <Card className="overflow-hidden group hover:shadow-md transition-all">
                <div className="aspect-[2/1] relative bg-black cursor-pointer" onClick={() => openViewer(photo)}>
                    {isVideo ? (
                        <>
                            {/* Placeholder para vídeos — no cargamos preview para evitar requests innecesarios */}
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                                <Video className="w-10 h-10 text-white/30" />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/50 rounded-full p-3 group-hover:bg-blue-600/80 transition-colors">
                                    <Play className="w-6 h-6 text-white fill-white" />
                                </div>
                            </div>
                        </>
                    ) : (
                        photo.url ? (
                            <img 
                                src={photo.url} 
                                alt={photo.titulo} 
                                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/50">
                                <ImageIcon className="w-8 h-8" />
                            </div>
                        )
                    )}

                    {!isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-all">
                            <Button variant="secondary" size="sm" className="gap-2" onClick={(e) => { e.stopPropagation(); openViewer(photo); }}>
                                <View className="w-4 h-4" /> Ver 360º
                            </Button>
                        </div>
                    )}

                    <div className={`absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${isVideo ? 'bg-blue-600 text-white' : 'bg-black/60 text-white'}`}>
                        {isVideo ? <><Video className="w-3 h-3" /> Vídeo</> : <><ImageIcon className="w-3 h-3" /> 360º</>}
                    </div>
                </div>
                <CardContent className="p-3">
                    <h4 className="font-medium truncate" title={photo.titulo}>{photo.titulo || 'Sin título'}</h4>
                    <p className="text-xs text-muted-foreground mt-1">Por: {photo.creatorName}</p>
                    <p className="text-xs text-muted-foreground">{new Date(photo.created_at).toLocaleDateString()}</p>
                </CardContent>
                <CardFooter className="p-2 pt-0 flex justify-end border-t bg-muted/5">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
                        onClick={() => handleDelete(photo)}
                    >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar
                    </Button>
                </CardFooter>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/25">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-2">
                        <Label htmlFor="photo-title">Título (opcional)</Label>
                        <Input 
                            id="photo-title" 
                            placeholder="Ej: Salón principal, Cocina..." 
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                            disabled={uploading}
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/x-msvideo,video/webm,video/mpeg"
                            onChange={handleFileSelect}
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploading}
                            className="w-full sm:w-auto"
                        >
                            {uploading 
                                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...</>
                                : <><Upload className="w-4 h-4 mr-2" /> Subir foto / vídeo</>
                            }
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    📷 Imágenes equirectangulares (2:1) para vista 360º · 🎬 Vídeos MP4, MOV, AVI o WebM (máx. {MAX_VIDEO_SIZE_MB} MB)
                </p>
            </div>

            {/* Fotos 360 */}
            {fotos.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <ImageIcon className="w-4 h-4" /> Fotos 360º ({fotos.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {fotos.map(photo => <MediaCard key={photo.id} photo={photo} />)}
                    </div>
                </div>
            )}

            {/* Vídeos */}
            {videos.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                        <Video className="w-4 h-4" /> Vídeos ({videos.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {videos.map(photo => <MediaCard key={photo.id} photo={photo} />)}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {photos.length === 0 && (
                <div className="py-12 text-center text-muted-foreground flex flex-col items-center">
                    <View className="w-12 h-12 mb-2 opacity-20" />
                    <p>No hay fotos ni vídeos disponibles.</p>
                    <p className="text-xs mt-1">Sube una foto 360º o un vídeo de la obra.</p>
                </div>
            )}

            {/* Viewer Modal */}
            <Dialog open={viewerOpen} onOpenChange={(open) => {
                if (!open) {
                    setViewerMounted(false);
                    setTimeout(() => {
                        setViewerOpen(false);
                        setSelectedPhoto(null);
                    }, 50);
                }
            }}>
                <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-black border-none flex flex-col">
                    {/* DialogTitle siempre presente para accesibilidad (Radix lo requiere) */}
                    <DialogTitle className="sr-only">
                        {selectedPhoto?.titulo || 'Visor multimedia'}
                    </DialogTitle>
                    {/* Barra superior personalizada */}
                    <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 text-white flex flex-row justify-between items-center">
                        <span className="text-lg font-medium drop-shadow-md flex items-center gap-2">
                            {selectedPhoto?.tipo_media === 'video' 
                                ? <Video className="w-5 h-5" /> 
                                : <View className="w-5 h-5" />
                            }
                            {selectedPhoto?.titulo}
                        </span>
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-white hover:bg-white/20" 
                            onClick={() => { setViewerOpen(false); setSelectedPhoto(null); }}
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </div>
                    
                    <div className="flex-1 w-full h-full relative flex items-center justify-center">
                        {viewerMounted && selectedPhoto?.tipo_media === 'video' ? (
                            <VideoPlayer photo={selectedPhoto} bucketName={bucketName} />
                        ) : viewerMounted && selectedPhoto?.url ? (
                            <Sphere360Viewer
                                key={selectedPhoto.id}
                                imageUrl={selectedPhoto.url}
                                title={selectedPhoto.titulo}
                                autoLoad={true}
                            />
                        ) : (
                            <div className="flex items-center justify-center">
                                <Loader2 className="w-8 h-8 animate-spin text-white/40" />
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
