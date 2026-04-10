import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { Folder, FileText, Edit2, Trash2, Plus, Loader2, Upload, ArrowLeft, Home, ChevronRight, Download, Image as ImageIcon, File, Video, User, ChevronDown, Move, CornerUpRight, MoreVertical, AlertCircle } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import AsyncImage from '@/components/AsyncImage';
import { Dialog as RadixDialog, DialogContent as RadixDialogContent } from "@/components/ui/dialog";
import { X, Maximize2 } from 'lucide-react';

// --- Galería con navegación entre fotos ---
const GaleriaNavegable = ({ previewOpen, fotos, onClose, onDownload, onDownloadBulk, formatCreatorName }) => {
    const [idx, setIdx] = useState(0);
    const [zoomed, setZoomed] = useState(false);
    const [seleccionadas, setSeleccionadas] = useState(new Set());
    const [modoSeleccion, setModoSeleccion] = useState(false);

    useEffect(() => {
        if (!previewOpen || !fotos.length) return;
        const i = fotos.findIndex(f => f.id === previewOpen.id);
        setIdx(i >= 0 ? i : 0);
        setZoomed(false);
        setModoSeleccion(false);
        setSeleccionadas(new Set());
    }, [previewOpen, fotos]);

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'ArrowRight') { setIdx(i => Math.min(i + 1, fotos.length - 1)); setZoomed(false); }
            if (e.key === 'ArrowLeft') { setIdx(i => Math.max(i - 1, 0)); setZoomed(false); }
            if (e.key === 'Escape') zoomed ? setZoomed(false) : onClose();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [fotos.length, onClose, zoomed]);

    const foto = fotos[idx];
    if (!foto) return null;

    const formatStamp = (f) => {
        const nombre = formatCreatorName(f.creator) || 'Desconocido';
        if (!f.created_at) return nombre;
        const d = new Date(f.created_at);
        const hora = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        const fecha = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
        return `${hora} · ${fecha} · ${nombre}`;
    };

    const toggleSeleccion = (fotoId) => {
        setSeleccionadas(prev => {
            const next = new Set(prev);
            if (next.has(fotoId)) next.delete(fotoId);
            else next.add(fotoId);
            return next;
        });
    };

    const toggleTodas = () => {
        if (seleccionadas.size === fotos.length) {
            setSeleccionadas(new Set());
        } else {
            setSeleccionadas(new Set(fotos.map(f => f.id)));
        }
    };

    return (
        <div className="relative w-full flex flex-col" style={{ height: '100vh', background: 'rgba(0,0,0,0.95)' }}>

            {/* Barra superior: modo selección */}
            <div className="shrink-0 flex items-center justify-between px-4 py-2 bg-black/60 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setModoSeleccion(m => !m); setSeleccionadas(new Set()); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${modoSeleccion ? 'bg-purple-600 text-white border-purple-500' : 'bg-white/10 text-white border-white/20 hover:bg-white/20'}`}
                    >
                        {modoSeleccion ? `Seleccionando (${seleccionadas.size})` : 'Seleccionar'}
                    </button>
                    {modoSeleccion && (
                        <>
                            <button onClick={toggleTodas} className="text-xs text-white/60 hover:text-white transition-colors">
                                {seleccionadas.size === fotos.length ? 'Deseleccionar todas' : 'Seleccionar todas'}
                            </button>
                            {seleccionadas.size > 0 && (
                                <button
                                    onClick={() => onDownloadBulk(fotos.filter(f => seleccionadas.has(f.id)))}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-all"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Descargar {seleccionadas.size} foto{seleccionadas.size > 1 ? 's' : ''}
                                </button>
                            )}
                        </>
                    )}
                </div>
                <span className="text-white/40 text-xs">{fotos.length} fotos</span>
            </div>

            {/* Vista: galería en modo selección o foto individual */}
            {modoSeleccion ? (
                <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
                    <div className="grid grid-cols-3 gap-3">
                        {fotos.map((f, i) => (
                            <div
                                key={f.id}
                                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${seleccionadas.has(f.id) ? 'border-purple-500 ring-2 ring-purple-400' : 'border-transparent'}`}
                                onClick={() => toggleSeleccion(f.id)}
                                style={{ aspectRatio: '1' }}
                            >
                                <AsyncImage
                                    path={f.url}
                                    alt={f.nombre}
                                    className="w-full h-full object-cover"
                                />
                                {/* Checkbox */}
                                <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${seleccionadas.has(f.id) ? 'bg-purple-600 border-purple-600' : 'bg-black/40 border-white/60'}`}>
                                    {seleccionadas.has(f.id) && <span className="text-white text-xs font-bold">✓</span>}
                                </div>
                                {/* Stamp */}
                                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                                    <p className="text-white text-[10px] truncate">{formatCreatorName(f.creator)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* Zona de la foto individual */}
                    <div
                        className="flex-1 flex items-center justify-center overflow-hidden"
                        style={{ cursor: zoomed ? 'zoom-out' : 'zoom-in', minHeight: 0, padding: zoomed ? 0 : '12px' }}
                        onClick={() => setZoomed(z => !z)}
                    >
                        <AsyncImage
                            path={foto.url}
                            alt={foto.nombre}
                            style={{
                                maxWidth: '100%',
                                maxHeight: 'calc(100vh - 140px)',
                                width: 'auto',
                                height: 'auto',
                                objectFit: 'contain',
                                display: 'block',
                            }}
                        />
                        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/40 text-xs pointer-events-none">
                            {zoomed ? 'Click para reducir · Esc para cerrar' : 'Click para ampliar'}
                        </div>
                    </div>

                    {/* Flechas navegación */}
                    {idx > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIdx(i => i - 1); setZoomed(false); }}
                            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-[100]"
                        >
                            <ChevronRight className="w-6 h-6 rotate-180" />
                        </button>
                    )}
                    {idx < fotos.length - 1 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setIdx(i => i + 1); setZoomed(false); }}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-[100]"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    )}
                </>
            )}

            {/* Stamp + info inferior */}
            {!modoSeleccion && (
                <div className="shrink-0 bg-black/60 backdrop-blur-md px-6 py-3 flex justify-between items-center text-white">
                    <div>
                        <p className="font-bold text-sm">{foto.nombre}</p>
                        <p className="text-xs opacity-60">{formatStamp(foto)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs opacity-40">{idx + 1} / {fotos.length}</span>
                        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); onDownload(foto); }}>
                            <Download className="w-4 h-4 mr-2" /> Descargar
                        </Button>
                    </div>
                </div>
            )}

            {/* Botón flotante de descarga bulk — fixed para que sea siempre visible */}
            {modoSeleccion && seleccionadas.size > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999]">
                    <button
                        onClick={() => onDownloadBulk(fotos.filter(f => seleccionadas.has(f.id)))}
                        className="flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold bg-green-500 hover:bg-green-600 text-white shadow-2xl transition-all"
                    >
                        <Download className="w-5 h-5" />
                        Descargar {seleccionadas.size} foto{seleccionadas.size > 1 ? 's' : ''}
                    </button>
                </div>
            )}

            {/* Cerrar */}
            <button
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                className="absolute top-12 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors z-[100]"
            >
                <X className="w-6 h-6" />
            </button>
        </div>
    );
};

