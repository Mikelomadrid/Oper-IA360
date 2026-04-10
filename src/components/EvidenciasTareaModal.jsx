import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Image as ImageIcon, ExternalLink, CheckCircle2, UploadCloud, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import PhotoUploadModal from '@/components/PhotoUploadModal';

const EvidenciasTareaModal = ({ isOpen, onClose, task, subtaskId, onUploadComplete, readOnly = false }) => {
    const [textEvidence, setTextEvidence] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [existingEvidences, setExistingEvidences] = useState([]);
    const [loadingEvidences, setLoadingEvidences] = useState(true);
    const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

    useEffect(() => {
        if (isOpen && task?.id) fetchExistingEvidences(task.id);
        if (!isOpen) { setTextEvidence(''); setUploadedFiles([]); setExistingEvidences([]); }
    }, [isOpen, task]);

    const fetchExistingEvidences = async (tareaId) => {
        setLoadingEvidences(true);
        try {
            const { data, error } = await supabase.rpc('get_evidencias_por_tarea', { p_tarea_id: tareaId });
            if (error) throw error;
            const filtered = subtaskId ? data.filter(e => e.subtarea_id === subtaskId) : data;
            
            const processed = await Promise.all((filtered || []).map(async (ev) => {
                let displayUrl = ev.archivo_url || ev.archivo_path;
                let isImage = false;
                if (displayUrl && displayUrl.startsWith('proyecto_fotos/')) {
                    const { data: signed } = await supabase.storage.from('proyecto_fotos').createSignedUrl(displayUrl.replace(/^proyecto_fotos\//, ''), 3600);
                    if (signed?.signedUrl) { displayUrl = signed.signedUrl; isImage = true; }
                } else if (displayUrl && displayUrl.match(/\.(jpg|png|webp)/i)) { isImage = true; }
                return { ...ev, displayUrl, isImage };
            }));
            setExistingEvidences(processed);
        } catch (e) { console.error(e); } finally { setLoadingEvidences(false); }
    };

    const handlePhotosSelected = (files) => {
        setUploadedFiles(files);
        setIsPhotoModalOpen(false);
    };

    const handleSaveEvidence = async () => {
        if (!uploadedFiles.length && !textEvidence.trim()) {
            toast({ variant: 'destructive', title: 'Falta información', description: 'Sube foto o escribe nota.' });
            return;
        }
        setIsSubmitting(true);
        try {
            let evidenceUrl = textEvidence.trim();

            if (uploadedFiles.length > 0) {
                // Upload first file (single evidence per submission logic, or loop if needed)
                const file = uploadedFiles[0];
                const fileExt = file.name.split('.').pop();
                const fileName = `evidencias/${task.id}_${subtaskId}_${Date.now()}.${fileExt}`;
                const filePath = `${task.proyecto_id}/tareas/${task.id}/${fileName}`;
                
                const { error: upErr } = await supabase.storage.from('proyecto_fotos').upload(filePath, file);
                if (upErr) throw upErr;
                evidenceUrl = `proyecto_fotos/${filePath}`;
            }

            const { error: rpcError } = await supabase.rpc('registrar_evidencia_subtarea', {
                p_subtarea_id: subtaskId,
                p_archivo_path: evidenceUrl
            });
            if (rpcError) throw rpcError;
            
            toast({ title: "Guardado", description: "Evidencia registrada." });
            if (onUploadComplete) onUploadComplete();
            onClose();
        } catch (e) {
            toast({ variant: 'destructive', title: "Error", description: e.message });
        } finally { setIsSubmitting(false); }
    };

    const renderContent = () => {
        if (readOnly) {
            if (loadingEvidences) return <Loader2 className="animate-spin mx-auto"/>;
            if (existingEvidences.length === 0) return <div className="text-center text-muted-foreground">Sin evidencias.</div>;
            return <div className="space-y-3 max-h-[60vh] overflow-y-auto">{existingEvidences.map((ev, i) => (
                <div key={i} className="p-2 border rounded-md">{ev.isImage ? <img src={ev.displayUrl} className="w-full h-40 object-contain bg-black/5 rounded"/> : <a href={ev.displayUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Ver archivo</a>}</div>
            ))}</div>;
        }
        return (
            <div className="flex flex-col gap-6 py-2">
                <div className="space-y-3">
                    <Label>Evidencia Visual</Label>
                    <div className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/10 transition-colors" onClick={() => setIsPhotoModalOpen(true)}>
                        {uploadedFiles.length > 0 ? (
                            <div className="text-green-600 font-medium flex items-center gap-2"><CheckCircle2/> {uploadedFiles.length} archivo(s) listo(s)</div>
                        ) : (
                            <><UploadCloud className="w-8 h-8 text-muted-foreground mb-2"/><p className="text-sm font-medium">Toca para subir fotos</p></>
                        )}
                    </div>
                </div>
                <div className="space-y-2"><Label>Nota (Opcional)</Label><Input value={textEvidence} onChange={e=>setTextEvidence(e.target.value)} placeholder="Comentario adicional..."/></div>
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>{readOnly ? "Ver Evidencias" : "Registrar Evidencia"}</DialogTitle></DialogHeader>
                {renderContent()}
                <DialogFooter>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    {!readOnly && <Button onClick={handleSaveEvidence} disabled={isSubmitting}>{isSubmitting ? <Loader2 className="animate-spin"/> : "Guardar"}</Button>}
                </DialogFooter>
            </DialogContent>
            <PhotoUploadModal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} onPhotosSelected={handlePhotosSelected} />
        </Dialog>
    );
};

export default EvidenciasTareaModal;