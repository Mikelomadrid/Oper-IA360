import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
    Send, CheckCircle2, User, FileText, MessageSquare, 
    Loader2, Camera, X, HardHat, Download, AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

// Sub-component for rendering individual activity items with secure image handling
const ActivityItem = ({ item, index, totalItems, currentEmployee }) => {
    const isLast = index === totalItems - 1;
    const isSystem = item.tipo && item.tipo !== 'comentario' && item.tipo !== 'archivo';
    const isTechnician = item.usuario?.rol === 'tecnico';
    
    let icon = <MessageSquare className="w-4 h-4 text-gray-500" />;
    let colorClass = "bg-gray-100 border-gray-200";

    if (item.tipo === 'cambio_estado') { icon = <CheckCircle2 className="w-4 h-4 text-green-600" />; colorClass = "bg-green-100 border-green-200"; }
    if (item.tipo === 'archivo') { icon = <FileText className="w-4 h-4 text-orange-600" />; colorClass = "bg-orange-100 border-orange-200"; }

    const authorName = item.usuario ? `${item.usuario.nombre} ${item.usuario.apellidos || ''}` : 'Sistema';
    
    let content = item.contenido;
    
    // 1. Memoize fileData parsing to prevent unnecessary re-renders
    const fileData = useMemo(() => {
        if (item.tipo === 'archivo') {
            try { 
                return JSON.parse(item.contenido);
            } catch(e){
                // Backward compatibility
                if (item.contenido.includes('::')) {
                    const parts = item.contenido.split('::');
                    return { name: parts[0], path: parts[1] || parts[0] }; 
                }
                return { name: "Error de Archivo", url: "#" };
            }
        }
        return null;
    }, [item.contenido, item.tipo]);

    const [signedUrl, setSignedUrl] = useState(null);
    const [imageError, setImageError] = useState(false);
    
    // 2. Effect to generate signed URL securely
    useEffect(() => {
        let isMounted = true;
        setSignedUrl(null); 
        setImageError(false); 
        
        const getUrl = async () => {
            if (!fileData) return;

            // Determine the correct storage path
            let storagePath = fileData.path;
            
            // FIX: If path is missing but we have a public URL pointing to our private bucket,
            // extract the path to generate a signed URL.
            if (!storagePath && fileData.url && fileData.url.includes('/partes-data/')) {
                try {
                    // URL format: .../storage/v1/object/public/partes-data/FOLDER/FILE
                    const parts = fileData.url.split('/partes-data/');
                    if (parts.length > 1) {
                        storagePath = parts[1];
                    }
                } catch (e) {
                    console.warn("Could not extract path from URL:", fileData.url);
                }
            }

            if (storagePath) {
                // Use Signed URL for private bucket access
                const { data, error } = await supabase.storage
                    .from('partes-data')
                    .createSignedUrl(storagePath, 3600); // 1 hour validity
                
                if (error) {
                    console.error('Error generating signed URL:', error);
                    // Fallback to legacy/public URL if signing fails
                    if (fileData.url && isMounted) setSignedUrl(fileData.url);
                } else if (isMounted && data?.signedUrl) {
                    setSignedUrl(data.signedUrl);
                }
            } 
            // Legacy case: External URL or truly public resource
            else if (fileData.url) {
                if (isMounted) setSignedUrl(fileData.url);
            }
        };

        getUrl();
        return () => { isMounted = false; };
    }, [fileData]); 

    const fileComment = fileData?.comment;

    return (
        <div className="relative pl-8 pb-8">
            {/* LÍNEA VERTICAL */}
            {!isLast && <div className="absolute top-8 left-[11px] w-[2px] h-full bg-gray-200/70 dark:bg-border" />}
            
            {/* ICONO */}
            <div className={cn("absolute top-0 left-0 w-6 h-6 rounded-full border flex items-center justify-center z-10", colorClass)}>
                {icon}
            </div>

            {/* CONTENIDO */}
            <div className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-foreground flex items-center gap-1">
                        {isTechnician && <HardHat className="w-3 h-3 text-primary" />}
                        {isSystem ? 'Sistema' : authorName}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">{format(new Date(item.fecha_creacion), "dd MMM HH:mm", { locale: es })}</span>
                </div>
                
                <div className={cn("text-sm text-gray-600 bg-white p-3 border rounded-lg shadow-sm dark:bg-card dark:text-muted-foreground", isSystem ? "italic text-gray-500 bg-gray-50 border-transparent dark:bg-muted dark:text-muted-foreground" : "")}>
                    {fileData ? (
                        <div className="space-y-2">
                            {/* Visualización del Archivo/Imagen */}
                            {signedUrl ? (
                                <div>
                                    {/* 
                                        Si es imagen y NO ha dado error de carga, la mostramos.
                                        Si da error (onError), cambiamos a vista de enlace de descarga.
                                    */}
                                    {(fileData.type?.startsWith('image/') || fileData.name.match(/\.(jpg|jpeg|png|gif|webp)$/i)) && !imageError ? (
                                        <div className="relative group inline-block max-w-full">
                                            <img 
                                                src={signedUrl} 
                                                alt={fileData.name} 
                                                className="w-full max-h-[300px] object-contain rounded-md bg-gray-100 border dark:bg-background dark:border-border"
                                                onError={(e) => {
                                                    console.error("Image load failed for URL:", signedUrl);
                                                    setImageError(true); // Switch to fallback UI
                                                }}
                                            />
                                            <a 
                                                href={signedUrl} 
                                                target="_blank" 
                                                rel="noreferrer" 
                                                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity" 
                                                title="Descargar imagen original"
                                            >
                                                <Download className="w-4 h-4" />
                                            </a>
                                        </div>
                                    ) : (
                                        /* Vista de Archivo Genérico o Fallback de Imagen Rota */
                                        <a href={signedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 border rounded-md bg-muted/30 hover:bg-muted transition-colors group">
                                            <div className={cn("p-2 rounded-full border", imageError ? "bg-red-50 text-red-500 border-red-200" : "bg-blue-50 text-blue-600 border-blue-200")}>
                                                {imageError ? <AlertCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium truncate text-foreground">{fileData.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {imageError ? 'No se pudo previsualizar. Clic para descargar.' : 'Clic para abrir archivo adjunto'}
                                                </p>
                                            </div>
                                            <Download className="w-4 h-4 text-muted-foreground group-hover:text-foreground" />
                                        </a>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-400 italic p-2 border rounded-md bg-gray-50 dark:bg-muted dark:border-border">
                                    <Loader2 className="w-4 h-4 animate-spin" /> Cargando adjunto...
                                </div>
                            )}
                            
                            {/* Comentario del archivo */}
                            {fileComment && <p className="text-gray-700 dark:text-muted-foreground whitespace-pre-wrap mt-2 border-l-2 border-gray-200 pl-2 dark:border-border">{fileComment}</p>}
                        </div>
                    ) : (
                        content
                    )}
                </div>
            </div>
        </div>
    );
};

export default function ParteActivityLog({ parteId, onStatusChange, currentStatus }) {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [currentEmployee, setCurrentEmployee] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null); 
    const fileInputRef = useRef(null); 

    // 1. OBTENER ID Y ROL DEL USUARIO ACTUAL
    useEffect(() => {
        const fetchEmployeeData = async () => {
            if (!user) return;
            const { data } = await supabase.from('empleados').select('id, nombre, apellidos, rol').eq('auth_user_id', user.id).single();
            if (data) setCurrentEmployee(data);
        };
        fetchEmployeeData();
    }, [user]);

    // 2. OBTENER LA CRONOLOGÍA (BITÁCORA) - Memoized
    const fetchTimeline = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('partes_actividad')
                // FIX: Use explicit FK relationship to resolve ambiguity
                .select(`*, usuario:empleados!partes_actividad_usuario_id_fkey(id, nombre, apellidos, rol)`)
                .eq('parte_id', parteId)
                .order('fecha_creacion', { ascending: false }); 

            if (error) throw error;
            setItems(data || []);
        } catch (error) { 
            console.error('Error fetching timeline:', error);
        } finally { 
            setLoading(false); 
        }
    }, [parteId]);

    // 3. SUSCRIPCIÓN EN TIEMPO REAL
    useEffect(() => {
        if (!parteId) return;
        fetchTimeline();
        const channel = supabase.channel(`partes-activity-log-${parteId}`)
            .on(
                'postgres_changes', 
                { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'partes_actividad', 
                    filter: `parte_id=eq.${parteId}` 
                }, 
                fetchTimeline
            ).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [parteId, fetchTimeline]);

    // MANEJO DE ARCHIVOS
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            toast({ description: "✅ Archivo seleccionado: " + file.name });
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClearFile = () => {
        setSelectedFile(null);
    };

    // 4. LÓGICA DE ENVÍO DE COMENTARIO/ARCHIVO
    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        
        if ((!newMessage.trim() && !selectedFile) || !currentEmployee) {
            toast({ description: "Escribe un mensaje o adjunta un archivo.", variant: "warning" });
            return;
        }

        setSending(true);
        try {
            let activityContent = newMessage.trim();
            let activityType = 'comentario';

            // A. Subir archivo si existe
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                // Subimos a bucket privado 'partes-data'
                const filePath = `archivos/${parteId}/${fileName}`;
                
                // 1. Subir a Supabase Storage (Bucket: partes-data)
                const { error: uploadError } = await supabase.storage
                    .from('partes-data')
                    .upload(filePath, selectedFile, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) {
                    throw new Error(`Error subiendo archivo: ${uploadError.message}`);
                }

                // 2. Registrar en la tabla de archivos (partes_archivos)
                await supabase.from('partes_archivos').insert({
                    parte_id: parteId,
                    archivo_url: filePath, // Store path for private buckets
                    nombre_archivo: selectedFile.name,
                    tipo_archivo: selectedFile.type,
                    subido_por: currentEmployee.id
                });

                // 3. Preparar el JSON para la tabla de actividad (partes_actividad)
                activityContent = JSON.stringify({
                    path: filePath, // Path relative to bucket root
                    name: selectedFile.name,
                    type: selectedFile.type,
                    comment: newMessage.trim() || null
                });
                activityType = 'archivo';

                // 4. AUTOMATIZACIÓN DE ESTADO (Factura/Presupuesto)
                const lowerName = selectedFile.name.toLowerCase();
                let newStatus = null;
                if (lowerName.includes('factura')) {
                    newStatus = 'facturado';
                } else if (lowerName.includes('presupuesto')) {
                    newStatus = 'presupuestado';
                }

                // Si hay un nuevo estado detectado y es diferente al actual
                if (newStatus && newStatus !== currentStatus) {
                    const { error: statusError } = await supabase
                        .from('partes')
                        .update({ estado: newStatus })
                        .eq('id', parteId);

                    if (!statusError) {
                        // Insertar log de cambio de estado
                        await supabase.from('partes_actividad').insert({
                            parte_id: parteId,
                            usuario_id: currentEmployee.id,
                            contenido: `Estado actualizado automáticamente a ${newStatus.toUpperCase()} por archivo adjunto.`,
                            tipo: 'cambio_estado',
                            fecha_creacion: new Date().toISOString()
                        });
                        
                        // Notificar al padre para que refresque
                        if (onStatusChange) onStatusChange();
                        
                        toast({
                            title: "Estado Actualizado",
                            description: `El parte ha pasado a estado: ${newStatus}`,
                            className: "bg-green-50 border-green-200 text-green-800"
                        });
                    } else {
                        console.error("Error actualizando estado:", statusError);
                    }
                }
            }

            // B. Insertar en la tabla de actividad (partes_actividad) el mensaje o archivo
            if (activityContent) {
                await supabase.from('partes_actividad').insert({
                    parte_id: parteId,
                    usuario_id: currentEmployee.id,
                    contenido: activityContent,
                    tipo: activityType,
                    fecha_creacion: new Date().toISOString()
                });
            }

            setNewMessage('');
            setSelectedFile(null); 
            toast({ description: "Actualización enviada correctamente." });

        } catch (error) { 
            console.error('Error enviando actualización:', error);
            toast({ 
                title: "Error de Subida", 
                description: `No se pudo enviar la actualización. Detalle: ${error.message || 'Error desconocido'}`, 
                variant: "destructive" 
            }); 
        } finally { 
            setSending(false); 
        }
    };
    
    const canWrite = currentEmployee && ['admin', 'encargado', 'tecnico', 'finca_admin'].includes(currentEmployee.rol);

    return (
        <div className="flex flex-col h-full bg-card border-l border-border">
            <div className="p-4 border-b bg-card">
                <form onSubmit={handleSendMessage} className="space-y-3">
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect} 
                        accept="image/*,application/pdf"
                        capture="camera"
                    />

                    {selectedFile && (
                        <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm animate-in fade-in dark:bg-blue-900/50 dark:border-blue-700">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="w-4 h-4 text-blue-600 dark:text-blue-300 shrink-0" />
                                <span className="font-medium truncate text-foreground">{selectedFile.name}</span>
                                <span className="text-xs text-blue-400 dark:text-blue-500">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button type="button" onClick={handleClearFile} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    <div className="flex items-end gap-2">
                        <Textarea 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={selectedFile ? "Añadir comentario sobre el archivo (opcional)..." : "Añadir nota o adjunto a la bitácora..."}
                            className="min-h-[60px] resize-none text-sm bg-background focus-visible:ring-1 focus-visible:ring-primary/50 flex-1 dark:bg-background dark:text-foreground dark:border-input"
                            disabled={!canWrite || sending}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && (newMessage.trim() || selectedFile)) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />

                        <div className="flex flex-col gap-2 shrink-0">
                            <Button 
                                type="button" 
                                size="icon"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending || !canWrite || selectedFile}
                                className="h-10 w-10 border-dashed border-gray-300 hover:border-primary transition-colors dark:border-border dark:hover:border-primary"
                            >
                                <Camera className="w-5 h-5" />
                            </Button>
                            
                            <Button 
                                type="submit" 
                                size="icon" 
                                disabled={(!newMessage.trim() && !selectedFile) || sending || !canWrite} 
                                className="h-10 w-10 bg-slate-900 text-white hover:bg-slate-800"
                            >
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                    {!canWrite && <p className="text-[10px] text-red-500 mt-1 dark:text-red-400">Solo lectura: Tu rol no permite escribir en la bitácora.</p>}
                </form>
            </div>

            <ScrollArea className="flex-1 p-6">
                {loading ? (
                    <div className="flex justify-center items-center h-32 text-gray-400">
                        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Cargando bitácora...
                    </div>
                ) : items.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 italic">Bitácora vacía. Empieza una conversación o añade un adjunto.</div>
                ) : (
                    <div className="mt-2">
                        {items.map((item, idx) => (
                            <ActivityItem 
                                key={item.id} 
                                item={item} 
                                index={idx} 
                                totalItems={items.length}
                                currentEmployee={currentEmployee}
                            />
                        ))}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}