// --- Utility Helpers ---
const getFileIcon = (mimeType) => {
    if (mimeType?.startsWith('image/')) return <ImageIcon className="w-6 h-6 text-purple-500" />;
    if (mimeType === 'application/pdf') return <FileText className="w-6 h-6 text-red-500" />;
    if (mimeType?.startsWith('video/')) return <Video className="w-6 h-6 text-blue-500" />;
    return <File className="w-6 h-6 text-gray-500" />;
};

const formatCreatorName = (creator) => {
    if (!creator) return 'Desconocido';
    return `${creator.nombre} ${creator.apellidos || ''}`.trim();
};

// --- Sub-components ---

const FolderTreeItem = ({ folder, level = 0, currentFolderId, onSelect, onToggle, expandedFolders, allFolders, onDrop }) => {
    const [isOver, setIsOver] = useState(false);
    const isExpanded = expandedFolders.has(folder.id);
    const hasChildren = allFolders.some(f => f.carpeta_padre_id === folder.id);
    const isSelected = currentFolderId === folder.id;

    return (
        <div className="select-none">
            <div
                className={cn(
                    "flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors text-sm",
                    isSelected ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground",
                    isOver && "bg-primary/20 ring-2 ring-primary/50"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => onSelect(folder.id)}
                onDragOver={(e) => {
                    e.preventDefault();
                    setIsOver(true);
                }}
                onDragLeave={() => setIsOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setIsOver(false);
                    onDrop(folder.id);
                }}
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
                                onDrop={onDrop}
                            />
                        ))
                    }
                </div>
            )}
        </div>
    );
};

export default function ProjectFolders({ projectId, canEdit: propCanEdit, tipo = 'docs' }) {
    // Auth
    const { sessionRole, user } = useAuth();
    const userRole = sessionRole?.rol;

    // FIX: Resolve empleadoId correctly from sessionRole (which maps to public.empleados.id)
    // Fallback to null if not found, do NOT use user.id (auth_id) directly for created_by FKs
    const empleadoId = sessionRole?.empleadoId || null;
    const isAuthLoaded = sessionRole?.loaded;

    // Check if user has a valid employee link
    const isLinked = !!empleadoId;

    // Internal permissions logic
    const isAdminOrEncargado = ['admin', 'encargado'].includes(userRole);
    const isTechnician = userRole === 'tecnico';
    const hasCreatePermission = isAdminOrEncargado || isTechnician || propCanEdit;

    const canManageItem = (item) => {
        if (isAdminOrEncargado) return true;
        if (isTechnician && item.created_by === empleadoId) return true;
        return false;
    };

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

    const [selectedItem, setSelectedItem] = useState(null); // Can be folder or file
    const [itemType, setItemType] = useState(null); // 'folder' or 'file'
    const [moveTargetId, setMoveTargetId] = useState(null);

    const [inputValue, setInputValue] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const fileInputRef = React.useRef(null);

    // Gallery State
    const [previewOpen, setPreviewOpen] = useState(false);
    const [selectedPhoto, setSelectedPhoto] = useState(null);

    // Bulk Selection & DND State
    const [selectedFileIds, setSelectedFileIds] = useState(new Set());
    const [draggedItem, setDraggedItem] = useState(null); // { type: 'file' | 'folder', item: object }
    const [dropTargetId, setDropTargetId] = useState(null); // Folder ID

    const isGalleryMode = tipo === 'foto';

    // --- Data Fetching ---

    const fetchAllData = useCallback(async () => {
        if (!projectId) return;
        setLoading(true);
        try {
            // 1. Fetch All Folders (for Tree)
            const { data: foldersData, error: foldersError } = await supabase
                .from('carpetas')
                .select('*, creator:empleados!created_by(nombre, apellidos)')
                .eq('proyecto_id', projectId)
                .eq('tipo', tipo)
                .order('created_at', { ascending: false });

            if (foldersError) throw foldersError;
            setAllFolders(foldersData || []);

            // 2. Fetch Files (we can fetch all and filter in memory or fetch by folder)
            let fileQuery = supabase
                .from('archivos')
                .select('*, creator:empleados!created_by(nombre, apellidos)')
                .eq('proyecto_id', projectId)
                .eq('tipo', tipo)
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
    }, [projectId, currentFolderId, tipo]);

    useEffect(() => {
        // Reset navigation when type changes
        setCurrentFolderId(null);
        setExpandedFolders(new Set());
    }, [tipo]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // --- Computed ---

    // Parsea nombres de carpeta con formato dd-M-yyyy o dd-MM-yyyy
    const parseFechaCarpeta = (nombre) => {
        if (!nombre) return null;
        const match = nombre.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (match) {
            return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        }
        return null;
    };

    // Filtra carpetas futuras (solo en la raíz) y ordena por fecha desc
    const filtrarYOrdenar = (carpetas, soloRaiz = false) => {
        const hoy = new Date();
        hoy.setHours(23, 59, 59, 999); // hasta el final de hoy
        return [...carpetas]
            .filter(f => {
                if (!soloRaiz) return true; // subcarpetas no se filtran
                const fecha = parseFechaCarpeta(f.nombre);
                if (fecha) return fecha <= hoy; // ocultar fechas futuras
                return true; // no es fecha → siempre mostrar
            })
            .sort((a, b) => {
                const fechaA = parseFechaCarpeta(a.nombre);
                const fechaB = parseFechaCarpeta(b.nombre);
                if (fechaA && fechaB) return fechaB - fechaA; // más reciente primero
                if (fechaA) return -1;
                if (fechaB) return 1;
                return a.nombre.localeCompare(b.nombre);
            });
    };

    const currentSubfolders = useMemo(() => {
        const esRaiz = currentFolderId === null;
        const raw = allFolders.filter(f => f.carpeta_padre_id === currentFolderId);
        return filtrarYOrdenar(raw, esRaiz);
    }, [allFolders, currentFolderId]);

    const breadcrumbs = useMemo(() => {
        const crumbs = [{ id: null, name: 'Inicio' }];
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
        // Auto expand parent
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

    // --- CRUD Operations ---

    const handleCreateFolder = async () => {
        if (!inputValue.trim()) return;

        // Defensive check for employee link
        if (!isLinked) {
            toast({
                variant: "destructive",
                title: "Error de permisos",
                description: "No existe empleado vinculado a este usuario. Contacte con el administrador. Código: 23503"
            });
            return;
        }

        setActionLoading(true);
        try {
            const { error } = await supabase.from('carpetas').insert([{
                proyecto_id: projectId,
                nombre: inputValue.trim(),
                carpeta_padre_id: currentFolderId,
                tipo: tipo,
                created_by: empleadoId // Using the resolved employee ID
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
            const table = itemType === 'folder' ? 'carpetas' : 'archivos';
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
                const { error } = await supabase.from('carpetas').delete().eq('id', selectedItem.id);
                if (error) throw error;
            } else {
                // Delete from Storage first if it belongs to this project
                // Do not delete legacy lead files from storage to avoid breaking the original lead
                if (selectedItem.url && !selectedItem.url.startsWith('lead_')) {
                    const deleteBucket = tipo === 'foto' ? 'proyecto_fotos' : 'proyecto_docs';
                    await supabase.storage.from(deleteBucket).remove([selectedItem.url]);
                }
                const { error } = await supabase.from('archivos').delete().eq('id', selectedItem.id);
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
                    ? "La carpeta no está vacía."
                    : error.message
            });
        } finally {
            setActionLoading(false);
        }
    };

    const handleMove = async () => {
        if (!selectedItem) return;
        // Prevent moving folder into itself or its children (simple check: cannot move to self)
        if (itemType === 'folder' && selectedItem.id === moveTargetId) {
            toast({ variant: "destructive", title: "Error", description: "No puedes mover una carpeta dentro de sí misma." });
            return;
        }

        setActionLoading(true);
        try {
            if (itemType === 'folder') {
                const { error } = await supabase
                    .from('carpetas')
                    .update({ carpeta_padre_id: moveTargetId })
                    .eq('id', selectedItem.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('archivos')
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

        // Defensive check for employee link
        if (!isLinked) {
            toast({
                variant: "destructive",
                title: "Error de permisos",
                description: "No existe empleado vinculado a este usuario. Contacte con el administrador. Código: 23503"
            });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setActionLoading(true);
        try {
            const uploads = Array.from(fileList).map(async (file) => {
                const folderSegment = currentFolderId ? currentFolderId : 'root';
                const sanitizedName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const filePath = `obras/${projectId}/${tipo}/${folderSegment}/${Date.now()}_${sanitizedName}`;
                const uploadBucket = tipo === 'foto' ? 'proyecto_fotos' : 'proyecto_docs';

                const { error: uploadError } = await supabase.storage
                    .from(uploadBucket)
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { error: dbError } = await supabase.from('archivos').insert([{
                    proyecto_id: projectId,
                    carpeta_id: currentFolderId,
                    nombre: file.name,
                    url: filePath,
                    size: file.size,
                    mime_type: file.type,
                    tipo: tipo,
                    created_by: empleadoId // Using the resolved employee ID
                }]);

                if (dbError) throw dbError;
            });

            await Promise.all(uploads);
            toast({ title: "Archivos subidos" });
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
            let bucket = 'proyecto_fotos';
            let cleanPath = file.url;

            if (file.url?.startsWith('lead_fotos://')) {
                bucket = 'lead_fotos';
                cleanPath = file.url.replace('lead_fotos://', '');
            } else if (file.url?.startsWith('lead_docs://')) {
                bucket = 'lead_docs';
                cleanPath = file.url.replace('lead_docs://', '');
            } else if (file.url?.includes('/docs/')) {
                bucket = 'proyecto_docs';
            }

            const { data, error } = await supabase.storage
                .from(bucket)
                .createSignedUrl(cleanPath, 3600);

            if (error) throw error;

            // Fetch como blob para forzar descarga real (evita que el navegador abra la imagen)
            const response = await fetch(data.signedUrl);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = file.nombre || 'foto';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);

        } catch (error) {
            toast({ variant: "destructive", title: "Error al descargar", description: error.message });
        }
    };

    const handleDownloadBulk = async (files) => {
        if (!files || files.length === 0) return;
        toast({ title: `Descargando ${files.length} archivo(s)...`, description: 'Las descargas comenzarán en unos segundos.' });
        for (const file of files) {
            await handleDownload(file);
            await new Promise(r => setTimeout(r, 400)); // pequeña pausa entre descargas
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
            setMoveTargetId(null); // Reset target
            setIsMoveOpen(true);
        }
    };

    const openPreview = (file) => {
        setSelectedPhoto(file);
        setPreviewOpen(file);
    };

    // --- Drag & Drop / Bulk Selection Handlers ---

    const toggleFileSelection = (fileId, e) => {
        e.stopPropagation();
        setSelectedFileIds(prev => {
            const next = new Set(prev);
            if (next.has(fileId)) next.delete(fileId);
            else next.add(fileId);
            return next;
        });
    };

    const handleDragStart = (e, item, type) => {
        // If moving a file that isn't selected, select it as the only item (unless dragging multiple)
        if (type === 'file' && !selectedFileIds.has(item.id)) {
            setSelectedFileIds(new Set([item.id]));
        }
        setDraggedItem({ type, item });
        e.dataTransfer.setData('application/json', JSON.stringify({ type, id: item.id }));
    };

    const handleDropOnFolder = async (folderId) => {
        if (!draggedItem) return;

        const targetFolderId = folderId; // Can be null for root

        // Prevent moving folder into itself
        if (draggedItem.type === 'folder' && draggedItem.item.id === targetFolderId) return;

        setActionLoading(true);
        try {
            if (draggedItem.type === 'folder') {
                const { error } = await supabase
                    .from('carpetas')
                    .update({ carpeta_padre_id: targetFolderId })
                    .eq('id', draggedItem.item.id);
                if (error) throw error;
            } else {
                // Move all selected files
                const fileIdsToMove = selectedFileIds.has(draggedItem.item.id)
                    ? Array.from(selectedFileIds)
                    : [draggedItem.item.id];

                const { error } = await supabase
                    .from('archivos')
                    .update({ carpeta_id: targetFolderId })
                    .in('id', fileIdsToMove);
                if (error) throw error;
            }

            toast({ title: "Movido con éxito" });
            setSelectedFileIds(new Set());
            fetchAllData();
        } catch (error) {
            toast({ variant: "destructive", title: "Error al mover", description: error.message });
        } finally {
            setActionLoading(false);
            setDraggedItem(null);
        }
    };

    return (
        <div className="flex h-[calc(100vh-200px)] min-h-[500px] border rounded-lg bg-background shadow-sm overflow-hidden">

            {/* Sidebar Tree */}
            <div className="w-64 border-r bg-muted/10 flex flex-col hidden md:flex">
                <div className="p-3 border-b font-medium text-sm text-muted-foreground flex justify-between items-center">
                    <span>Estructura</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleNavigate(null)} title="Ir a Raíz">
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
                        <span>Raíz</span>
                    </div>
                    {filtrarYOrdenar(allFolders.filter(f => f.carpeta_padre_id === null), true).map(folder => (
                        <FolderTreeItem
                            key={folder.id}
                            folder={folder}
                            currentFolderId={currentFolderId}
                            onSelect={handleNavigate}
                            onToggle={toggleFolderExpand}
                            expandedFolders={expandedFolders}
                            allFolders={allFolders}
                            onDrop={handleDropOnFolder}
                        />
                    ))}
                </ScrollArea>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Error Banner for Missing Link */}
                {!isLinked && isAuthLoaded && (
                    <div className="p-4 bg-destructive/10 border-b border-destructive/20">
                        <div className="flex items-center gap-2 text-destructive">
                            <AlertCircle className="h-5 w-5" />
                            <span className="font-medium">Error de Vinculación (Código 23503)</span>
                        </div>
                        <p className="text-sm text-destructive/80 mt-1">
                            No existe empleado vinculado a este usuario. Contacte con el administrador para vincular su usuario a la ficha de empleado.
                            No podrá subir archivos ni crear carpetas hasta que se resuelva.
                        </p>
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b bg-card">
                    <div className="flex items-center gap-2 overflow-hidden flex-1 text-sm text-muted-foreground">
                        {breadcrumbs.map((crumb, i) => (
                            <React.Fragment key={crumb.id || 'root'}>
                                {i > 0 && <ChevronRight className="w-4 h-4 shrink-0" />}
                                <button
                                    className={cn(
                                        "hover:text-foreground truncate px-1 rounded transition-colors",
                                        i === breadcrumbs.length - 1 && "font-semibold text-foreground pointer-events-none",
                                        dropTargetId === crumb.id && "bg-primary/20 ring-1 ring-primary"
                                    )}
                                    onClick={() => handleNavigate(crumb.id)}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        setDropTargetId(crumb.id);
                                    }}
                                    onDragLeave={() => setDropTargetId(null)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setDropTargetId(null);
                                        handleDropOnFolder(crumb.id);
                                    }}
                                >
                                    {crumb.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedFileIds.size > 0 && (
                            <div className="flex items-center gap-2 mr-2 animate-in fade-in slide-in-from-right-2">
                                <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                                    {selectedFileIds.size} seleccionados
                                </span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedFileIds(new Set())} className="h-8 text-xs">
                                    Limpiar
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white gap-1"
                                    onClick={() => handleDownloadBulk(currentFiles.filter(f => selectedFileIds.has(f.id)))}
                                    disabled={actionLoading}
                                >
                                    <Download className="w-3 h-3" />
                                    Descargar ({selectedFileIds.size})
                                </Button>
                            </div>
                        )}
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
                    
                                        {/* Debug indicator (invisible but present) */}
                    <div className="sr-only" data-debug-p={propCanEdit} data-debug-h={hasCreatePermission} data-debug-r={userRole} />
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
                                                draggable
                                                onDragStart={(e) => handleDragStart(e, folder, 'folder')}
                                                onDragOver={(e) => {
                                                    e.preventDefault();
                                                    setDropTargetId(folder.id);
                                                }}
                                                onDragLeave={() => setDropTargetId(null)}
                                                onDrop={(e) => {
                                                    e.preventDefault();
                                                    setDropTargetId(null);
                                                    handleDropOnFolder(folder.id);
                                                }}
                                                className={cn(
                                                    "group hover:border-primary/50 transition-all cursor-pointer shadow-sm relative overflow-hidden",
                                                    dropTargetId === folder.id && "bg-primary/10 ring-2 ring-primary border-primary"
                                                )}
                                                onClick={() => handleNavigate(folder.id)}
                                            >
                                                <CardContent className="p-4 flex flex-col items-center text-center gap-2">
                                                    <Folder className="w-10 h-10 text-blue-500 fill-blue-500/10" />
                                                    <span className="text-xs font-medium truncate w-full" title={folder.nombre}>
                                                        {folder.nombre}
                                                    </span>

                                                    {/* Context Menu Trigger */}
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <MoreVertical className="w-3 h-3" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel className="text-xs">Acciones</DropdownMenuLabel>
                                                            <DropdownMenuSeparator />
                                                            {canManageItem(folder) && (
                                                                <>
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
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                )}

                                {/* Files Grid */}
                                {currentFiles.length > 0 && (
                                    <>
                                        {currentSubfolders.length > 0 && <div className="border-t my-4" />}
                                        <div className={cn(
                                            "grid gap-4",
                                            isGalleryMode
                                                ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                                                : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
                                        )}>
                                            {currentFiles.map(file => (
                                                <Card
                                                    key={file.id}
                                                    draggable
                                                    onDragStart={(e) => handleDragStart(e, file, 'file')}
                                                    className={cn(
                                                        "group hover:border-primary/50 transition-all cursor-pointer shadow-sm relative overflow-hidden",
                                                        isGalleryMode ? "aspect-square" : "",
                                                        selectedFileIds.has(file.id) && "ring-2 ring-primary border-primary bg-primary/5"
                                                    )}
                                                    onClick={(e) => {
                                                        if (e.ctrlKey || e.metaKey || e.shiftKey) {
                                                            toggleFileSelection(file.id, e);
                                                        } else {
                                                            isGalleryMode ? openPreview(file) : handleDownload(file);
                                                        }
                                                    }}
                                                >
                                                    {/* Selection Checkbox */}
                                                    <div className={cn(
                                                        "absolute top-2 left-2 z-10 transition-opacity",
                                                        selectedFileIds.has(file.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                    )}>
                                                        <div
                                                            className={cn(
                                                                "w-5 h-5 rounded border bg-white flex items-center justify-center",
                                                                selectedFileIds.has(file.id) ? "border-primary bg-primary" : "border-gray-400"
                                                            )}
                                                            onClick={(e) => toggleFileSelection(file.id, e)}
                                                        >
                                                            {selectedFileIds.has(file.id) && <X className="w-3 h-3 text-white" />}
                                                        </div>
                                                    </div>
                                                    <CardContent className={cn(
                                                        "p-0 flex flex-col items-center justify-center h-full w-full relative",
                                                        !isGalleryMode && "p-4"
                                                    )}>
                                                        {isGalleryMode ? (
                                                            <>
                                                                <AsyncImage
                                                                    path={file.url}
                                                                    alt={file.nombre}
                                                                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                    <Button variant="secondary" size="icon" className="rounded-full h-8 w-8 shadow-lg" onClick={(e) => { e.stopPropagation(); openPreview(file); }}>
                                                                        <Maximize2 className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button variant="secondary" size="icon" className="rounded-full h-8 w-8 shadow-lg" onClick={(e) => { e.stopPropagation(); handleDownload(file); }}>
                                                                        <Download className="w-4 h-4" />
                                                                    </Button>
                                                                </div>
                                                                <div className="absolute bottom-0 inset-x-0 p-2 bg-black/60 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform">
                                                                    <p className="text-[10px] text-white font-medium truncate">{file.nombre}</p>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="w-10 h-10 flex items-center justify-center bg-muted/50 rounded-lg">
                                                                    {getFileIcon(file.mime_type)}
                                                                </div>
                                                                <span className="text-xs font-medium truncate w-full mt-2" title={file.nombre}>
                                                                    {file.nombre}
                                                                </span>
                                                                <span className="text-[10px] text-muted-foreground">
                                                                    {formatCreatorName(file.creator)}
                                                                </span>
                                                            </>
                                                        )}

                                                        {/* Context Menu */}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" size="icon" className={cn(
                                                                    "h-6 w-6 absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity",
                                                                    isGalleryMode ? "bg-black/40 text-white hover:bg-black/60" : "bg-white/50 backdrop-blur-sm"
                                                                )}>
                                                                    <MoreVertical className="w-3 h-3" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleDownload(file)}>
                                                                    <Download className="w-3 h-3 mr-2" /> Descargar
                                                                </DropdownMenuItem>
                                                                {canManageItem(file) && (
                                                                    <>
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
                                                                    </>
                                                                )}
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
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
                    <Input value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="Nombre..." autoFocus />
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
                        <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
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
                            <Home className="w-4 h-4" /> <span>Raíz</span>
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

            {/* Photo Preview Modal — Galería con navegación */}
            <RadixDialog open={!!previewOpen} onOpenChange={() => setPreviewOpen(null)}>
                <RadixDialogContent className="w-screen h-screen max-w-none p-0 bg-black/95 border-none overflow-hidden" style={{ width: '100vw', height: '100vh', maxWidth: '100vw', maxHeight: '100vh', borderRadius: 0 }}>
                    <GaleriaNavegable
                        previewOpen={previewOpen}
                        fotos={currentFiles.filter(f => f.url && !f.url.endsWith('.pdf'))}
                        onClose={() => setPreviewOpen(null)}
                        onDownload={handleDownload}
                        onDownloadBulk={handleDownloadBulk}
                        formatCreatorName={formatCreatorName}
                    />
                </RadixDialogContent>
            </RadixDialog>
        </div>
    );
}