import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Upload, Trash2, View, Plus, X, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import Sphere360Viewer from '@/components/Sphere360Viewer';

export default function Photos360Gallery({ 
    entityId, 
    entityType, // 'lead' or 'proyecto'
    viewName,   // Optional override, not strictly used as we query table directly for robustness
    bucketName = 'proyecto_fotos_360' 
}) {
    const { toast } = useToast();
    const [photos, setPhotos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const fileInputRef = useRef(null);

    // Determine filter column
    const idColumn = entityType === 'lead' ? 'lead_id' : 'proyecto_id';
    const storageFolder = entityType === 'lead' ? 'leads' : 'proyectos';

    useEffect(() => {
        if (entityId) fetchPhotos();
    }, [entityId, entityType]);

    const getSignedUrl = async (path) => {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(path, 3600); // 1 hour expiry
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
            // We query the table directly to handle both lead and project logic unified
            const { data, error } = await supabase
                .from('proyecto_fotos_360')
                .select('*')
                .eq(idColumn, entityId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const photosData = data || [];

            // Fetch creators info manually
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

            // Generate signed URLs for thumbnails/preview and attach creator info
            const photosWithUrls = await Promise.all(photosData.map(async (photo) => {
                const url = await getSignedUrl(photo.storage_path);
                const creator = creatorsMap[photo.created_by];
                const creatorName = creator ? `${creator.nombre} ${creator.apellidos || ''}` : 'Sistema';
                return { ...photo, url, creatorName };
            }));

            setPhotos(photosWithUrls);
        } catch (error) {
            console.error("Error fetching 360 photos:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las fotos 360." });
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `${storageFolder}/${entityId}/${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Insert record into database
            const insertPayload = {
                [idColumn]: entityId,
                titulo: uploadTitle || file.name,
                descripcion: 'Foto 360 subida por usuario',
                storage_path: filePath
            };

            const { error: dbError } = await supabase
                .from('proyecto_fotos_360')
                .insert(insertPayload);

            if (dbError) throw dbError;

            toast({ title: "Éxito", description: "Foto 360º subida correctamente." });
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
        if (!window.confirm("¿Estás seguro de eliminar esta foto 360º?")) return;

        try {
            // 1. Delete from DB
            const { error: dbError } = await supabase
                .from('proyecto_fotos_360')
                .delete()
                .eq('id', photo.id);

            if (dbError) throw dbError;

            // 2. Delete from Storage
            const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([photo.storage_path]);

            if (storageError) console.warn("Storage delete warning:", storageError);

            toast({ title: "Foto eliminada" });
            setPhotos(prev => prev.filter(p => p.id !== photo.id));
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la foto." });
        }
    };

    const openViewer = (photo) => {
        setSelectedPhoto(photo);
        setViewerOpen(true);
    };

    if (loading) {
        return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            <div className="bg-muted/30 p-4 rounded-lg border border-dashed border-muted-foreground/25">
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1 w-full space-y-2">
                        <Label htmlFor="photo-title">Título de la imagen (Opcional)</Label>
                        <Input 
                            id="photo-title" 
                            placeholder="Ej: Salón principal, Cocina..." 
                            value={uploadTitle}
                            onChange={(e) => setUploadTitle(e.target.value)}
                        />
                    </div>
                    <div className="w-full sm:w-auto">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/jpeg,image/png,image/webp"
                            onChange={handleFileSelect}
                        />
                        <Button 
                            onClick={() => fileInputRef.current?.click()} 
                            disabled={uploading}
                            className="w-full sm:w-auto"
                        >
                            {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                            {uploading ? 'Subiendo...' : 'Subir Foto 360º'}
                        </Button>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                    Sube imágenes equirectangulares (relación de aspecto 2:1) para una visualización correcta.
                </p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-muted-foreground flex flex-col items-center">
                        <View className="w-12 h-12 mb-2 opacity-20" />
                        <p>No hay fotos 360º disponibles.</p>
                    </div>
                ) : (
                    photos.map(photo => (
                        <Card key={photo.id} className="overflow-hidden group hover:shadow-md transition-all">
                            <div className="aspect-[2/1] relative bg-black">
                                {photo.url ? (
                                    <img 
                                        src={photo.url} 
                                        alt={photo.titulo} 
                                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white/50">
                                        <ImageIcon className="w-8 h-8" />
                                    </div>
                                )}
                                
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/40 transition-all">
                                    <Button variant="secondary" size="sm" className="gap-2" onClick={() => openViewer(photo)}>
                                        <View className="w-4 h-4" /> Ver 360º
                                    </Button>
                                </div>
                            </div>
                            <CardContent className="p-3">
                                <h4 className="font-medium truncate" title={photo.titulo}>{photo.titulo || 'Sin título'}</h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Subido por: {photo.creatorName}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {new Date(photo.created_at).toLocaleDateString()}
                                </p>
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
                    ))
                )}
            </div>

            {/* Viewer Modal - Updated to use Sphere360Viewer */}
            <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
                <DialogContent className="max-w-6xl w-[95vw] h-[85vh] p-0 overflow-hidden bg-black border-none flex flex-col">
                    <DialogHeader className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 text-white flex flex-row justify-between items-center pointer-events-none">
                        <DialogTitle className="text-lg font-medium drop-shadow-md">
                            {selectedPhoto?.titulo}
                        </DialogTitle>
                        {/* Custom Close Button since default is sometimes hard to see on dark bg */}
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="pointer-events-auto text-white hover:bg-white/20" 
                            onClick={() => setViewerOpen(false)}
                        >
                            <X className="w-6 h-6" />
                        </Button>
                    </DialogHeader>
                    
                    <div className="flex-1 w-full h-full relative">
                        {selectedPhoto?.url && (
                            <Sphere360Viewer
                                key={selectedPhoto.id}
                                imageUrl={selectedPhoto.url}
                                title={selectedPhoto.titulo}
                                autoLoad={true}
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}