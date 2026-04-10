import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, CheckCircle2, User, Clock, FileText, MessageSquare, Loader2, ArrowRight, Camera, X, ImageIcon, UploadCloud } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

export default function AvisoActivityLog({ avisoId }) {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null); // NUEVO: Estado para el archivo
    const fileInputRef = useRef(null); // NUEVO: Referencia para el input de archivo

    useEffect(() => {
        const fetchEmployeeId = async () => {
            if (!user) return;
            const { data } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
            if (data) setCurrentEmployeeId(data.id);
        };
        fetchEmployeeId();
    }, [user]);

    const fetchTimeline = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('avisos_comentarios')
                .select(`*, empleados:usuario_id(id, nombre, apellidos)`)
                .eq('aviso_id', avisoId)
                .order('fecha_creacion', { ascending: false }); // DESCENDENTE (Lo nuevo arriba)

            if (error) throw error;
            setItems(data || []);
        } catch (error) { console.error(error); } finally { setLoading(false); }
    };

    useEffect(() => {
        if (!avisoId) return;
        fetchTimeline();
        const channel = supabase.channel(`activity-log-${avisoId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos_comentarios', filter: `aviso_id=eq.${avisoId}` }, fetchTimeline).subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [avisoId]);

    // MANEJO DE ARCHIVOS
    const handleFileSelect = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            alert("✅ Archivo seleccionado: " + file.name); // Alerta para la prueba
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClearFile = () => {
        setSelectedFile(null);
    };

    const handleSendMessage = async (e) => {
        if (e) e.preventDefault();
        
        // La validación ahora debe incluir el archivo
        if ((!newMessage.trim() && !selectedFile) || !currentEmployeeId) return;

        setSending(true);
        try {
            let fileUrl = null;
            
            // 1. Subir archivo si existe
            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop();
                const fileName = `avisos/${avisoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                const { error: uploadError } = await supabase.storage
                    .from('avisos-files')
                    .upload(fileName, selectedFile);

                if (uploadError) throw uploadError;

                const { data: urlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
                fileUrl = urlData.publicUrl;

                // Insertar en avisos_archivos (Tabla de seguimiento de archivos)
                await supabase.from('avisos_archivos').insert({
                    aviso_id: avisoId,
                    archivo_url: fileUrl,
                    nombre_archivo: selectedFile.name,
                    tipo_archivo: selectedFile.type,
                    subido_por: currentEmployeeId
                });

                // Insertar el comentario de archivo en la bitácora
                const fileContent = JSON.stringify({
                    url: fileUrl,
                    name: selectedFile.name,
                    type: selectedFile.type,
                    comment: newMessage.trim() || null
                });
                
                await supabase.from('avisos_comentarios').insert({
                    aviso_id: avisoId,
                    usuario_id: currentEmployeeId,
                    contenido: fileContent,
                    tipo: 'archivo',
                    fecha_creacion: new Date().toISOString()
                });
            }

            // 2. Insertar comentario de texto si NO hay archivo o si solo es texto
            if (newMessage.trim() && !selectedFile) {
                await supabase.from('avisos_comentarios').insert({
                    aviso_id: avisoId,
                    usuario_id: currentEmployeeId,
                    contenido: newMessage.trim(),
                    tipo: 'comentario',
                    fecha_creacion: new Date().toISOString()
                });
            }

            setNewMessage('');
            setSelectedFile(null); 
            fetchTimeline();
            toast({ description: "Actualización enviada." });

        } catch (error) { 
            console.error('Error enviando actualización:', error);
            toast({ title: "Error", description: "No se pudo enviar la actualización.", variant: "destructive" }); 
        } finally { 
            setSending(false); 
        }
    };

    const renderActivityItem = (item, index) => {
        const isLast = index === items.length - 1;
        const isSystem = item.tipo && item.tipo !== 'comentario' && item.tipo !== 'archivo';
        
        let icon = <MessageSquare className="w-4 h-4 text-gray-500" />;
        let colorClass = "bg-gray-100 border-gray-200";

        if (item.tipo === 'cambio_estado') { icon = <CheckCircle2 className="w-4 h-4 text-green-600" />; colorClass = "bg-green-100 border-green-200"; }
        if (item.tipo === 'asignacion') { icon = <User className="w-4 h-4 text-blue-600" />; colorClass = "bg-blue-100 border-blue-200"; }
        if (item.tipo === 'archivo') { icon = <FileText className="w-4 h-4 text-orange-600" />; colorClass = "bg-orange-100 border-orange-200"; }

        const authorName = item.empleados ? `${item.empleados.nombre} ${item.empleados.apellidos || ''}` : 'Sistema';
        
        let content = item.contenido;
        let fileData = null;
        let fileComment = null;
        
        if (item.tipo === 'archivo') {
            try { 
                fileData = JSON.parse(item.contenido);
                fileComment = fileData.comment;
                content = `Adjunto: ${fileData.name}`;
            } catch(e){}
        }

        return (
            <div key={item.id} className="relative pl-8 pb-8">
                {/* LÍNEA VERTICAL */}
                {!isLast && <div className="absolute top-8 left-[11px] w-[2px] h-full bg-gray-200/70" />}
                
                {/* ICONO */}
                <div className={cn("absolute top-0 left-0 w-6 h-6 rounded-full border flex items-center justify-center z-10", colorClass)}>
                    {icon}
                </div>

                {/* CONTENIDO */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between">
                        <span className="text-xs font-bold text-gray-900">{isSystem ? 'Sistema' : authorName}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{format(new Date(item.fecha_creacion), "dd MMM HH:mm", { locale: es })}</span>
                    </div>
                    
                    <div className={cn("text-sm text-gray-600 bg-white p-3 border rounded-lg shadow-sm", isSystem ? "italic text-gray-500 bg-gray-50 border-transparent" : "")}>
                        {fileData ? (
                            <div className="space-y-2">
                                {/* Muestra el archivo/foto */}
                                <a href={fileData.url} target="_blank" rel="noreferrer" className="block p-3 border rounded-md bg-muted/50 hover:bg-muted transition-colors">
                                    {fileData.type?.includes('image') ? (
                                        <img src={fileData.url} alt={fileData.name} className="w-full max-h-[300px] object-contain rounded-md" />
                                    ) : (
                                        <div className="flex items-center gap-2 text-sm text-gray-700">
                                            <FileText className="w-5 h-5 text-blue-500 shrink-0" />
                                            <span className="font-medium underline truncate">{fileData.name}</span>
                                        </div>
                                    )}
                                </a>
                                {/* Muestra el comentario adjunto al archivo */}
                                {fileComment && <p className="text-gray-700 whitespace-pre-wrap mt-2">{fileComment}</p>}
                            </div>
                        ) : (
                            content // Muestra el texto normal
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-100">
            {/* INPUT HEADER (Ahora con Botón Adjuntar) */}
            <div className="p-4 border-b bg-gray-50/50">
                <form onSubmit={handleSendMessage} className="space-y-3">
                    
                    {/* INPUT OCULTO REAL */}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleFileSelect} 
                        accept="image/*,application/pdf"
                    />

                    {/* PREVIEW DE ARCHIVO */}
                    {selectedFile && (
                        <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg text-sm animate-in fade-in">
                            <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                                <span className="font-medium truncate">{selectedFile.name}</span>
                                <span className="text-xs text-blue-400">({(selectedFile.size / 1024).toFixed(0)} KB)</span>
                            </div>
                            <button type="button" onClick={handleClearFile} className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    
                    {/* TEXTAREA Y BOTONES DE ACCIÓN */}
                    <div className="flex items-end gap-2">
                        <Textarea 
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder={selectedFile ? "Añadir comentario sobre el archivo (opcional)..." : "Añadir nota a la bitácora..."}
                            className="min-h-[60px] resize-none text-sm bg-white focus-visible:ring-1 focus-visible:ring-primary/50 flex-1"
                            disabled={!currentEmployeeId || sending}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                }
                            }}
                        />

                        <div className="flex flex-col gap-2 shrink-0">
                            {/* BOTÓN PARA ABRIR EL SELECTOR DE ARCHIVOS */}
                            <Button 
                                type="button" 
                                size="icon"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending || !currentEmployeeId || selectedFile}
                                className="h-10 w-10 border-dashed border-gray-300 hover:border-primary transition-colors"
                            >
                                <Camera className="w-5 h-5" />
                            </Button>
                            
                            {/* BOTÓN DE ENVIAR */}
                            <Button type="submit" size="icon" disabled={(!newMessage.trim() && !selectedFile) || sending || !currentEmployeeId} className="h-10 w-10 bg-slate-900 text-white hover:bg-slate-800">
                                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                        </div>
                    </div>
                    {!currentEmployeeId && <p className="text-[10px] text-red-500 mt-1">Solo lectura.</p>}
                </form>
            </div>

            {/* TIMELINE */}
            <ScrollArea className="flex-1 p-6">
                {items.length === 0 ? (
                    <div className="text-center py-10 text-gray-300 italic">Bitácora vacía</div>
                ) : (
                    <div className="mt-2">
                        {items.map(renderActivityItem)}
                    </div>
                )}
            </ScrollArea>
        </div>
    );
}