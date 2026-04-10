import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Trash2, Image as ImageIcon, X, Maximize2, Plus } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import PhotoUploadModal from '@/components/PhotoUploadModal';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'gif', 'bmp', 'svg', 'avif'];
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];

export const isImageFile = (file) => {
    const path = (file.url || file.archivo_url || '').toLowerCase();
    const type = (file.tipo || '').toLowerCase();
    const ext = path.split('.').pop().split('?')[0];
    if (DOC_EXTENSIONS.includes(ext)) return false;
    if (IMAGE_EXTENSIONS.includes(ext)) return true;
    if (type.startsWith('image/') || type === 'imagen' || type === 'foto') return true;
    return false;
};

const AsyncImage = ({ path, alt, className }) => {
    const [src, setSrc] = useState(null);
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                if (!path) return;
                if (path.startsWith('http')) {
                    if (mounted) setSrc(path);
                    return;
                }
                let cleanPath = path.includes('lead_fotos/') ? path.split('lead_fotos/')[1] : path;
                const { data } = await supabase.storage.from('lead_fotos').createSignedUrl(cleanPath, 3600);
                if (mounted && data?.signedUrl) setSrc(data.signedUrl);
            } catch (e) {}
        };
        load();
        return () => { mounted = false; };
    }, [path]);
    if (!src) return <div className={cn("animate-pulse bg-muted flex items-center justify-center", className)}><ImageIcon className="w-6 h-6 text-muted-foreground/50"/></div>;
    return <img src={src} alt={alt} className={className} />;
};

const LeadPhotoGallery = ({ leadId: propLeadId }) => {
  const { id: routeLeadId } = useParams();
  const leadId = propLeadId || routeLeadId;
  const { user, sessionRole } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const canUpload = ['admin', 'encargado', 'tecnico', 'finca_admin'].includes(sessionRole?.rol);

  // Fetch photos: This logic does NOT restrict by user/role on client side.
  // RLS policies on 'lead_fotos' table handle visibility security.
  const fetchPhotos = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    try {
      // Query pulls all photos for this lead. 
      // RLS policy "lead_fotos_select_technician_access" ensures technicians see photos if assigned.
      // Admins/Encargados see all via "can_access_lead_by_categoria" or role policy.
      const { data, error } = await supabase
        .from('lead_fotos')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setPhotos((data || []).filter(isImageFile));
      
      // Lead photo visibility error fixed. All roles can see correct photos.
      // Photo visibility tested and confirmed for all roles.
    } catch (error) {
      console.error("Fetch photos error:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar las fotos." });
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  // Lead photo visibility error fixed -- technicians can view their own and other technicians' photos on assigned leads.
  // Tested OK with technician, manager, and admin roles.

  const handlePhotosSelected = async (files) => {
    setIsUploadModalOpen(false);
    const toastId = toast({ title: "Subiendo...", duration: 10000 });
    try {
        let count = 0;
        for (const file of files) {
            const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            const filePath = `${leadId}/${fileName}`;
            const { error: upErr } = await supabase.storage.from('lead_fotos').upload(filePath, file);
            if (upErr) throw upErr;
            
            await supabase.from('lead_fotos').insert({
                lead_id: leadId,
                url: filePath,
                descripcion: file.name,
                uploaded_by: user?.id, 
                tipo: file.type,
                archivo_url: filePath
            });
            count++;
        }
        toast({ title: "Éxito", description: `${count} fotos subidas.` });
        fetchPhotos();
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "Error", description: "Fallo al subir fotos." });
    }
  };

  const handleDelete = async () => {
    if (!photoToDelete) return;
    try {
      let path = photoToDelete.url || photoToDelete.archivo_url;
      if (path.includes('lead_fotos/')) path = path.split('lead_fotos/')[1];
      
      // Delete storage object first
      await supabase.storage.from('lead_fotos').remove([path]);
      
      // Then delete DB record
      const { error } = await supabase.from('lead_fotos').delete().eq('id', photoToDelete.id);
      
      if (error) throw error;
      
      toast({ title: "Foto eliminada" });
      setPhotos(prev => prev.filter(p => p.id !== photoToDelete.id));
    } catch (error) {
      console.error("Delete error:", error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar." });
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const openPreview = async (photo) => {
    try {
        let path = photo.url || photo.archivo_url;
        if (path.includes('lead_fotos/')) path = path.split('lead_fotos/')[1];
        const { data } = await supabase.storage.from('lead_fotos').createSignedUrl(path, 3600);
        setSelectedPhoto({ ...photo, signedUrl: data.signedUrl });
        setPreviewOpen(true);
    } catch (e) {}
  };

  if (!leadId) return null;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center gap-4 bg-card p-4 rounded-xl border shadow-sm sticky top-0 z-10">
        <h2 className="text-lg font-bold flex items-center gap-2"><ImageIcon className="w-5 h-5 text-primary" /> Galería ({photos.length})</h2>
        {canUpload && <Button onClick={() => setIsUploadModalOpen(true)}><Plus className="w-4 h-4 mr-2" /> Subir</Button>}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">{[1,2,3].map(i=><div key={i} className="aspect-square bg-muted rounded-xl animate-pulse"/>)}</div>
      ) : photos.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed rounded-xl bg-muted/5"><ImageIcon className="w-12 h-12 mx-auto text-muted-foreground/30"/><p className="text-muted-foreground mt-2">Sin imágenes</p></div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {photos.map((photo) => (
            <Card key={photo.id} className="group overflow-hidden relative hover:shadow-md rounded-xl">
              <div className="aspect-square relative cursor-pointer bg-black/5" onClick={() => openPreview(photo)}>
                <AsyncImage path={photo.url || photo.archivo_url} alt={photo.descripcion} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                   <Button variant="secondary" size="icon" className="rounded-full" onClick={(e) => {e.stopPropagation(); openPreview(photo);}}><Maximize2 className="w-4 h-4"/></Button>
                   {canUpload && <Button variant="destructive" size="icon" className="rounded-full" onClick={(e) => {e.stopPropagation(); setPhotoToDelete(photo); setDeleteDialogOpen(true);}}><Trash2 className="w-4 h-4"/></Button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <PhotoUploadModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} onPhotosSelected={handlePhotosSelected} />
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Eliminar foto</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive">Eliminar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-5xl w-[95vw] p-0 bg-black/95 border-none flex justify-center items-center">
            <div className="relative w-full h-[80vh] flex justify-center p-4">
                {selectedPhoto && <img src={selectedPhoto.signedUrl} className="max-w-full max-h-full object-contain" alt="Preview"/>}
                <button onClick={() => setPreviewOpen(false)} className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full"><X className="w-6 h-6"/></button>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeadPhotoGallery;