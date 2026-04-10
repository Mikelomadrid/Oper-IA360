import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, FileText, Trash2, Download, Upload, Eye, X, AlertCircle, Link2Off } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
// Import shared logic from PhotoGallery to maintain consistency
import { isImageFile } from '@/components/LeadPhotoGallery';

// --- STRICT DOC FILTER LOGIC ---
// Complementary to isImageFile. If it is an image, it is NOT a document.
// This handles cases where an image was mislabeled as 'documento' in DB.
const isDocumentFile = (file) => {
    return !isImageFile(file);
};

// --- PDF Preview Component ---
const PDFPreviewModal = ({ open, onClose, url, fileName, error }) => {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="truncate pr-8">{fileName}</DialogTitle>
                    <DialogDescription>
                        Vista previa del documento PDF.
                    </DialogDescription>
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
                                {error !== "El archivo no se encuentra en el servidor." && url && (
                                    <Button onClick={() => window.open(url, '_blank')} variant="outline">
                                        <Download className="w-4 h-4 mr-2" /> Intentar Descargar
                                    </Button>
                                )}
                            </div>
                        </div>
                    ) : url ? (
                        <iframe 
                            src={`${url}#toolbar=0`} 
                            className="w-full h-full" 
                            title={fileName}
                            onError={(e) => console.error("Iframe load error", e)}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin" />
                            <span>Cargando documento...</span>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cerrar</Button>
                    {url && !error && (
                        <Button onClick={() => window.open(url, '_blank')}>
                            <Download className="w-4 h-4 mr-2" /> Descargar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function LeadDocuments({ leadId, canEdit, canDelete }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [documents, setDocuments] = useState([]);
    const [creatorsMap, setCreatorsMap] = useState({});
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadType, setUploadType] = useState('documento');
    
    // Track broken files (404s) to prevent loops and show UI feedback
    const [brokenFileIds, setBrokenFileIds] = useState(new Set());
    
    // Preview state
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewError, setPreviewError] = useState(null);

    const fileInputRef = useRef(null);

    // Bucket name configuration
    const BUCKET_NAME = 'lead_docs'; 

    useEffect(() => {
        if (leadId) fetchDocuments();
    }, [leadId]);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            // Task 4: Modified query to fetch ALL files, then filter client-side.
            // Previously: .neq('tipo', 'imagen')
            // Now: Fetch all, then use isDocumentFile() which uses the strict inverse logic of isImageFile().
            // This ensures mislabeled PDFs (type='imagen') DO appear here, and mislabeled JPGs (type='documento') do NOT.
            const { data, error } = await supabase
                .from('lead_fotos')
                .select('*')
                .eq('lead_id', leadId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            const allFiles = data || [];
            
            // Apply strict document filter
            const docs = allFiles.filter(file => isDocumentFile(file));
            
            setDocuments(docs);

            // Fetch creators info manually
            const uploaderIds = [...new Set(docs.map(d => d.uploaded_by || d.usuario_id).filter(Boolean))];
            if (uploaderIds.length > 0) {
                const { data: employees, error: empError } = await supabase
                  .from('empleados')
                  .select('auth_user_id, nombre, apellidos')
                  .in('auth_user_id', uploaderIds);
                
                if (!empError && employees) {
                  const map = {};
                  employees.forEach(emp => {
                    map[emp.auth_user_id] = emp;
                  });
                  setCreatorsMap(map);
                }
            }

        } catch (error) {
            console.error('Error fetching documents:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los documentos.' });
        } finally {
            setLoading(false);
        }
    };

    /**
     * Helper to clean path from full URL
     */
    const getStoragePath = (fullUrlOrPath) => {
        if (!fullUrlOrPath) return null;
        try {
            // Check if it's a full URL
            if (fullUrlOrPath.startsWith('http')) {
                const url = new URL(fullUrlOrPath);
                // Expected format: /storage/v1/object/public/bucket_name/folder/file
                // or /storage/v1/object/sign/bucket_name/folder/file
                const parts = url.pathname.split(`/${BUCKET_NAME}/`);
                if (parts.length > 1) {
                    return decodeURIComponent(parts[1]);
                }
                // Fallback for some configurations
                return fullUrlOrPath;
            }
            return fullUrlOrPath;
        } catch (e) {
            console.error("Error parsing URL path:", e);
            return fullUrlOrPath;
        }
    };

    /**
     * Generates a usable URL for download or preview.
     * Attempts Signed URL first for security, falls back to Public URL if configured as public.
     * Throws specific error if file is missing.
     */
    const generateFileUrl = async (path) => {
        try {
            // 1. Try Signed URL first (Works for both Private and Public buckets usually)
            const { data: signedData, error: signedError } = await supabase.storage
                .from(BUCKET_NAME)
                .createSignedUrl(path, 3600); // 1 hour validity

            if (signedError) throw signedError;
            if (signedData?.signedUrl) return signedData.signedUrl;

            // 2. Fallback to Public URL (only if signed failed without throwing, which is rare)
            const { data: publicData } = supabase.storage
                .from(BUCKET_NAME)
                .getPublicUrl(path);
            
            if (publicData?.publicUrl) return publicData.publicUrl;

            return null;
        } catch (error) {
            // Detect 404 / Not Found errors from Supabase Storage
            const msg = error.message?.toLowerCase() || '';
            if (msg.includes('not found') || msg.includes('404') || msg.includes('object not found')) {
                throw new Error("NOT_FOUND");
            }
            throw error;
        }
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploading(true);
        try {
            const fileExt = file.name.split('.').pop();
            const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const storagePath = `${leadId}/${Date.now()}_${safeFileName}`;

            // 1. Upload to storage
            const { error: uploadError } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(storagePath, file);

            if (uploadError) throw uploadError;

            // 2. Insert DB record
            const { error: insertError } = await supabase.rpc('insertar_lead_foto', { 
                p_lead_id: leadId, 
                p_archivo_url: storagePath, 
                p_descripcion: file.name,
                p_tipo: uploadType,
                p_usuario_id: user.id
            });

            if (insertError) throw insertError;

            toast({ title: 'Éxito', description: 'Documento subido correctamente.' });
            fetchDocuments();
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (error) {
            console.error('Upload error:', error);
            let msg = error.message;
            if (error.message.includes('bucket not found')) msg = `El bucket '${BUCKET_NAME}' no existe. Contacta al admin.`;
            toast({ variant: 'destructive', title: 'Error', description: `Error subiendo archivo: ${msg}` });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (doc) => {
        const isBroken = brokenFileIds.has(doc.id);
        const confirmMsg = isBroken 
            ? `¿Eliminar referencia rota de "${doc.descripcion}"?` 
            : `¿Eliminar ${doc.descripcion || 'documento'}?`;

        if (!window.confirm(confirmMsg)) return;

        try {
            let path = getStoragePath(doc.archivo_url || doc.url);

            // Only try to delete from storage if NOT known to be broken
            if (!isBroken && path && path.length > 0) {
                 const { error: storageError } = await supabase.storage
                    .from(BUCKET_NAME)
                    .remove([path]);
                 
                 if (storageError) {
                     console.warn("Storage delete warning (might be already deleted or wrong path):", storageError);
                 }
            }

            const { error: dbError } = await supabase
                .from('lead_fotos')
                .delete()
                .eq('id', doc.id);

            if (dbError) throw dbError;

            toast({ title: 'Eliminado', description: 'El documento ha sido eliminado.' });
            setDocuments(prev => prev.filter(d => d.id !== doc.id));
            setBrokenFileIds(prev => {
                const next = new Set(prev);
                next.delete(doc.id);
                return next;
            });
        } catch (error) {
            console.error('Delete error:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el documento.' });
        }
    };

    const handleDownload = async (doc) => {
        if (brokenFileIds.has(doc.id)) return;

        const path = getStoragePath(doc.archivo_url || doc.url);
        
        try {
            const url = await generateFileUrl(path);
            if (url) {
                window.open(url, '_blank');
            } else {
                throw new Error("URL generation failed");
            }
        } catch (error) {
            if (error.message === 'NOT_FOUND') {
                setBrokenFileIds(prev => new Set(prev).add(doc.id));
                toast({ variant: 'destructive', title: 'Archivo no encontrado', description: 'El archivo no existe en el servidor.' });
            } else {
                toast({ variant: 'destructive', title: 'Error', description: 'No se pudo obtener el enlace del archivo.' });
            }
        }
    };

    const handlePreview = async (doc) => {
        if (brokenFileIds.has(doc.id)) return;

        setPreviewOpen(true);
        setPreviewUrl(null);
        setPreviewError(null);
        setPreviewFile(doc.descripcion || 'Documento');

        try {
            const path = getStoragePath(doc.archivo_url || doc.url);
            
            // Generate URL
            const url = await generateFileUrl(path);
            
            if (!url) {
                throw new Error("No se pudo generar el enlace de visualización.");
            }

            // Optional: Check if file is reachable (head request) to avoid 404 inside iframe
            try {
                const check = await fetch(url, { method: 'HEAD' });
                if (!check.ok) {
                    if (check.status === 404) throw new Error("NOT_FOUND");
                    throw new Error(`El archivo no es accesible (Status: ${check.status})`);
                }
            } catch (headError) {
                if (headError.message === "NOT_FOUND") throw headError;
                console.warn("Head check failed, proceeding anyway:", headError);
            }

            setPreviewUrl(url);
        } catch (error) {
            console.error("Preview error:", error);
            if (error.message === "NOT_FOUND") {
                setPreviewError("El archivo no se encuentra en el servidor.");
                setBrokenFileIds(prev => new Set(prev).add(doc.id));
            } else {
                setPreviewError(error.message || "Error al cargar la vista previa.");
            }
        }
    };

    return (
        <div className="space-y-6">
            {/* Upload Section */}
            {canEdit && (
                <Card className="border-dashed border-2 bg-slate-50/50">
                    <CardContent className="flex flex-col items-center justify-center py-6 space-y-4">
                        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-md">
                            <div className="flex-1 w-full">
                                <Label htmlFor="doc-type" className="sr-only">Tipo</Label>
                                <Select value={uploadType} onValueChange={setUploadType}>
                                    <SelectTrigger className="bg-white">
                                        <SelectValue placeholder="Tipo de archivo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="documento">Documento General</SelectItem>
                                        <SelectItem value="presupuesto">Presupuesto</SelectItem>
                                        <SelectItem value="plano">Plano</SelectItem>
                                        <SelectItem value="factura">Factura</SelectItem>
                                        <SelectItem value="contrato">Contrato</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1 w-full">
                                <Label htmlFor="file-upload" className="cursor-pointer w-full">
                                    <div className={`flex items-center justify-center h-10 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors w-full shadow-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                                        {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                                        <span className="text-sm font-medium">{uploading ? 'Subiendo...' : 'Subir Archivo'}</span>
                                    </div>
                                    <Input 
                                        id="file-upload" 
                                        type="file" 
                                        ref={fileInputRef}
                                        className="hidden" 
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                                    />
                                </Label>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Soporta PDF, Office e Imágenes (Máx 50MB)</p>
                    </CardContent>
                </Card>
            )}

            {/* List Section */}
            <div className="bg-card rounded-md border shadow-sm overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nombre</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-32">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Cargando documentos...</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : documents.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center h-32 text-muted-foreground">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <FileText className="w-8 h-8 opacity-20" />
                                        <p>No hay documentos adjuntos en este lead.</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            documents.map((doc) => {
                                const isPdf = doc.descripcion?.toLowerCase().endsWith('.pdf');
                                const uploaderId = doc.uploaded_by || doc.usuario_id;
                                const creator = creatorsMap[uploaderId];
                                const creatorName = creator ? `${creator.nombre} ${creator.apellidos || ''}` : (uploaderId === user?.id ? 'Mí' : 'Desconocido');
                                const isBroken = brokenFileIds.has(doc.id);

                                return (
                                    <TableRow key={doc.id} className={`hover:bg-muted/50 transition-colors ${isBroken ? 'bg-red-50/50' : ''}`}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded ${isBroken ? 'bg-red-100 text-red-500' : 'bg-blue-50 text-blue-600'}`}>
                                                    {isBroken ? <Link2Off className="w-4 h-4 shrink-0" /> : <FileText className="w-4 h-4 shrink-0" />}
                                                </div>
                                                <div className="flex flex-col max-w-[200px] sm:max-w-[300px]">
                                                    <span className={`truncate font-semibold text-sm ${isBroken ? 'text-red-600 line-through decoration-red-300' : ''}`} title={doc.descripcion}>
                                                        {doc.descripcion || 'Documento sin nombre'}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground truncate">
                                                        {isBroken ? 'Archivo no encontrado' : `Subido por: ${creatorName}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize text-xs bg-slate-50">
                                                {doc.tipo}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                                            {new Date(doc.created_at).toLocaleDateString()}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                {!isBroken && isPdf && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handlePreview(doc)} title="Vista Previa">
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {!isBroken && (
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-green-600 hover:bg-green-50" onClick={() => handleDownload(doc)} title="Descargar">
                                                        <Download className="w-4 h-4" />
                                                    </Button>
                                                )}
                                                {/* Allow delete if user is admin OR if user uploaded it */}
                                                {(canDelete || doc.usuario_id === user?.id || doc.uploaded_by === user?.id) && (
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className={`h-8 w-8 ${isBroken ? 'text-red-600 hover:bg-red-100' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`} 
                                                        onClick={() => handleDelete(doc)} 
                                                        title={isBroken ? "Eliminar referencia rota" : "Eliminar"}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* PDF Preview Modal */}
            <PDFPreviewModal 
                open={previewOpen} 
                onClose={() => setPreviewOpen(false)} 
                url={previewUrl} 
                fileName={previewFile}
                error={previewError}
            />
        </div>
    );
}