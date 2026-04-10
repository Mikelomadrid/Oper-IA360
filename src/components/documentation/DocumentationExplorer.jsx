/*
  CRITICAL ARCHITECTURE NOTE:
  ---------------------------
  Direct inserts to the 'archivos' or 'carpetas' tables are STRICTLY FORBIDDEN in this component.
  All file and folder creation operations MUST use the following Supabase RPC functions:
  
  1. rpc_doc_create_folder(p_nombre, p_parent_id, p_proyecto_id)
  2. rpc_doc_create_file(p_nombre, p_url, p_size, p_mime, p_folder_id, p_proyecto_id)

  These RPCs handle the resolution of 'auth.uid()' to the correct 'empleados.id' server-side,
  ensuring data integrity for the 'created_by' foreign key.
  
  Any code attempting to bypass these RPCs with direct 'supabase.from(...).insert()' will cause
  referential integrity errors and must be rejected.
*/

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { 
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription 
} from "@/components/ui/dialog";
import { 
    DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, 
    DropdownMenuSeparator, DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
    Folder, File as FileIcon, FileText, Image as ImageIcon, 
    MoreHorizontal, Download, Trash2, Edit2, Upload, 
    FolderPlus, ArrowUpLeft, Home, Loader2, Search, AlertTriangle
} from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

// Helper for file sizes
const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

// Helper for icons
const getItemIcon = (type, mime) => {
    if (type === 'folder') return <Folder className="w-5 h-5 text-yellow-500 fill-yellow-100" />;
    if (mime?.includes('image')) return <ImageIcon className="w-5 h-5 text-purple-600" />;
    if (mime?.includes('pdf')) return <FileText className="w-5 h-5 text-red-600" />;
    return <FileIcon className="w-5 h-5 text-blue-500" />;
};

