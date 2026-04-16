import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import {
    Folder, FileText, Edit2, Trash2, Plus, Loader2, Upload, Home, ChevronRight, Download,
    Image as ImageIcon, File, Video, ChevronDown, Move, CornerUpRight, MoreVertical, AlertCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ============================================================
// EmployeeFolders.jsx
// Sistema de documentos personales del empleado.
// Usa tablas: empleado_carpetas / empleado_archivos
// Usa bucket: empleado_documentos
// ============================================================

// --- Utility Helpers ---
const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-purple-500" />;
    if (mimeType === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    if (mimeType?.startsWith('video/')) return <Video className="w-6 h-6 text-blue-500" />;
    return <File className="w-6 h-6 text-gray-500" />;
};

const formatBytes = (bytes) => {
    if (!bytes) return '';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// --- Sub-components ---

const FolderTreeItem = ({ folder, level = 0, currentFolderId, onSelect, onToggle, expandedFolders, allFolders }) => {
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = allFolders.some(f => f.carpeta_padre_id === folder.id);
    const isSelected = currentFolderId === folder.id;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => onSelect(folder.id)}
            >
                <button
                    onClick={(e) => { e.stopPropagation(); onToggle(folder.id); }}
                    className={cn("p-0.5 rounded-sm hover:bg-black/5 dark:hover:bg-white/10", !hasChildren && "invisible")}
                >
                    {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                <Folder className={cn("w-4 h-4", isSelected ? "fill-primary/20" : "fill-none")} />
                <span className="truncate">{folder.nombre}</span>
            </div>
            {isExpanded && (
                <div className="flex flex-col">
                    {allFolders
                        .filter(f => f.carpeta_padre_id === folder.id)
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(child => (
                            <FolderTreeItem
                                key={child.id}
                                folder={child}
                                level={level + 1}
                                currentFolderId={currentFolderId}
                                onSelect={onSelect}
                                onToggle={onToggle}
                                expandedFolders={expandedFolders}
                                allFolders={allFolders}
                            />
                        ))
                    }
                </div>
            )}
        </div>
    );
};

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function EmployeeFolders({ empleadoId }) {
    const { sessionRole } = useAuth();
    const userRole = sessionRole?.rol;
    const currentEmpleadoId = sessionRole?.empleadoId || null;
    const isAuthLoaded = sessionRole?.loaded;

    // Solo admin/encargado pueden gestionar (crear, subir, editar, borrar)
    const isAdminOrEncargado = ['admin', 'encargado'].includes(userRole);
    // Cualquiera autenticado puede leer/descargar (la RLS filtra qué ven)
    const canEdit = isAdminOrEncargado;

    // Navigation State
    const [currentFolderId, setCurrentFolderId] = useState(null);
    const [expandedFolders, setExpandedFolders] = useState(new Set());

    // Data State
    const [allFolders, setAllFolders] = useState([]);
    const [currentFiles, setCurrentFiles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Action State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);
    const [isMoveOpen, setIsMoveOpen] = useState(false);

    const [selectedItem, setSelectedItem] = useState(null);
    const [itemType, setItemType] = useState(null); // 'folder' | 'file'
    const [moveTargetId, setMoveTargetId] = useState(null);

    const [inputValue, setInputValue] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const fileInputRef = React.useRef(null);

    // --- Data Fetching ---
    const fetchAllData = useCallback(async () => {
        if (!empleadoId) return;
        setLoading(true);
        try {
            // 1) Todas las carpetas del empleado
            const { data: foldersData, error: foldersError } = await supabase
                .from('empleado_carpetas')
                .select('*')
                .eq('empleado_id', empleadoId)
                .order('nombre', { ascending: true });

            if (foldersError) throw foldersError;
            setAllFolders(foldersData || []);

            // 2) Archivos de la carpeta actual (o de la raíz si currentFolderId es null)
            let fileQuery = supabase
                .from('empleado_archivos')
                .select('*')
                .eq('empleado_id', empleadoId)
                .order('created_at', { ascending: false });

            if (currentFolderId) {
                fileQuery = fileQuery.eq('carpeta_id', currentFolderId);
            } else {
                fileQuery = fileQuery.is('carpeta_id', null);
            }

            const { data: fileData, error: fileError } = await fileQuery;
            if (fileError) throw fileError;
            setCurrentFiles(fileData || []);
        } catch (error) {
            console.error('Error fetching content:', error);
            toast({
                variant: "destructive",
                title: "Error al cargar contenido",
                description: error.message
            });
        } finally {
            setLoading(false);
        }
    }, [empleadoId, currentFolderId]);

    useEffect(() => {
        // Reset al cambiar de empleado
        setCurrentFolderId(null);
        setExpandedFolders(new Set());
    }, [empleadoId]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // --- Computed ---
    const currentSubfolders = useMemo(() => {
        return allFolders
            .filter(f => f.carpeta_padre_id === currentFolderId)
            .sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [allFolders, currentFolderId]);

    const breadcrumbs = useMemo(() => {
        const crumbs = [{ id: null, name: 'Documentos' }];
        let curr = allFolders.find(f => f.id === currentFolderId);
        const path = [];
        while (curr) {
            path.unshift({ id: curr.id, name: curr.nombre });
            curr = allFolders.find(f => f.id === curr.carpeta_padre_id);
        }
        return [...crumbs, ...path];
    }, [allFolders, currentFolderId]);

    // --- Handlers ---
    const handleNavigate = (folderId) => {
        setCurrentFolderId(folderId);
        if (folderId) {
            setExpandedFolders(prev => new Set(prev).add(folderId));
        }
    };

    const toggleFolderExpand = (folderId) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            if (next.has(folderId)) next.delete(folderId);
            else next.add(folderId);
            return next;
        });
    };

    // --- CRUD ---
    const handleCreateFolder = async () => {
        if (!inputValue.trim()) return;
        if (!currentEmpleadoId) {
            toast({ variant: "destructive", title: "Error de permisos", description: "No hay empleado vinculado a tu usuario." });
            return;
        }
        setActionLoading(true);
        try {
            const { error } = await supabase.from('empleado_carpetas').insert([{
                empleado_id: empleadoId,
                nombre: inputValue.trim(),
                carpeta_padre_id: currentFolderId,
                created_by: currentEmpleadoId
            }]);
            if (error) throw error;
            toast({ title: "Carpeta creada" });
            setInputValue('');
            setIsCreateOpen(false);
            fetchAllData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleRename = async () => {
        if (!selectedItem || !inputValue.trim()) return;
        setActionLoading(true);
        try {
            const table = itemType === 'folder' ? 'empleado_carpetas' : 'empleado_archivos';
            const { error } = await supabase
                .from(table)
                .update({ nombre: inputValue.trim() })
                .eq('id', selectedItem.id);
            if (error) throw error;
            toast({ title: "Renombrado con éxito" });
            setInputValue('');
            setSelectedItem(null);
            setIsEditOpen(false);
            fetchAllData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error", description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedItem) return;
        setActionLoading(true);
        try {
            if (itemType === 'folder') {
                const { error } = await supabase
                    .from('empleado_carpetas')
                    .delete()
                    .eq('id', selectedItem.id);
                if (error) throw error;
            } else {
                // Borrar primero del Storage si tiene url
                if (selectedItem.url) {
                    await supabase.storage.from('empleado_documentos').remove([selectedItem.url]);
                }
                const { error } = await supabase
                    .from('empleado_archivos')
                    .delete()
                    .eq('id', selectedItem.id);
                if (error) throw error;
            }
            toast({ title: "Eliminado con éxito" });
            setSelectedItem(null);
            setIsDeleteOpen(false);
            fetchAllData();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al eliminar",
                description: error.code === '23503'
                    ? "La carpeta no está vacía. Elimina su contenido primero."
                    : error.message
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleMove = async () => {
        if (!selectedItem) return;
        if (itemType === 'folder' && selectedItem.id === moveTargetId) {
            toast({ variant: "destructive", title: "Error", description: "No puedes mover una carpeta dentro de sí misma." });
            return;
        }
        setActionLoading(true);
        try {
            if (itemType === 'folder') {
                const { error } = await supabase
                    .from('empleado_carpetas')
                    .update({ carpeta_padre_id: moveTargetId })
                    .eq('id', selectedItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('empleado_archivos')
                    .update({ carpeta_id: moveTargetId })
                    .eq('id', selectedItem.id);
                if (error) throw error;
            }
            toast({ title: "Elemento movido" });
            setSelectedItem(null);
            setIsMoveOpen(false);
            setMoveTargetId(null);
            fetchAllData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error al mover", description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleFileUpload = async (event) => {
        const fileList = event.target.files;
        if (!fileList || fileList.length === 0) return;
        if (!currentEmpleadoId) {
            toast({ variant: "destructive", title: "Error de permisos", description: "No hay empleado vinculado a tu usuario." });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setActionLoading(true);
        try {
            const uploads = Array.from(fileList).map(async (file) => {
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const uniqueId = Date.now() + '_' + Math.random().toString(36).substring(2, 8);
                // Path en Storage: {empleado_id}/{uniqueId}_{nombre}
                const filePath = `${empleadoId}/${uniqueId}_${sanitizedName}`;

                // 1) Subir binario al Storage
                const { error: uploadError } = await supabase.storage
                    .from('empleado_documentos')
                    .upload(filePath, file);
                if (uploadError) throw uploadError;

                // 2) Insertar metadato en la tabla
                const { error: dbError } = await supabase.from('empleado_archivos').insert([{
                    empleado_id: empleadoId,
                    carpeta_id: currentFolderId,
                    nombre: file.name,
                    url: filePath,
                    size: file.size,
                    mime_type: file.type,
                    created_by: currentEmpleadoId
                }]);
                if (dbError) {
                    // Si falla el insert en BD, borramos el binario para no dejar huérfano
                    await supabase.storage.from('empleado_documentos').remove([filePath]);
                    throw dbError;
                }
            });

            await Promise.all(uploads);
            toast({ title: `${fileList.length} archivo(s) subido(s)` });
            fetchAllData();
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error al subir", description: error.message });
        } finally {
            setActionLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownload = async (file) => {
        try {
            const { data, error } = await supabase.storage
                .from('empleado_documentos')
                .createSignedUrl(file.url, 3600);
            if (error) throw error;

            // Forzar descarga real (evita que el navegador abra el PDF)
            const response = await fetch(data.signedUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = file.nombre || 'archivo';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            toast({ variant: "destructive", title: "Error al descargar", description: error.message });
        }
    };

    const handlePreview = async (file) => {
        try {
            const { data, error } = await supabase.storage
                .from('empleado_documentos')
                .createSignedUrl(file.url, 3600);
            if (error) throw error;
            window.open(data.signedUrl, '_blank');
        } catch (error) {
            toast({ variant: "destructive", title: "Error al previsualizar", description: error.message });
        }
    };

    // --- Render Helpers ---
    const openAction = (e, item, type, action) => {
        e.stopPropagation();
        setSelectedItem(item);
        setItemType(type);
        if (action === 'rename') {
            setInputValue(item.nombre);
            setIsEditOpen(true);
        } else if (action === 'delete') {
            setIsDeleteOpen(true);
        } else if (action === 'move') {
            setMoveTargetId(null);
            setIsMoveOpen(true);
        }
    };

    // --- Empty state si no hay empleadoId ---
    if (!empleadoId) {
        return (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
                <AlertCircle className="w-5 h-5 mr-2" />
                No se ha indicado el empleado.
            </div>
        );
    }

    return (
        <div className="flex min-h-[500px] md:h-[calc(100vh-200px)] border rounded-lg bg-background shadow-sm overflow-hidden">

            {/* Sidebar Tree (oculto en móvil) */}
            <div className="w-64 border-r bg-muted/10 flex-col hidden md:flex">
                <div className="p-3 border-b font-medium text-sm text-muted-foreground flex justify-between items-center">
                    <span>Estructura</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNavigate(null)} title="Ir a Documentos">
                        <Home className="w-3 h-3" />
                    </Button>
                </div>
                <ScrollArea className="flex-1 p-2">
                    <div
                        className={cn(
                            "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm mb-1",
                            currentFolderId === null ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"
                        )}
                        onClick={() => handleNavigate(null)}
                    >
                        <Home className="w-4 h-4" />
                        <span>Documentos</span>
                    </div>
                    {allFolders
                        .filter(f => f.carpeta_padre_id === null)
                        .sort((a, b) => a.nombre.localeCompare(b.nombre))
                        .map(folder => (
                            <FolderTreeItem
                                key={folder.id}
                                folder={folder}
                                currentFolderId={currentFolderId}
                                onSelect={handleNavigate}
                                onToggle={toggleFolderExpand}
                                expandedFolders={expandedFolders}
                                allFolders={allFolders}
                            />
                        ))}
                </ScrollArea>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-card">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 text-sm text-muted-foreground">
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={crumb.id || 'root'}>
                                {i > 0 && <ChevronRight className="w-4 h-4 shrink-0" />}
                                <button
                                    className={cn(
                                        "hover:text-foreground truncate px-1 rounded transition-colors",
                                        i === breadcrumbs.length - 1 && "font-semibold text-foreground pointer-events-none"
                                    )}
                                    onClick={() => handleNavigate(crumb.id)}
                                >
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    {canEdit && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)} className="gap-2 h-8">
                                <Plus className="w-3 h-3" /> <span className="hidden sm:inline">Carpeta</span>
                            </Button>
                            <div className="relative">
                                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} disabled={actionLoading} />
                                <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={actionLoading} className="gap-2 h-8">
                                    {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                                    <span className="hidden sm:inline">Subir</span>
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Grid Content */}
                <ScrollArea className="flex-1 bg-slate-50/50 dark:bg-slate-900/20">
                    <div className="p-4 space-y-6">
                        {loading ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
                            </div>
                        ) : (currentSubfolders.length === 0 && currentFiles.length === 0) ? (
                            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground opacity-60">
                                <Folder className="w-16 h-16 mb-4 stroke-1" />
                                <p>Carpeta vacía</p>
                            </div>
                        ) : (
                            <>
                                {/* Folders Grid */}
                                {currentSubfolders.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                        {currentSubfolders.map(folder => (
                                            <Card
                                                key={folder.id}
                                                className="group hover:border-primary/50 transition-all cursor-pointer shadow-sm relative overflow-hidden"
                                                onClick={() => handleNavigate(folder.id)}
                                            >
                                                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                                                    <Folder className="w-10 h-10 text-blue-500 fill-blue-500/10" />
                                                    <span className="text-xs font-medium truncate w-full" title={folder.nombre}>
                                                        {folder.nombre}
                                                    </span>

                                                    {canEdit && (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <MoreVertical className="w-3 h-3" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuLabel className="text-xs">Acciones</DropdownMenuLabel>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={(e) => openAction(e, folder, 'folder', 'rename')}>
                                                                    <Edit2 className="w-3 h-3 mr-2" /> Renombrar
                                                                </DropdownMenuItem>
                                                                <DropdownMenuItem onClick={(e) => openAction(e, folder, 'folder', 'move')}>
                                                                    <CornerUpRight className="w-3 h-3 mr-2" /> Mover
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onClick={(e) => openAction(e, folder, 'folder', 'delete')} className="text-destructive">
                                                                    <Trash2 className="w-3 h-3 mr-2" /> Eliminar
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* Files List */}
                                {currentFiles.length > 0 && (
                                    <>
                                        {currentSubfolders.length > 0 && <div className="border-t my-4" />}
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {currentFiles.map(file => (
                                                <Card
                                                    key={file.id}
                                                    className="group hover:border-primary/50 transition-all shadow-sm relative overflow-hidden"
                                                >
                                                    <CardContent className="p-3 flex items-center gap-3">
                                                        <div className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded-lg shrink-0">
                                                            {getFileIcon(file.mime_type)}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate" title={file.nombre}>
                                                                {file.nombre}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground">
                                                                {formatBytes(file.size)} · {file.created_at ? new Date(file.created_at).toLocaleDateString() : ''}
                                                            </p>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handlePreview(file)}
                                                                title="Ver"
                                                            >
                                                                <FileText className="w-4 h-4 text-muted-foreground" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => handleDownload(file)}
                                                                title="Descargar"
                                                            >
                                                                <Download className="w-4 h-4 text-muted-foreground" />
                                                            </Button>
                                                            {canEdit && (
                                                                <DropdownMenu>
                                                                    <DropdownMenuTrigger asChild>
                                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                                            <MoreVertical className="w-3 h-3" />
                                                                        </Button>
                                                                    </DropdownMenuTrigger>
                                                                    <DropdownMenuContent align="end">
                                                                        <DropdownMenuItem onClick={(e) => openAction(e, file, 'file', 'rename')}>
                                                                            <Edit2 className="w-3 h-3 mr-2" /> Renombrar
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuItem onClick={(e) => openAction(e, file, 'file', 'move')}>
                                                                            <Move className="w-3 h-3 mr-2" /> Mover
                                                                        </DropdownMenuItem>
                                                                        <DropdownMenuSeparator />
                                                                        <DropdownMenuItem onClick={(e) => openAction(e, file, 'file', 'delete')} className="text-destructive">
                                                                            <Trash2 className="w-3 h-3 mr-2" /> Eliminar
                                                                        </DropdownMenuItem>
                                                                    </DropdownMenuContent>
                                                                </DropdownMenu>
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* --- Modals --- */}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Nueva Carpeta</DialogTitle></DialogHeader>
                    <Input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="Nombre de la carpeta..." autoFocus />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCreateFolder} disabled={actionLoading || !inputValue.trim()}>Crear</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Renombrar</DialogTitle></DialogHeader>
                    <Input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="Nuevo nombre..." autoFocus />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
                        <Button onClick={handleRename} disabled={actionLoading || !inputValue.trim()}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Esta acción no se puede deshacer. Se eliminará "{selectedItem?.nombre}".
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Eliminar</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Mover "{selectedItem?.nombre}" a...</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-64 border rounded-md p-2">
                        <div
                            className={cn(
                                "flex items-center gap-2 p-2 rounded-md cursor-pointer mb-1",
                                moveTargetId === null ? "bg-primary/10 text-primary" : "hover:bg-muted"
                            )}
                            onClick={() => setMoveTargetId(null)}
                        >
                            <Home className="w-4 h-4" /> <span>Documentos (raíz)</span>
                        </div>
                        {allFolders
                            .filter(f => f.carpeta_padre_id === null)
                            .map(folder => (
                                <FolderTreeItem
                                    key={folder.id}
                                    folder={folder}
                                    currentFolderId={moveTargetId}
                                    onSelect={setMoveTargetId}
                                    onToggle={toggleFolderExpand}
                                    expandedFolders={expandedFolders}
                                    allFolders={allFolders}
                                />
                            ))
                        }
                    </ScrollArea>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMoveOpen(false)}>Cancelar</Button>
                        <Button onClick={handleMove} disabled={actionLoading || (itemType === 'folder' && selectedItem?.id === moveTargetId)}>Mover Aquí</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
