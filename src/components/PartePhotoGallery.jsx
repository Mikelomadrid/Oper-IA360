import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Trash2, Image as ImageIcon, X, Maximize2, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import PhotoUploadModal from '@/components/PhotoUploadModal';

const AsyncImage = ({ path, alt, className }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                if (!path) return;
                let cleanPath = path.includes('partes-data/') ? path.split('partes-data/')[1] : path;
                const { data } = await supabase.storage.from('partes-data').createSignedUrl(cleanPath, 3600);
                if (mounted && data?.signedUrl) setSrc(data.signedUrl);
            } catch (e) {}
        };
        load();
        return () => { mounted = false; };
    }, [path]);
    if (!src) return <div className={cn("bg-muted animate-pulse", className)} />;
    return <img src={src} alt={alt} className={className} />;
};

const PartePhotoGallery = ({ parteId }) => {
  const { user, sessionRole } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const canUpload = ['admin', 'encargado', 'tecnico', 'finca_admin'].includes(sessionRole?.rol);

  const fetchPhotos = useCallback(async () => {
    if (!parteId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('partes_archivos')
        .select('*')
        .eq('parte_id', parteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPhotos(data || []);
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "Error al cargar fotos." });
    } finally {
      setLoading(false);
    }
  }, [parteId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  const handlePhotosSelected = async (files) => {
    setIsUploadModalOpen(false);
    const toastId = toast({ title: "Subiendo...", duration: 10000 });
    try {
        let count = 0;
        const empId = sessionRole?.empleadoId; // Need employee ID for partes_archivos
        if (!empId) throw new Error("No se pudo identificar tu usuario.");

        for (const file of files) {
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2,9)}.${file.name.split('.').pop()}`;
            const filePath = `archivos/${parteId}/${fileName}`;
            const { error: upErr } = await supabase.storage.from('partes-data').upload(filePath, file);
            if (upErr) throw upErr;

            await supabase.from('partes_archivos').insert({
                parte_id: parteId,
                archivo_url: filePath,
                nombre_archivo: file.name,
                tipo_archivo: file.type,
                subido_por: empId
            });
            count++;
        }
        toast({ title: "Éxito", description: `${count} fotos subidas.` });
        fetchPhotos();
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Error", description: "Fallo al subir." });
    }
  };

  const handleDelete = async () => {
    if (!photoToDelete) return;
    try {
      let path = photoToDelete.archivo_url;
      if (path.includes('partes-data/')) path = path.split('partes-data/')[1];
      await supabase.storage.from('partes-data').remove([path]);
      await supabase.from('partes_archivos').delete().eq('id', photoToDelete.id);
      toast({ title: "Eliminada" });
      setPhotos(prev => prev.filter(p => p.id !== photoToDelete.id));
    } catch (e) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar." });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const openPreview = async (photo) => {
    let path = photo.archivo_url.includes('partes-data/') ? photo.archivo_url.split('partes-data/')[1] : photo.archivo_url;
    const { data } = await supabase.storage.from('partes-data').createSignedUrl(path, 3600);
    if (data?.signedUrl) {
        setSelectedPhoto({ ...photo, signedUrl: data.signedUrl });
        setPreviewOpen(true);
    }
  };

  if (!parteId) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center bg-card p-4 rounded-xl border shadow-sm">
        <h2 className="font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary"/> Galería ({photos.length})</h2>
        {canUpload && <Button onClick={() => setIsUploadModalOpen(true)}><Plus className="w-4 h-4 mr-2"/> Subir</Button>}
      </div>

      {loading ? <div className="p-8 text-center"><Plus className="animate-spin mx-auto"/></div> : 
       photos.length === 0 ? <div className="text-center py-12 bg-muted/10 rounded-xl">Sin fotos</div> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {photos.map(p => (
            <Card key={p.id} className="relative aspect-square overflow-hidden cursor-pointer group" onClick={() => openPreview(p)}>
                <AsyncImage path={p.archivo_url} className="w-full h-full object-cover"/>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <Button variant="secondary" size="icon" className="rounded-full" onClick={(e) => {e.stopPropagation(); openPreview(p);}}><Maximize2 className="w-4 h-4"/></Button>
                    {canUpload && <Button variant="destructive" size="icon" className="rounded-full" onClick={(e) => {e.stopPropagation(); setPhotoToDelete(p); setDeleteDialogOpen(true);}}><Trash2 className="w-4 h-4"/></Button>}
                </div>
            </Card>
          ))}
        </div>
      )}

      <PhotoUploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} onPhotosSelected={handlePhotosSelected} />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Eliminar foto</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl bg-black/95 border-none p-0 flex justify-center items-center h-[80vh]">
            {selectedPhoto && <img src={selectedPhoto.signedUrl} className="max-h-full max-w-full object-contain"/>}
            <button onClick={() => setPreviewOpen(false)} className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2"><X/></button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartePhotoGallery;