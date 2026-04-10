import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, Trash2, Download, Upload, Eye, AlertCircle } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

// Helper: Async Signed URL fetcher
const getSignedUrl = async (path) => {
    if (!path) return null;
    let cleanPath = path;
    if (path.includes('partes-data/')) cleanPath = path.split('partes-data/')[1];
    
    const { data, error } = await supabase.storage
        .from('partes-data')
        .createSignedUrl(cleanPath, 3600);
    
    if (error) {
        console.error("Error signing URL:", error);
        return null;
    }
    return data.signedUrl;
};

const PDFPreviewModal = ({ open, onClose, url, fileName, error }) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
                    <DialogDescription>Vista previa del documento PDF.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 bg-slate-100 rounded-md overflow-hidden relative border flex items-center justify-center">
                    {error ? (
                        <div className="flex flex-col items-center justify-center gap-4 text-center p-6 max-w-md">
                            <div className="bg-red-100 p-4 rounded-full text-red-500">
                                <AlertCircle className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-lg text-slate-800 mb-1">No se pudo cargar la vista previa</h3>
                                <p className="text-sm text-slate-600 mb-4">{error}</p>
                                <Button onClick={() => window.open(url, '_blank')} variant="outline">
                                    <Download className="w-4 h-4 mr-2" /> Intentar Descargar
                                </Button>
                            </div>
                        </div>
                    ) : url ? (
                        <iframe src={`${url}#toolbar=0`} className="w-full h-full" title={fileName} onError={(e) => console.error("Iframe load error", e)} />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span>Cargando documento...</span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                    <Button onClick={() => window.open(url, '_blank')}><Download className="w-4 h-4 mr-2" /> Descargar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function ParteDocuments({ parteId, canEdit, canDelete }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    // Preview state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewError, setPreviewError] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (parteId) fetchDocuments();
    }, [parteId]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('partes_archivos')
                .select(`*, subido_por_user:empleados!partes_archivos_subido_por_fkey(nombre, apellidos)`)
                .eq('parte_id', parteId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Filter out images, keep documents (PDF, Doc, etc)
            const docs = (data || []).filter(file => 
                !file.tipo_archivo?.startsWith('image/') && 
                !file.nombre_archivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i)
            );
            
            setDocuments(docs);
        } catch (error) {
            console.error('Error fetching documents:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los documentos.' });
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
            const employeeId = empData?.id;
            
            if (!employeeId) throw new Error("No employee profile found.");

            const fileExt = file.name.split('.').pop();
            const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
            const storagePath = `archivos/${parteId}/${safeFileName}`;

            // 1. Upload
            const { error: uploadError } = await supabase.storage.from('partes-data').upload(storagePath, file);
            if (uploadError) throw uploadError;

            // 2. Insert DB
            const { error: insertError } = await supabase.from('partes_archivos').insert({
                parte_id: parteId,
                archivo_url: storagePath,
                nombre_archivo: file.name,
                tipo_archivo: file.type,
                subido_por: employeeId
            });

            if (insertError) throw insertError;

            // 3. Activity Log
            await supabase.from('partes_actividad').insert({
                parte_id: parteId,
                usuario_id: employeeId,
                contenido: JSON.stringify({
                    path: storagePath,
                    name: file.name,
                    type: file.type,
                    comment: 'Documento subido'
                }),
                tipo: 'archivo',
                fecha_creacion: new Date().toISOString()
            });

            toast({ title: 'Éxito', description: 'Documento subido correctamente.' });
            fetchDocuments();
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('Upload error:', error);
            toast({ variant: 'destructive', title: 'Error', description: `Error subiendo archivo: ${error.message}` });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc) => {
        if (!window.confirm(`¿Eliminar ${doc.nombre_archivo}?`)) return;

        try {
            let path = doc.archivo_url;
            if (path.includes('partes-data/')) path = path.split('partes-data/')[1];

            const { error: storageError } = await supabase.storage.from('partes-data').remove([path]);
            if (storageError) console.warn("Storage delete warning:", storageError);

            const { error: dbError } = await supabase.from('partes_archivos').delete().eq('id', doc.id);
            if (dbError) throw dbError;

            toast({ title: 'Eliminado', description: 'El documento ha sido eliminado.' });
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
        } catch (error) {
            console.error('Delete error:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el documento.' });
        }
    };

    const handleDownload = async (doc) => {
        const url = await getSignedUrl(doc.archivo_url);
        if (url) window.open(url, '_blank');
        else toast({ variant: 'destructive', title: 'Error', description: 'No se pudo obtener el enlace del archivo.' });
    };

    const handlePreview = async (doc) => {
        setPreviewOpen(true);
        setPreviewUrl(null);
        setPreviewError(null);
        setPreviewFile(doc.nombre_archivo);

        try {
            const url = await getSignedUrl(doc.archivo_url);
            if (!url) throw new Error("No se pudo generar el enlace.");
            setPreviewUrl(url);
        } catch (error) {
            setPreviewError(error.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            {canEdit && (
                <Card className="border-dashed border-2 bg-slate-50/50">
                    <CardContent className="flex flex-col items-center justify-center py-6 space-y-4">
                        <Label htmlFor="file-upload" className="cursor-pointer">
                            <div className={`flex items-center justify-center h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                <span className="text-sm font-medium">{uploading ? 'Subiendo...' : 'Subir Documento'}</span>
                            </div>
                            <Input id="file-upload" type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} disabled={uploading} accept=".pdf,.doc,.docx,.xls,.xlsx" />
                        </Label>
                        <p className="text-xs text-muted-foreground">Soporta PDF y Office</p>
                    </CardContent>
                </Card>
            )}

            {/* List Section */}
            <div className="bg-card rounded-md border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-32"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></TableCell></TableRow>
                        ) : documents.length === 0 ? (
                            <TableRow><TableCell colSpan={3} className="text-center h-32 text-muted-foreground"><FileText className="w-8 h-8 mx-auto mb-2 opacity-20" /><p>No hay documentos.</p></TableCell></TableRow>
                        ) : (
                            documents.map((doc) => {
                                const isPdf = doc.nombre_archivo?.toLowerCase().endsWith('.pdf');
                                return (
                                    <TableRow key={doc.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 p-2 rounded text-blue-600"><FileText className="w-4 h-4" /></div>
                                                <div className="flex flex-col">
                                                    <span className="truncate font-semibold text-sm" title={doc.nombre_archivo}>{doc.nombre_archivo}</span>
                                                    <span className="text-[10px] text-muted-foreground">Por: {doc.subido_por_user?.nombre || 'Desconocido'}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{new Date(doc.created_at).toLocaleDateString()}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {isPdf && <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)}><Eye className="w-4 h-4" /></Button>}
                                                <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}><Download className="w-4 h-4" /></Button>
                                                {(canDelete) && <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => handleDelete(doc)}><Trash2 className="w-4 h-4" /></Button>}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            <PDFPreviewModal open={previewOpen} onClose={() => setPreviewOpen(false)} url={previewUrl} fileName={previewFile} error={previewError} />
        </div>
    );
}