const DocumentationExplorer = ({ projectId = null, bucketName = 'admin_docs', title = 'Documentación' }) => {
    const { toast } = useToast();
    const { user, sessionRole } = useAuth(); // We need 'user' for auth.uid()
    
    // State
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [breadcrumbs, setBreadcrumbs] = useState([{ id: null, name: 'Inicio' }]);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentEmpleado, setCurrentEmpleado] = useState(null);
    const [empleadoError, setEmpleadoError] = useState(false);

    // Modal States
    const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [isRenameOpen, setIsRenameOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    
    // Action Context
    const [newFolderName, setNewFolderName] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Initial check for employee record
    useEffect(() => {
        const checkEmpleado = async () => {
            if (!user) return;
            try {
                // We fetch the empleado record linked to the current auth user
                // This is crucial because RPCs rely on this relationship
                const { data, error } = await supabase
                    .from('empleados')
                    .select('id, nombre, apellidos, rol')
                    .eq('auth_user_id', user.id)
                    .single();

                if (error || !data) {
                    console.error("DocumentationExplorer: Empleado record missing for auth.uid()", user.id);
                    setEmpleadoError(true);
                    setCurrentEmpleado(null);
                } else {
                    setCurrentEmpleado(data);
                    setEmpleadoError(false);
                }
            } catch (e) {
                console.error("DocumentationExplorer: Error checking empleado", e);
                setEmpleadoError(true);
            }
        };
        checkEmpleado();
    }, [user]);

    // Fetch Content
    const fetchContent = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.rpc('rpc_doc_get_content', {
                p_parent_id: currentFolderId,
                p_proyecto_id: projectId
            });

            if (error) throw error;
            
            // Client-side sort: Folders first, then files
            const sorted = (data || []).sort((a, b) => {
                if (a.tipo === b.tipo) return a.nombre.localeCompare(b.nombre);
                return a.tipo === 'folder' ? -1 : 1;
            });
            
            setItems(sorted);
        } catch (err) {
            console.error("DocumentationExplorer: Fetch error", err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el contenido.' });
        } finally {
            setLoading(false);
        }
    }, [currentFolderId, projectId]);

    useEffect(() => {
        fetchContent();
    }, [fetchContent]);

    // Navigation Handlers
    const handleEnterFolder = (folder) => {
        setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.nombre }]);
        setCurrentFolderId(folder.id);
    };

    const handleBreadcrumbClick = (index) => {
        const newCrumbs = breadcrumbs.slice(0, index + 1);
        setBreadcrumbs(newCrumbs);
        setCurrentFolderId(newCrumbs[newCrumbs.length - 1].id);
    };

    const handleUpLevel = () => {
        if (breadcrumbs.length > 1) {
            handleBreadcrumbClick(breadcrumbs.length - 2);
        }
    };

    // --- ACTIONS ---

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        if (empleadoError || !currentEmpleado) {
            toast({ variant: 'destructive', title: 'Permiso denegado', description: 'No tienes un perfil de empleado asociado.' });
            return;
        }
        
        try {
            // STRICTLY using RPC
            const { data, error } = await supabase.rpc('rpc_doc_create_folder', {
                p_nombre: newFolderName.trim(),
                p_parent_id: currentFolderId,
                p_proyecto_id: projectId
            });

            if (error) {
                console.error("RPC Error (Create Folder):", {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code,
                    uid: user?.id,
                    empleadoId: currentEmpleado?.id
                });
                throw error;
            }

            toast({ title: 'Carpeta creada' });
            setNewFolderName('');
            setIsCreateFolderOpen(false);
            fetchContent();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleUpload = async () => {
        if (!uploadFile) return;
        if (empleadoError || !currentEmpleado) {
            toast({ variant: 'destructive', title: 'Permiso denegado', description: 'No tienes un perfil de empleado asociado.' });
            return;
        }
        
        // Validation
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB
        if (uploadFile.size > MAX_SIZE) {
            toast({ variant: 'destructive', title: 'Archivo muy grande', description: 'El tamaño máximo es 50MB.' });
            return;
        }

        setUploading(true);
        try {
            // 1. Upload to Storage
            const fileExt = uploadFile.name.split('.').pop();
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `${projectId || 'global'}/${currentFolderId || 'root'}/${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from(bucketName)
                .upload(filePath, uploadFile);

            if (uploadError) throw uploadError;

            // 2. Register Metadata in DB via RPC
            // STRICTLY using RPC
            const { error: dbError } = await supabase.rpc('rpc_doc_create_file', {
                p_nombre: uploadFile.name,
                p_url: filePath,
                p_size: uploadFile.size,
                p_mime: uploadFile.type,
                p_folder_id: currentFolderId,
                p_proyecto_id: projectId
            });

            if (dbError) {
                console.error("RPC Error (Create File):", {
                    message: dbError.message,
                    details: dbError.details,
                    hint: dbError.hint,
                    code: dbError.code,
                    uid: user?.id,
                    empleadoId: currentEmpleado?.id,
                    payload: {
                        name: uploadFile.name,
                        url: filePath,
                        size: uploadFile.size,
                        mime: uploadFile.type
                    }
                });
                // Clean up storage if DB insert fails
                await supabase.storage.from(bucketName).remove([filePath]);
                throw dbError;
            }

            toast({ title: 'Archivo subido correctamente' });
            setUploadFile(null);
            setIsUploadOpen(false);
            fetchContent();

        } catch (err) {
            console.error("Upload process failed:", err);
            toast({ variant: 'destructive', title: 'Error al subir', description: err.message });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedItem) return;
        
        try {
            if (selectedItem.tipo === 'folder') {
                const { error } = await supabase.rpc('rpc_doc_delete_folder', { p_folder_id: selectedItem.id });
                if (error) throw error;
            } else {
                // Delete file: first DB, then Storage (or vice versa, but DB first prevents listing broken links)
                // File deletion uses direct delete because RPC 'rpc_doc_delete_folder' is only for folders.
                // File ownership/permission is handled by RLS policies on the 'archivos' table.
                const { error: dbError } = await supabase
                    .from('archivos')
                    .delete()
                    .eq('id', selectedItem.id);
                
                if (dbError) throw dbError;

                // Cleanup storage (optional but good practice)
                if (selectedItem.url) {
                    await supabase.storage.from(bucketName).remove([selectedItem.url]);
                }
            }

            toast({ title: 'Elemento eliminado' });
            setIsDeleteOpen(false);
            setSelectedItem(null);
            fetchContent();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error al eliminar', description: err.message });
        }
    };

    const handleRename = async () => {
        if (!selectedItem || !newFolderName.trim()) return;

        try {
            // Renaming via direct update is acceptable as it doesn't affect 'created_by' integrity.
            const table = selectedItem.tipo === 'folder' ? 'carpetas' : 'archivos';
            const { error } = await supabase
                .from(table)
                .update({ nombre: newFolderName.trim() })
                .eq('id', selectedItem.id);

            if (error) throw error;

            toast({ title: 'Renombrado correctamente' });
            setIsRenameOpen(false);
            setSelectedItem(null);
            setNewFolderName('');
            fetchContent();
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error', description: err.message });
        }
    };

    const handleDownload = async (item) => {
        try {
            const { data, error } = await supabase.storage
                .from(bucketName)
                .createSignedUrl(item.url, 3600); // 1 hour

            if (error) throw error;

            window.open(data.signedUrl, '_blank');
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error de descarga', description: err.message });
        }
    };

    const filteredItems = items.filter(i => 
        i.nombre.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            
            {/* --- HEADER TOOLBAR --- */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex items-center gap-3 overflow-hidden">
                    <h2 className="font-bold text-lg whitespace-nowrap">{title}</h2>
                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 mx-2 hidden sm:block" />
                    
                    {/* Breadcrumbs */}
                    <nav className="flex items-center text-sm text-muted-foreground overflow-x-auto no-scrollbar mask-linear-fade">
                        {breadcrumbs.map((crumb, idx) => (
                            <div key={idx} className="flex items-center">
                                {idx > 0 && <span className="mx-2 text-slate-400">/</span>}
                                <button 
                                    onClick={() => handleBreadcrumbClick(idx)}
                                    className={cn(
                                        "hover:text-blue-600 hover:underline transition-colors whitespace-nowrap flex items-center gap-1",
                                        idx === breadcrumbs.length - 1 && "font-semibold text-slate-900 dark:text-slate-100 pointer-events-none"
                                    )}
                                >
                                    {idx === 0 && <Home className="w-3.5 h-3.5" />}
                                    {crumb.name}
                                </button>
                            </div>
                        ))}
                    </nav>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <div className="relative hidden md:block">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input 
                            placeholder="Buscar..." 
                            className="pl-9 w-[200px] h-9 bg-white dark:bg-slate-900" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    {breadcrumbs.length > 1 && (
                        <Button variant="outline" size="icon" onClick={handleUpLevel} title="Subir nivel">
                            <ArrowUpLeft className="w-4 h-4" />
                        </Button>
                    )}
                    
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setIsCreateFolderOpen(true)} 
                        className="gap-2"
                        disabled={empleadoError}
                    >
                        <FolderPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Carpeta</span>
                    </Button>
                    
                    <Button 
                        size="sm" 
                        onClick={() => setIsUploadOpen(true)} 
                        className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={empleadoError}
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden sm:inline">Subir</span>
                    </Button>
                </div>
            </div>

            {/* --- PERMISSION ERROR BANNER --- */}
            {empleadoError && (
                <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-900 p-3 flex items-center justify-center gap-2 text-sm text-red-700 dark:text-red-400">
                    <AlertTriangle className="w-4 h-4" />
                    <span>
                        <strong>Atención:</strong> Tu usuario no está vinculado a un perfil de empleado activo. No puedes subir archivos ni crear carpetas. Contacta con administración.
                        {user && <span className="ml-1 text-xs opacity-75">(UID: {user.id})</span>}
                    </span>
                </div>
            )}

            {/* --- CONTENT AREA --- */}
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 p-0 relative">
                {loading ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-950/50 z-10">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-12">
                        <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-full mb-4">
                            <Folder className="w-10 h-10 text-slate-300" />
                        </div>
                        <p className="text-lg font-medium text-slate-900 dark:text-slate-100">Carpeta vacía</p>
                        <p className="text-sm">Sube archivos o crea carpetas para empezar.</p>
                        <Button 
                            variant="link" 
                            onClick={() => setIsUploadOpen(true)} 
                            className="mt-2"
                            disabled={empleadoError}
                        >
                            Subir primer archivo
                        </Button>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-[50%]">Nombre</TableHead>
                                <TableHead className="hidden md:table-cell">Subido por</TableHead>
                                <TableHead className="hidden sm:table-cell">Fecha</TableHead>
                                <TableHead className="hidden sm:table-cell text-right">Tamaño</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredItems.map((item) => (
                                <TableRow 
                                    key={item.id} 
                                    className="group hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors"
                                    onClick={() => item.tipo === 'folder' ? handleEnterFolder(item) : handleDownload(item)}
                                >
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            {getItemIcon(item.tipo, item.mime_type)}
                                            <span className="truncate max-w-[200px] md:max-w-[300px]">{item.nombre}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                                        {item.created_by_name || '-'}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                                        {item.created_at ? format(new Date(item.created_at), 'd MMM yyyy', { locale: es }) : '-'}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-right text-muted-foreground text-xs font-mono">
                                        {item.tipo === 'file' ? formatBytes(item.size) : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                <DropdownMenuSeparator />
                                                {item.tipo === 'file' && (
                                                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(item); }}>
                                                        <Download className="w-4 h-4 mr-2" /> Descargar
                                                    </DropdownMenuItem>
                                                )}
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setNewFolderName(item.nombre); setIsRenameOpen(true); }}>
                                                    <Edit2 className="w-4 h-4 mr-2" /> Renombrar
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem 
                                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedItem(item); setIsDeleteOpen(true); }}
                                                >
                                                    <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </div>

            {/* --- MODALS --- */}

            {/* Create Folder */}
            <Dialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Nueva Carpeta</DialogTitle>
                        <DialogDescription>Crea una carpeta para organizar tus documentos.</DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Input 
                            placeholder="Nombre de la carpeta" 
                            value={newFolderName} 
                            onChange={(e) => setNewFolderName(e.target.value)} 
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateFolderOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateFolder} disabled={!newFolderName.trim() || empleadoError}>Crear</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Rename */}
            <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Renombrar</DialogTitle>
                    </DialogHeader>
                    <div className="py-2">
                        <Input 
                            value={newFolderName} 
                            onChange={(e) => setNewFolderName(e.target.value)} 
                            autoFocus
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancelar</Button>
                        <Button onClick={handleRename} disabled={!newFolderName.trim()}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Upload */}
            <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Subir Archivo</DialogTitle>
                        <DialogDescription>Selecciona un archivo (PDF, DOCX, Imágenes). Máx 50MB.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input 
                            type="file" 
                            onChange={(e) => setUploadFile(e.target.files?.[0])}
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                        />
                        {uploadFile && (
                            <div className="mt-2 text-sm text-muted-foreground">
                                Seleccionado: <span className="font-medium text-foreground">{uploadFile.name}</span> ({formatBytes(uploadFile.size)})
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={uploading}>Cancelar</Button>
                        <Button onClick={handleUpload} disabled={!uploadFile || uploading || empleadoError}>
                            {uploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            {uploading ? 'Subiendo...' : 'Subir'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete */}
            <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Eliminar elemento?</DialogTitle>
                        <DialogDescription>
                            Estás a punto de eliminar <strong>{selectedItem?.nombre}</strong>. 
                            {selectedItem?.tipo === 'folder' && " La carpeta debe estar vacía para poder eliminarse."}
                            <br/>Esta acción no se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleDelete}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
};

export default DocumentationExplorer;