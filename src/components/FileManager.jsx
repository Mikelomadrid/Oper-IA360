import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { 
    Table, 
    TableBody, 
    TableCell, 
    TableHead, 
    TableHeader, 
    TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { 
    FileText, 
    Download, 
    Trash2, 
    Upload, 
    Loader2, 
    Folder, 
    FolderPlus, 
    ArrowLeft,
    Eye,
    FileImage,
    File as FileIcon
} from 'lucide-react';
import { toast } from "@/components/ui/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { sanitizeKey } from '@/lib/utils'; // Assuming this utility exists

const FileManager = ({ bucketName, prefix, canEdit = false }) => {
    const [files, setFiles] = useState([]);
    const [folders, setFolders] = useState([]);
    const [currentPath, setCurrentPath] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    
    // Modal states
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [uploadFile, setUploadFile] = useState(null);

    // Preview State
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewFile, setPreviewFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);

    const fetchContent = useCallback(async () => {
        setLoading(true);
        try {
            // Construct path: prefix + currentPath
            let folderPath = prefix ? `${prefix}/` : '';
            if (currentPath.length > 0) {
                folderPath += currentPath.join('/') + '/';
            }

            const { data, error } = await supabase.storage
                .from(bucketName)
                .list(folderPath, {
                    limit: 100,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) throw error;

            const loadedFiles = [];
            const loadedFolders = [];

            data.forEach(item => {
                if (item.name === '.placeholder') return; // Skip placeholder files

                if (item.id === null) {
                    // It's a folder
                    loadedFolders.push(item);
                } else {
                    // It's a file
                    loadedFiles.push(item);
                }
            });

            setFiles(loadedFiles);
            setFolders(loadedFolders);

        } catch (error) {
            console.error("Error fetching files:", error);
            toast({
                variant: "destructive",
                title: "Error al cargar archivos",
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    }, [bucketName, prefix, currentPath]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    const handleNavigate = (folderName) => {
        setCurrentPath([...currentPath, folderName]);
    };

    const handleNavigateUp = () => {
        setCurrentPath(currentPath.slice(0, -1));
    };

    const getFileIcon = (fileName) => {
        const ext = fileName?.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return <FileImage className="h-4 w-4 text-purple-500" />;
        if (ext === 'pdf') return <FileText className="h-4 w-4 text-red-500" />;
        return <FileIcon className="h-4 w-4 text-blue-500" />;
    };

    const isPreviewable = (fileName) => {
        const ext = fileName?.split('.').pop().toLowerCase();
        return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'].includes(ext);
    };

    const handleFileAction = async (file, action) => {
        let filePath = prefix ? `${prefix}/` : '';
        if (currentPath.length > 0) {
            filePath += currentPath.join('/') + '/';
        }
        filePath += file.name;

        if (action === 'delete') {
            setItemToDelete({ type: 'file', path: filePath, name: file.name });
            setIsDeleteOpen(true);
        } else if (action === 'download' || action === 'preview') {
            try {
                const { data, error } = await supabase.storage
                    .from(bucketName)
                    .createSignedUrl(filePath, 3600);

                if (error) throw error;

                if (action === 'preview') {
                    setPreviewFile(file);
                    setPreviewUrl(data.signedUrl);
                    setPreviewOpen(true);
                } else {
                    const response = await fetch(data.signedUrl);
                    if (!response.ok) throw new Error('Network response was not ok.');
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = file.name;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    a.remove();
                }
            } catch (error) {
                console.error(`Error ${action}ing file:`, error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: `No se pudo ${action === 'preview' ? 'previsualizar' : 'descargar'} el archivo.`
                });
            }
        }
    };

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        
        const cleanName = sanitizeKey(newFolderName);
        let folderPath = prefix ? `${prefix}/` : '';
        if (currentPath.length > 0) {
            folderPath += currentPath.join('/') + '/';
        }
        folderPath += `${cleanName}/.placeholder`; // Create empty file to init folder

        try {
            const { error } = await supabase.storage
                .from(bucketName)
                .upload(folderPath, new Blob([''], { type: 'text/plain' }));

            if (error) throw error;

            toast({ title: "Carpeta creada", className: "bg-green-600 text-white" });
            setIsNewFolderOpen(false);
            setNewFolderName('');
            fetchContent();
        } catch (error) {
            console.error("Error creating folder:", error);
            toast({
                variant: "destructive",
                title: "Error al crear carpeta",
                description: error.message
            });
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        setUploading(true);

        let folderPath = prefix ? `${prefix}/` : '';
        if (currentPath.length > 0) {
            folderPath += currentPath.join('/') + '/';
        }
        // Sanitize filename but keep extension
        const nameParts = uploadFile.name.split('.');
        const ext = nameParts.pop();
        const baseName = nameParts.join('.');
        const cleanName = sanitizeKey(baseName);
        const finalPath = `${folderPath}${cleanName}.${ext}`;

        try {
            const { error } = await supabase.storage
                .from(bucketName)
                .upload(finalPath, uploadFile, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) throw error;

            toast({ title: "Archivo subido", className: "bg-green-600 text-white" });
            setIsUploadOpen(false);
            setUploadFile(null);
            fetchContent();
        } catch (error) {
            console.error("Error uploading file:", error);
            toast({
                variant: "destructive",
                title: "Error al subir archivo",
                description: error.message
            });
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!itemToDelete) return;

        try {
            if (itemToDelete.type === 'file') {
                const { error } = await supabase.storage
                    .from(bucketName)
                    .remove([itemToDelete.path]);
                if (error) throw error;
            } else {
                // Folder delete logic usually requires deleting all content first.
                // Simple implementation: Try to delete the placeholder. 
                // Ideally, we should recursively delete, but Supabase Storage doesn't support folder delete directly if not empty.
                // We will warn user or just try to delete the folder path (which deletes prefix if empty)
                toast({ title: "Funcionalidad de borrar carpeta no implementada recursivamente.", variant: "warning" });
                return;
            }

            toast({ title: "Elemento eliminado" });
            setIsDeleteOpen(false);
            setItemToDelete(null);
            fetchContent();
        } catch (error) {
            console.error("Error deleting item:", error);
            toast({
                variant: "destructive",
                title: "Error al eliminar",
                description: error.message
            });
        }
    };

    const formatBytes = (bytes, decimals = 2) => {
        if (!+bytes) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2">
                    {currentPath.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={handleNavigateUp}>
                            <ArrowLeft className="w-4 h-4 mr-1" />
                        </Button>
                    )}
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Folder className="w-5 h-5 text-primary" />
                        {currentPath.length === 0 ? 'Documentos' : currentPath[currentPath.length - 1]}
                    </h3>
                </div>
                
                {canEdit && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsNewFolderOpen(true)}>
                            <FolderPlus className="w-4 h-4 mr-2" /> Nueva Carpeta
                        </Button>
                        <Button size="sm" onClick={() => setIsUploadOpen(true)}>
                            <Upload className="w-4 h-4 mr-2" /> Subir Archivo
                        </Button>
                    </div>
                )}
            </div>

            <Card>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50%]">Nombre</TableHead>
                                <TableHead>Tamaño</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <div className="flex justify-center items-center gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                            Cargando...
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (files.length === 0 && folders.length === 0) ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                                        Esta carpeta está vacía.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {folders.map((folder) => (
                                        <TableRow 
                                            key={folder.name} 
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => handleNavigate(folder.name)}
                                        >
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Folder className="w-5 h-5 text-yellow-500 fill-yellow-500/20" />
                                                    <span className="font-medium">{folder.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>-</TableCell>
                                            <TableCell>-</TableCell>
                                            <TableCell className="text-right">
                                                {/* Actions for folders if needed */}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {files.map((file) => (
                                        <TableRow key={file.name}>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getFileIcon(file.name)}
                                                    <span className="truncate max-w-[200px] sm:max-w-[300px]" title={file.name}>
                                                        {file.name}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {formatBytes(file.metadata?.size)}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {file.created_at ? new Date(file.created_at).toLocaleDateString() : '-'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8"
                                                        onClick={(e) => { e.stopPropagation(); handleFileAction(file, 'preview'); }}
                                                        title="Previsualizar"
                                                    >
                                                        <Eye className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-8 w-8"
                                                        onClick={(e) => { e.stopPropagation(); handleFileAction(file, 'download'); }}
                                                        title="Descargar"
                                                    >
                                                        <Download className="w-4 h-4 text-muted-foreground" />
                                                    </Button>
                                                    {canEdit && (
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                            onClick={(e) => { e.stopPropagation(); handleFileAction(file, 'delete'); }}
                                                            title="Eliminar"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Upload Modal */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Subir Archivo</DialogTitle>
                        <DialogDescription>
                            Selecciona un archivo para subir a la carpeta actual.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            type="file" 
                            onChange={(e) => setUploadFile(e.target.files[0])} 
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancelar</Button>
                        <Button onClick={handleUpload} disabled={!uploadFile || uploading}>
                            {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Subir
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* New Folder Modal */}
            <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva Carpeta</DialogTitle>
                        <DialogDescription>
                            Introduce el nombre de la nueva carpeta.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            placeholder="Nombre de carpeta" 
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewFolderOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
                            Crear
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Estás seguro?</DialogTitle>
                        <DialogDescription>
                            Esta acción eliminará permanentemente el archivo <strong>{itemToDelete?.name}</strong>.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDeleteConfirm}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Modal */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-4 border-b shrink-0">
                        <DialogTitle className="flex items-center gap-2 truncate pr-8">
                            {previewFile && getFileIcon(previewFile.name)}
                            <span className="truncate">{previewFile?.name}</span>
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 bg-muted/10 overflow-hidden relative flex items-center justify-center p-4">
                        {previewUrl && previewFile && (
                            <>
                                {previewFile.name.toLowerCase().endsWith('.pdf') ? (
                                    <iframe 
                                        src={`${previewUrl}#toolbar=0`} 
                                        className="w-full h-full rounded-md border bg-white shadow-sm" 
                                        title="Vista previa PDF"
                                    />
                                ) : isPreviewable(previewFile.name) ? (
                                    <img 
                                        src={previewUrl} 
                                        alt="Vista previa" 
                                        className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                                    />
                                ) : (
                                    <div className="text-center p-8">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                                            <FileText className="w-8 h-8 text-muted-foreground" />
                                        </div>
                                        <h3 className="text-lg font-medium mb-2">Vista previa no disponible</h3>
                                        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                                            Este formato de archivo no se puede previsualizar directamente. 
                                            Puedes descargarlo para verlo en tu dispositivo.
                                        </p>
                                        <Button onClick={() => window.open(previewUrl, '_blank')}>
                                            <Download className="w-4 h-4 mr-2" /> Descargar archivo
                                        </Button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t bg-background shrink-0 sm:justify-between">
                        <div className="hidden sm:flex items-center text-sm text-muted-foreground">
                            {previewFile && (
                                <>
                                    <span className="mr-4">Tamaño: {formatBytes(previewFile.metadata?.size)}</span>
                                    <span>Fecha: {new Date(previewFile.created_at).toLocaleDateString()}</span>
                                </>
                            )}
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button variant="outline" onClick={() => setPreviewOpen(false)} className="flex-1 sm:flex-none">
                                Cerrar
                            </Button>
                            {previewUrl && (
                                <Button onClick={() => window.open(previewUrl, '_blank')} className="flex-1 sm:flex-none">
                                    <Download className="w-4 h-4 mr-2" /> Descargar
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default FileManager;