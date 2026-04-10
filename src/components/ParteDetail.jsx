import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { 
    ArrowLeft, Loader2, 
    CheckCircle2, Phone, MapPin, 
    User, HardHat, Image, X, Send, Trash2, PenTool, FileDown,
    Clock, Play, Square, Timer, FileText, Pencil, Package, AlertCircle,
    History, Megaphone, ArchiveRestore, FolderArchive, Wrench,
    Camera, File, Users, CalendarCheck
} from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, 
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import ParteActivityLog from '@/components/ParteActivityLog';
import EditParteModal from '@/components/EditParteModal';
import PartePhotoGallery from '@/components/PartePhotoGallery';
import ParteDocuments from '@/components/ParteDocuments';
import ParteAssignmentManager from '@/components/ParteAssignmentManager';
import ScheduleVisitModal from '@/components/ScheduleVisitModal';

import { fmtMadrid, formatCurrency } from '@/lib/utils';
import html2pdf from 'html2pdf.js';
import { differenceInMinutes } from 'date-fns';
import { getStatusColor, getStatusTextColor, getStatusLabel } from '@/utils/statusColors';
import { mapInternalToUI, mapUIToInternal } from '@/utils/parteEstadoUIMap';

const SignaturePad = ({ onEnd, onClear, canvasRef, title }) => {
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#000000';

        const resizeCanvas = () => {
            const parent = canvas.parentElement;
            if (parent) {
                canvas.width = parent.clientWidth;
                canvas.height = 150; 
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#000000';
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [canvasRef]);

    const getCoordinates = (event) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if (event.touches && event.touches.length > 0) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const startDrawing = (e) => {
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            onEnd && onEnd();
        }
    };

    return (
        <div className="border-2 border-dashed border-gray-300 rounded-lg bg-white dark:bg-card touch-none relative">
            <canvas
                ref={canvasRef}
                className="w-full h-[150px] cursor-crosshair block"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div className="absolute bottom-2 right-2">
                <Button variant="outline" size="sm" onClick={onClear} type="button">
                    Borrar
                </Button>
            </div>
            <div className="absolute top-2 left-2 text-xs text-muted-foreground pointer-events-none select-none">
                {title || 'Área de firma'}
            </div>
        </div>
    );
};

const ParteDetail = ({ navigate, parteId }) => {
    const { user, sessionRole } = useAuth();
    const [parte, setParte] = useState(null);
    const [materials, setMaterials] = useState([]);
    const [sessions, setSessions] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [generatingPdf, setGeneratingPdf] = useState(false);
    
    const [sendingWpp, setSendingWpp] = useState(false);

    const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
    const [isTimeEditModalOpen, setIsTimeEditModalOpen] = useState(false);
    const [timeEditData, setTimeEditData] = useState({ start: '', end: '', sessionId: null }); 

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

    const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const [isTransitionModalOpen, setIsTransitionModalOpen] = useState(false);
    const [transitionType, setTransitionType] = useState(null); 
    const [transitionNote, setTransitionNote] = useState('');

    const [isConvertAlertOpen, setIsConvertAlertOpen] = useState(false);
    const [converting, setConverting] = useState(false);
    const [existingLeadId, setExistingLeadId] = useState(null);

    const [existingFilesCount, setExistingFilesCount] = useState(0);
    const [closureFile, setClosureFile] = useState(null);
    const [parteImages, setParteImages] = useState([]);
    
    const [closureData, setClosureData] = useState({
        descripcion_cierre: '',
        cliente_nombre: '',
    });

    // Tab State
    const [activeTab, setActiveTab] = useState('info');

    const fileInputRef = useRef(null);
    const clienteCanvasRef = useRef(null);
    const tecnicoCanvasRef = useRef(null);
    const isMounted = useRef(false);
    // Added refresh timer ref for debouncing
    const refreshTimerRef = useRef(null);

    const [signedSignatures, setSignedSignatures] = useState({ cliente: null, tecnico: null });

    const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);
    const isAdmin = sessionRole?.rol === 'admin';
    const isFincaAdmin = sessionRole?.rol === 'finca_admin';
    const isTechnician = sessionRole?.rol === 'tecnico';
    const canEditTimes = isAdminOrEncargado || isFincaAdmin;
    const canEdit = isAdminOrEncargado;

   useEffect(() => {
    isMounted.current = true;
    return () => {
        isMounted.current = false;
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
}, []);


    const fetchFilesCount = useCallback(async () => {
        const { count, error } = await supabase
            .from('partes_archivos')
            .select('*', { count: 'exact', head: true })
            .eq('parte_id', parteId);
        
        if (!error && isMounted.current) setExistingFilesCount(count);
    }, [parteId]);

    const checkExistingLead = useCallback(async () => {
        if (!parteId) return;
        
        try {
            const { data: directLink } = await supabase
                .from('leads')
                .select('id')
                .eq('parte_id', parteId)
                .maybeSingle();

            if (directLink && isMounted.current) {
                setExistingLeadId(directLink.id);
                return;
            }

            const { data: legacyLink } = await supabase
                .from('leads')
                .select('id')
                .ilike('comentario', `%Ref: Parte #${parteId}%`)
                .maybeSingle();
            
            if (legacyLink && isMounted.current) {
                setExistingLeadId(legacyLink.id);
            }
        } catch (e) {
            console.error("Error checking existing lead", e);
        }
    }, [parteId]);

    const getSecureUrl = async (pathOrUrl) => {
        if (!pathOrUrl) return null;
        let path = pathOrUrl;
        if (pathOrUrl.includes('/partes-data/')) {
            try {
                path = pathOrUrl.split('/partes-data/')[1];
            } catch (e) { return null; }
        }
        
        if (path) {
            const { data, error } = await supabase.storage.from('partes-data').createSignedUrl(path, 3600);
            if (error) {
                return null; 
            }
            return data?.signedUrl || null; 
        }
        return null;
    };

    const fetchData = useCallback(async () => {
        if (!parte && isMounted.current) setLoading(true);
        
        try {
            await fetchFilesCount();
            await checkExistingLead();
            
            const { data: parteData, error } = await supabase
                .from('partes')
                .select(`
                    *,
                    tecnico:empleados!partes_tecnico_asignado_id_fkey(nombre, apellidos, telefono),
                    creador:empleados!partes_created_by_fkey(nombre, apellidos, rol, telefono),
                    eliminado_por:empleados!partes_deleted_by_fkey(nombre, apellidos)
                `)
                .eq('id', parteId)
                .single();
            
            if (error) throw error;
            if (isMounted.current) {
                setParte(parteData);
                setClosureData(prev => ({ 
                    ...prev, 
                    cliente_nombre: parteData.cliente_nombre || '' 
                }));
            }

            const { data: sessionsData } = await supabase
                .from('partes_sesiones')
                .select('*')
                .eq('parte_id', parteId)
                .order('hora_entrada', { ascending: true });

            if (isMounted.current) setSessions(sessionsData || []);

            const { data: matData } = await supabase
                .from('detalles_solicitud')
                .select(`
                    id,
                    descripcion_personalizada,
                    cantidad_solicitada,
                    unidad,
                    material_id,
                    preparada,
                    header:solicitudes_material!inner (
                        id,
                        fecha_solicitud,
                        estado_solicitud,
                        parte_id,
                        notas
                    ),
                    material_info:materiales (
                        nombre,
                        precio_coste
                    )
                `)
                .eq('header.parte_id', parteId)
                .order('id', { ascending: true });

            if (isMounted.current) {
                setMaterials(matData || []);
            }

            // --- FETCH PHOTOS FOR PDF (UNIFIED SOURCES) ---
            const { data: filesData } = await supabase
                .from('partes_archivos')
                .select('*')
                .eq('parte_id', parteId);

            const { data: activityData } = await supabase
                .from('partes_actividad')
                .select('*')
                .eq('parte_id', parteId)
                .eq('tipo', 'archivo');

            const archivePaths = new Set((filesData || []).map(f => f.archivo_url));
            const mergedImages = [...(filesData || []).map(f => ({...f, origin: 'Galería'}))];

            if (activityData) {
                activityData.forEach(act => {
                    try {
                        const content = JSON.parse(act.contenido);
                        if (content.path && !archivePaths.has(content.path)) {
                            mergedImages.push({
                                id: act.id,
                                archivo_url: content.path,
                                nombre_archivo: content.name || 'Evidencia Cierre',
                                created_at: act.fecha_creacion,
                                tipo_archivo: content.type,
                                origin: 'Cierre',
                                subido_por: act.usuario_id
                            });
                        }
                    } catch(e) {}
                });
            }
            
            mergedImages.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

            const processedFiles = await Promise.all(mergedImages.map(async (file) => {
                const url = await getSecureUrl(file.archivo_url);
                const isImage = file.tipo_archivo?.startsWith('image/') || 
                                file.nombre_archivo?.match(/\.(jpg|jpeg|png|gif|webp)$/i);
                return { ...file, url, isImage };
            }));
            
            if (isMounted.current) {
                setParteImages(processedFiles.filter(f => f.isImage));
            }

            const signatures = { cliente: null, tecnico: null };
            if (parteData.firma_cliente_url) signatures.cliente = await getSecureUrl(parteData.firma_cliente_url);
            if (parteData.firma_tecnico_url) signatures.tecnico = await getSecureUrl(parteData.firma_tecnico_url);
            if (isMounted.current) setSignedSignatures(signatures);

        } catch (error) {
            console.error("Error loading parte detail:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el parte.' });
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [parteId, fetchFilesCount, checkExistingLead]); // 'parte' removed from dependency

    const scheduleFetchData = useCallback(() => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => {
        if (isMounted.current) fetchData();
      }, 400);
    }, [fetchData]);

    useEffect(() => {
        if (parteId) {
            fetchData();

            const channel = supabase.channel(`parte-detail-live-${parteId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'partes', filter: `id=eq.${parteId}` }, (payload) => {
    if (payload.new && isMounted.current) {
      setParte(prev => ({ ...(prev || {}), ...payload.new }));
    }
    scheduleFetchData();
  })
  .on('postgres_changes', { event: '*', schema: 'public', table: 'partes_sesiones', filter: `parte_id=eq.${parteId}` }, () => scheduleFetchData())
  .subscribe();


            return () => {
                supabase.removeChannel(channel);
            };
        }
    }, [parteId, fetchData, scheduleFetchData]);

    const handleNotifyTechnician = async () => {
        if (!parte.tecnico?.telefono) return;
        setSendingWpp(true);
        try {
            const { data, error } = await supabase.functions.invoke('notify-technician', {
                body: {
                    telefono: parte.tecnico.telefono,
                    template_name: 'nuevo_parte_tecnico',
                    parameters: [
                        parte.tecnico.nombre,
                        parte.tecnico.apellidos || '',
                        parte.direccion_servicio,
                        parte.cliente_nombre,
                        parte.descripcion_trabajo ? parte.descripcion_trabajo.substring(0, 60) + '...' : 'Ver detalles'
                    ]
                }
            });
            if (error || data?.error) throw new Error('Error al enviar notificación.');
            toast({ title: '✅ Mensaje Enviado', description: 'Notificación enviada por WhatsApp.' });
        } catch (err) {
            toast({ variant: 'destructive', title: 'Error de Envío', description: 'No se pudo enviar el WhatsApp.' });
        } finally {
            if (isMounted.current) setSendingWpp(false);
        }
    };

    const handleNotifyClientOnClose = async () => {
        const creatorPhone = parte.creador?.telefono || parte.telefono_contacto;
        const recipientName = parte.cliente_nombre || parte.creador?.nombre || 'Cliente';
        if (!creatorPhone) return;

        try {
            await supabase.functions.invoke('notify-technician', {
                body: {
                    telefono: creatorPhone,
                    template_name: 'parte_cerrado_cliente',
                    parameters: [
                        recipientName,
                        parte.custom_id || '#' + parte.id.slice(0, 8),
                        parte.direccion_servicio
                    ]
                }
            });
        } catch (error) {
            console.warn("No se pudo notificar al cliente el cierre.");
        }
    };

    const handleModalFileSelect = (e) => { 
        const file = e.target.files[0];
        if (file) setClosureFile(file);
    };
    const handleClearModalFile = () => setClosureFile(null);
    
    const isCanvasEmpty = (canvasRef) => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const ctx = canvas.getContext('2d');
        const pixelBuffer = new Uint32Array(
            ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
        );
        return !pixelBuffer.some((color) => color !== 0);
    };
    
    const handleClearSignature = (ref) => {
        const canvas = ref.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const handleError = (error) => {
        console.error("Operation Error:", error);
        let msg = error.message || 'Error desconocido';
        if (msg.includes('P0001') || msg.includes('vinculo entre tu usuario y empleado')) {
            msg = "No se ha encontrado vínculo entre tu usuario y empleado. Por favor, contacta con soporte.";
        }
        toast({ variant: 'destructive', title: 'Error', description: msg });
    };

    const handleConvertToLead = async () => {
        setConverting(true);
        try {
            if (existingLeadId) {
                toast({ variant: "destructive", title: "Error", description: "Este parte ya tiene un lead asociado." });
                setIsConvertAlertOpen(false);
                return;
            }

            const leadPayload = {
                nombre_contacto: parte.cliente_nombre || 'Cliente Desconocido',
                telefono: parte.telefono_contacto || 'Sin teléfono', 
                direccion: parte.direccion_servicio,
                estado: 'nuevo',
                origen: 'Parte de Trabajo',
                comentario: `Generado desde Parte #${parte.custom_id || parte.id.substring(0,8)}.\n\nDescripción original:\n${parte.descripcion_trabajo || ''}\n\n[Ref: Parte #${parte.id}]`,
                fecha_creacion: new Date().toISOString(),
                owner_user_id: user.id, 
                parte_id: parteId 
            };

            const { data, error } = await supabase
                .from('leads')
                .insert(leadPayload)
                .select()
                .single();

            if (error) throw error;

            setExistingLeadId(data.id);
            
            await supabase.from('partes_actividad').insert({
                parte_id: parteId,
                usuario_id: sessionRole?.empleadoId,
                contenido: `Parte convertido en Lead (Ref: ${data.id})`,
                tipo: 'cambio_estado',
                fecha_creacion: new Date().toISOString()
            });

            toast({
                title: "Lead Creado Exitosamente",
                description: "Se ha generado un nuevo prospecto a partir de este parte.",
                action: <Button variant="outline" size="sm" onClick={() => navigate(`/crm/leads/${data.id}`)}>Ver Lead</Button>,
                duration: 5000
            });
            
            setIsConvertAlertOpen(false);
        } catch (e) {
            handleError(e);
        } finally {
            if (isMounted.current) setConverting(false);
        }
    };

    const handleCloseParte = async () => {
        const isFileRequired = existingFilesCount === 0 && !closureFile;
        
        if (!closureData.descripcion_cierre.trim()) { toast({ variant: 'destructive', title: 'Error', description: 'La descripción del cierre es obligatoria.' }); return; }
        if (isFileRequired) { toast({ variant: 'destructive', title: 'Evidencia Requerida', description: 'Debes adjuntar al menos un archivo de evidencia final.' }); return; }
        if (isCanvasEmpty(clienteCanvasRef)) { toast({ variant: 'destructive', title: 'Error', description: 'La firma del cliente es obligatoria.' }); return; }
        if (isCanvasEmpty(tecnicoCanvasRef)) { toast({ variant: 'destructive', title: 'Error', description: 'Tu firma como técnico es obligatoria.' }); return; }

        setSaving(true);
        try {
            let fileInfo = null;
            
            if (closureFile) {
                const fileExt = closureFile.name.split('.').pop();
                const filePath = `archivos/${parteId}/final_proof_${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage.from('partes-data').upload(filePath, closureFile);
                if (uploadError) throw new Error(`Error upload: ${uploadError.message}`);
                
                fileInfo = JSON.stringify({
                    path: filePath, name: closureFile.name, type: closureFile.type, comment: 'Evidencia final subida al cerrar el parte.'
                });

                // ALSO Insert into partes_archivos to unify gallery
                await supabase.from('partes_archivos').insert({
                    parte_id: parteId,
                    archivo_url: filePath,
                    nombre_archivo: closureFile.name,
                    tipo_archivo: closureFile.type,
                    subido_por: sessionRole?.empleadoId
                });
            }

            const uploadSignature = async (canvasRef, prefix) => {
                const canvas = canvasRef.current;
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const sigFileName = `firmas/${parteId}/${prefix}_${Date.now()}.png`; 
                const { error: uploadError } = await supabase.storage.from('partes-data').upload(sigFileName, blob, { contentType: 'image/png', upsert: true });
                if (uploadError) throw new Error(`Error firma ${prefix}: ${uploadError.message}`);
                return sigFileName;
            };
            const clienteFirmaPath = await uploadSignature(clienteCanvasRef, 'cliente');
            const tecnicoFirmaPath = await uploadSignature(tecnicoCanvasRef, 'tecnico');

            const { error: rpcError } = await supabase.rpc('api_parte_cerrar', {
                p_parte_id: parteId,
                p_descripcion_cierre: closureData.descripcion_cierre,
                p_cliente_nombre: closureData.cliente_nombre,
                p_firma_cliente: clienteFirmaPath,
                p_firma_tecnico: tecnicoFirmaPath,
                p_evidencia_file: fileInfo ? JSON.parse(fileInfo) : null
            });

            if (rpcError) throw rpcError;

            // Updated status to cerrado, which should map to VISITADO now in UI, but closing implies done?
            // "Cerrar Parte" typically means job done. But user requested 'cerrado' -> 'VISITADO'.
            setParte(prev => ({ ...prev, estado: 'cerrado' })); 

            await handleNotifyClientOnClose();

            toast({ title: 'Parte Cerrado', description: 'El parte ha sido completado y cerrado. PDF disponible.' });
            if (isMounted.current) setIsClosureModalOpen(false);
            fetchData(); 

        } catch (error) {
            handleError(error);
        } finally {
            if (isMounted.current) setSaving(false);
        }
    };

    const handleTransition = async () => {
        if (!transitionType) return;
        setSaving(true);
        try {
            const { error } = await supabase.rpc('api_parte_cambiar_estado', {
                p_parte_id: parteId,
                p_nuevo_estado: transitionType,
                p_nota: transitionNote || null
            });

            if (error) throw error;

            toast({ title: "Estado Actualizado", description: `Parte movido a ${transitionType}.` });
            setIsTransitionModalOpen(false);
            fetchData();
        } catch (error) {
            handleError(error);
        } finally {
            if (isMounted.current) setSaving(false);
        }
    };

    const activeSession = sessions.find(s => !s.hora_salida);

    const handleCheckIn = async () => {
        if (!parteId) return;
        setSaving(true);
        try {
            const { error } = await supabase.rpc('api_parte_sesion', {
                p_parte_id: parteId,
                p_accion: 'entrada'
            });

            if (error) throw error;

            toast({ title: "Entrada Registrada", description: fmtMadrid(new Date(), 'time') });
            fetchData();
        } catch (err) {
            handleError(err);
        } finally {
            if (isMounted.current) setSaving(false);
        }
    };

    const handleCheckOut = async () => {
        if (!parteId || !activeSession) return;
        setSaving(true);
        try {
            const { error } = await supabase.rpc('api_parte_sesion', {
                p_parte_id: parteId,
                p_accion: 'salida',
                p_sesion_id: activeSession.id
            });

            if (error) throw error;

            toast({ title: "Salida Registrada", description: fmtMadrid(new Date(), 'time') });
            fetchData();
        } catch (err) {
            handleError(err);
        } finally {
            if (isMounted.current) setSaving(false);
        }
    };

    const initiateCloseParte = async () => {
        // Auto-close any open sessions
        const active = sessions.filter(s => !s.hora_salida);
        
        if (active.length > 0) {
            setSaving(true);
            try {
                // Close all open sessions concurrently
                const promises = active.map(session => 
                    supabase.rpc('api_parte_sesion', {
                        p_parte_id: parteId,
                        p_accion: 'salida',
                        p_sesion_id: session.id
                    })
                );
                
                await Promise.all(promises);
                
                // Refresh data to ensure UI consistency and that sessions are seen as closed
                await fetchData();
                
                // No UI indication (toast removed per request "No UI indication or modal appears")
                
            } catch (err) {
                console.error("Error auto-closing sessions:", err);
                toast({ variant: 'destructive', title: 'Error', description: 'Fallo al cerrar sesiones abiertas automáticamente.' });
                setSaving(false);
                return; // Stop if failed to auto-close
            }
            setSaving(false);
        }
        
        // Proceed with normal closure
        setIsClosureModalOpen(true); 
        fetchFilesCount();
    };

    const handleSaveTimeEdit = async () => {
        setSaving(true);
        try {
            const p_hora_entrada = timeEditData.start ? new Date(timeEditData.start).toISOString() : null;
            const p_hora_salida = timeEditData.end ? new Date(timeEditData.end).toISOString() : null;

            const { error } = await supabase.rpc('api_parte_sesion', {
                p_parte_id: parteId,
                p_accion: 'editar',
                p_sesion_id: timeEditData.sessionId, 
                p_hora_entrada: p_hora_entrada,
                p_hora_salida: p_hora_salida
            });

            if (error) throw error;

            toast({ title: "Horarios actualizados", description: "Se han guardado los cambios correctamente." });
            if (isMounted.current) setIsTimeEditModalOpen(false);
            fetchData();
        } catch (error) {
            handleError(error);
        } finally {
            if (isMounted.current) setSaving(false);
        }
    };

    const openTimeEditModal = (session) => {
        if (session) {
            const formatForInput = (dateStr) => {
                if (!dateStr) return '';
                const date = new Date(dateStr);
                const offset = date.getTimezoneOffset() * 60000;
                const localDate = new Date(date.getTime() - offset);
                return localDate.toISOString().slice(0, 16);
            };

            setTimeEditData({
                sessionId: session.id,
                start: formatForInput(session.hora_entrada),
                end: formatForInput(session.hora_salida)
            });
        } else {
            const now = new Date();
            const offset = now.getTimezoneOffset() * 60000;
            const localNow = new Date(now.getTime() - offset).toISOString().slice(0, 16);
            
            setTimeEditData({
                sessionId: null,
                start: localNow,
                end: ''
            });
        }
        setIsTimeEditModalOpen(true);
    };

    const handleManualStatusChange = async () => {
        if (!newStatus) return;
        // Map UI status back to internal value
        const internalStatus = mapUIToInternal(newStatus);
        
        if (internalStatus === parte.estado) {
            setIsStatusModalOpen(false);
            return;
        }
        
        setUpdatingStatus(true);
        // Optimistic update
        setParte(prev => ({ ...prev, estado: internalStatus }));
        setIsStatusModalOpen(false); 

        try {
            const { error } = await supabase.rpc('api_parte_cambiar_estado', {
                p_parte_id: parteId,
                p_nuevo_estado: internalStatus,
                p_nota: null
            });

            if (error) throw error;

            toast({ title: "Estado Actualizado", description: `El parte ahora está ${newStatus}.` });
            fetchData();
        } catch (e) {
            handleError(e);
            fetchData(); 
        } finally {
            if (isMounted.current) setUpdatingStatus(false);
        }
    };

    const handleScheduleVisit = async (visitDate) => {
        try {
            // Update fields in Supabase
            const { error } = await supabase
                .from('partes')
                .update({
                    visita_agendada_at: visitDate.toISOString(),
                    visita_agendada_by: user.id, // Storing auth.uid() as requested
                    estado: 'en_curso'
                })
                .eq('id', parteId);

            if (error) throw error;

            toast({ title: "Visita Agendada", description: `Fecha: ${fmtMadrid(visitDate)}` });
            setIsScheduleModalOpen(false);
            
            // Add activity log entry
            await supabase.from('partes_actividad').insert({
                parte_id: parteId,
                usuario_id: sessionRole?.empleadoId,
                contenido: `Visita agendada para el ${fmtMadrid(visitDate)}`,
                tipo: 'cambio_estado',
                fecha_creacion: new Date().toISOString()
            });

            fetchData();
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo agendar la visita.' });
            // Throw to keep modal open if needed, but handled inside Modal usually or here
            throw err; 
        }
    };

    const handleFixAdminLink = async () => {
        try {
            const { data, error } = await supabase.rpc('fix_admin_employee_link', { 
                p_target_auth_id: 'cd5067cb-f021-4fb9-abfc-019095eb37ae' 
            });
            if (error) throw error;
            toast({ title: "Diagnóstico Admin", description: data });
        } catch (e) {
            toast({ variant: "destructive", title: "Error Diagnóstico", description: e.message });
        }
    };

    const calculateSessionMinutes = (start, end) => {
        if (!start) return 0;
        const endTime = end ? new Date(end) : new Date(); 
        const startTime = new Date(start);
        return Math.max(0, differenceInMinutes(endTime, startTime));
    };

    const totalMinutesWorked = sessions.reduce((acc, s) => {
        return acc + calculateSessionMinutes(s.hora_entrada, s.hora_salida);
    }, 0);

    const formatMinutes = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    const calculateDuration = (start, end) => {
        if (!start) return '-';
        const mins = calculateSessionMinutes(start, end);
        return formatMinutes(mins);
    };

    const handleDownloadPDF = async () => {
        setGeneratingPdf(true);
        const element = document.getElementById('parte-pdf-template');
        const opt = {
            margin: [10, 10, 10, 10], 
            filename: `Parte_${parte.custom_id || parte.id.slice(0,8)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 }, 
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                scrollY: 0, 
                windowWidth: element.scrollWidth 
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { 
                mode: ['css', 'legacy'], 
                avoid: ['.pdf-image-card', '.avoid-break', 'tr'] 
            } 
        };

        try {
            await html2pdf().set(opt).from(element).save();
            toast({ title: "PDF Descargado", description: "El documento se ha generado correctamente." });
        } catch (e) {
            console.error("PDF Error:", e);
            toast({ variant: "destructive", title: "Error PDF", description: "No se pudo generar el PDF." });
        } finally {
            if (isMounted.current) setGeneratingPdf(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    if (!parte) return <div className="p-8 text-center">Parte no encontrado</div>;

    const isDeleted = !!parte.deleted_at;
    const isClosed = ['aceptado', 'cerrado', 'completado', 'finalizado'].includes(parte.estado?.toLowerCase());
    
    const canEditParte = isAdminOrEncargado || (isFincaAdmin && parte.created_by === sessionRole?.empleadoId);

    const getStatusBadge = (status) => {
        if (isDeleted) return <Badge variant="destructive" className="transition-colors duration-300">Eliminado</Badge>;
        
        let rawStatus = status?.toLowerCase() || 'contactado';
        
        // Force mapping for 'cerrado' -> 'VISITADO' or any other mapped state
        const uiStatus = mapInternalToUI(rawStatus);

        // Override logic for 'VISITA AGENDADA' based on DB state 'en_curso' + date present
        if (rawStatus === 'en_curso' && parte.visita_agendada_at) {
            return <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700">VISITA AGENDADA</Badge>;
        }

        if (parte.es_garantia && uiStatus === 'ACEPTADO') {
            const gColor = getStatusColor('garantia');
            const gText = getStatusTextColor('garantia');
            return <Badge 
                variant="outline" 
                className="rounded-xl px-2.5 py-0.5 shadow-sm border font-medium capitalize transition-colors duration-300"
                style={{ backgroundColor: gColor, color: gText, borderColor: gColor }}
            >
                Garantía
            </Badge>;
        }

        const bg = getStatusColor(uiStatus);
        const text = getStatusTextColor(uiStatus);
        // Ensure consistent label display (Capitalized or Title Case)
        const label = getStatusLabel(rawStatus);

        return <Badge 
            variant="outline" 
            className="rounded-xl px-2.5 py-0.5 shadow-sm border font-medium capitalize transition-colors duration-300"
            style={{ backgroundColor: bg, color: text, borderColor: bg }}
        >
            {label}
        </Badge>;
    };

    return (
        <div className="flex flex-col h-full bg-background relative">
            <Helmet><title>Parte {parte.custom_id || '#' + parte.id.slice(0, 8)}</title></Helmet>

            <div className="flex flex-col border-b bg-card sticky top-0 z-10 shadow-sm">
                <div className="flex items-center justify-between px-4 md:px-6 py-4">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/gestion/partes')}>
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-bold flex items-center gap-2">
                                    {parte.custom_id || '#' + parte.id.slice(0, 8)}
                                    {getStatusBadge(parte.estado)}
                                </h1>
                                {parte.archived_folder_path && (
                                    <Badge variant="secondary" className="flex items-center gap-1 text-[10px] font-normal bg-slate-100 text-slate-600 border border-slate-200">
                                        <FolderArchive className="w-3 h-3" />
                                        {parte.archived_folder_path.split('/')[1]}
                                    </Badge>
                                )}
                                {isAdminOrEncargado && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 w-6 p-0 hover:bg-muted ml-2"
                                        onClick={() => {
                                            setNewStatus(mapInternalToUI(parte.estado));
                                            setIsStatusModalOpen(true);
                                        }}
                                        title="Editar estado manualmente"
                                    >
                                        <Pencil className="w-3 h-3 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 text-xs text-muted-foreground mt-1">
                                <span>Creado: {fmtMadrid(parte.created_at)}</span>
                                {parte.archive_date && (
                                    <span className="flex items-center gap-1 text-slate-500">
                                        <ArchiveRestore className="w-3 h-3" />
                                        Archivado: {fmtMadrid(parte.archive_date)}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                        {isAdmin && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 hidden lg:flex" 
                                onClick={handleFixAdminLink}
                                title="Diagnóstico de cuenta Admin (Fix Link)"
                            >
                                <Wrench className="w-4 h-4" />
                            </Button>
                        )}

                        {!isDeleted && !existingLeadId && (
                            <Button 
                                variant="outline" 
                                className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 flex-1 sm:flex-none shadow-sm hidden lg:flex"
                                onClick={() => setIsConvertAlertOpen(true)}
                            >
                                <Megaphone className="w-4 h-4 mr-2" /> Convertir en Lead
                            </Button>
                        )}

                        {existingLeadId && (
                            <Button 
                                variant="outline" 
                                className="bg-indigo-100 hover:bg-indigo-200 text-indigo-800 border-indigo-300 flex-1 sm:flex-none shadow-sm hidden lg:flex"
                                onClick={() => navigate(`/crm/leads/${existingLeadId}`)}
                            >
                                <Megaphone className="w-4 h-4 mr-2" /> Ver Lead
                            </Button>
                        )}

                        {isTechnician && !isDeleted && !isClosed && (
                            <Button 
                                variant="outline" 
                                className="bg-white hover:bg-indigo-50 text-indigo-700 border-indigo-200 shadow-sm"
                                onClick={() => setIsScheduleModalOpen(true)}
                            >
                                <CalendarCheck className="w-4 h-4 mr-2" /> Agendar visita
                            </Button>
                        )}

                        {canEditParte && !isDeleted && (
                            <Button 
                                variant="outline" 
                                className="border-slate-300 text-slate-700 hover:bg-slate-100"
                                onClick={() => setIsEditModalOpen(true)}
                            >
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                            </Button>
                        )}

                        {isClosed && !isDeleted && (
                            <Button 
                                onClick={handleDownloadPDF} 
                                disabled={generatingPdf}
                                className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 shadow-sm px-3 h-9 md:w-auto flex-none"
                                size="sm"
                            >
                                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />}
                                PARTE
                            </Button>
                        )}

                        {!isClosed && !isDeleted && parte.tecnico?.telefono && (
                            <Button 
                                onClick={handleNotifyTechnician} 
                                disabled={sendingWpp}
                                className="bg-green-600 hover:bg-green-700 text-white flex-1 sm:flex-none border border-green-700 shadow-sm hidden lg:flex"
                            >
                                {sendingWpp ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                {sendingWpp ? 'Enviando...' : 'Avisar Técnico'}
                            </Button>
                        )}

                        {!isClosed && !isDeleted && (
                            <Button 
                                onClick={initiateCloseParte} 
                                className="bg-slate-900 hover:bg-slate-800 flex-1 sm:flex-none"
                                disabled={saving}
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenTool className="w-4 h-4 mr-2" />}
                                Cerrar Parte
                            </Button>
                        )}
                    </div>
                </div>

                {isDeleted && (
                    <div className="px-4 pb-4">
                        <Alert variant="destructive">
                            <Trash2 className="h-4 w-4" />
                            <AlertTitle>Parte Eliminado</AlertTitle>
                            <AlertDescription>
                                Este parte fue eliminado por <strong>{parte.eliminado_por?.nombre || 'un usuario'}</strong> el {fmtMadrid(parte.deleted_at)}. 
                                Se conserva solo para consulta histórica.
                            </AlertDescription>
                        </Alert>
                    </div>
                )}

                <div className="px-4 md:px-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="w-full justify-start overflow-x-auto bg-transparent p-0 h-auto rounded-none space-x-4 border-none no-scrollbar">
                            <TabsTrigger 
                                value="info" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
                            >
                                <FileText className="w-4 h-4" /> Información
                            </TabsTrigger>
                            <TabsTrigger 
                                value="photos" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
                            >
                                <Camera className="w-4 h-4" /> FOTOS
                            </TabsTrigger>
                            <TabsTrigger 
                                value="docs" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
                            >
                                <File className="w-4 h-4" /> Documentos
                            </TabsTrigger>
                            <TabsTrigger 
                                value="assignments" 
                                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 font-semibold text-muted-foreground transition-all hover:text-foreground flex items-center gap-2"
                            >
                                <Users className="w-4 h-4" /> Asignaciones
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
            </div>

            {/* ... (rest of the component structure) ... */}
            <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-background/50">
                <Tabs value={activeTab} className="h-full">
                    <TabsContent value="info" className="h-full mt-0">
                        <div className="h-full grid grid-cols-1 lg:grid-cols-3">
                            <ScrollArea className="lg:col-span-1 border-r bg-muted/10 p-6">
                                <div className="space-y-6">
                                    <Card className="border-l-4 border-l-blue-500 shadow-sm">
                                        <CardHeader className="pb-3 pt-4 bg-blue-50/30 dark:bg-card-foreground/5">
                                            <div className="flex items-center justify-between">
                                                <CardTitle className="text-sm font-bold uppercase text-blue-700 dark:text-primary-foreground flex items-center gap-2">
                                                    <Clock className='w-4 h-4' /> Control de Tiempo
                                                </CardTitle>
                                                {canEditTimes && !isDeleted && (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-blue-100/50 text-blue-600" onClick={() => openTimeEditModal(null)} title="Añadir Sesión">
                                                            <History className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4 pt-4">
                                            <div className="flex justify-between items-center mb-4">
                                                <span className="text-sm font-medium text-muted-foreground">Total Acumulado</span>
                                                <Badge variant="secondary" className="font-mono text-lg bg-blue-100 text-blue-800 border-blue-200">
                                                    {formatMinutes(totalMinutesWorked)}
                                                </Badge>
                                            </div>

                                            {activeSession && (
                                                <div className="bg-green-50 p-3 rounded-md border border-green-200 mb-4 animate-in fade-in">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className="text-xs font-bold text-green-700 uppercase flex items-center gap-1">
                                                                <Timer className="w-3 h-3" /> Sesión en Curso
                                                            </p>
                                                            <p className="text-xs text-green-600 mt-1">
                                                                Inicio: {fmtMadrid(activeSession.hora_entrada, 'time')}
                                                            </p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs font-mono font-bold text-green-800 block">
                                                                {calculateDuration(activeSession.hora_entrada)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {sessions.length > 0 && (
                                                <div className="space-y-2 border-t pt-2">
                                                    <Label className="text-xs text-muted-foreground uppercase">Historial de Visitas</Label>
                                                    <div className="space-y-1">
                                                        {[...sessions].reverse().map((s, idx) => (
                                                            <div key={s.id} className="grid grid-cols-12 text-xs items-center p-1.5 hover:bg-muted rounded group">
                                                                <div className="col-span-1 text-muted-foreground font-mono">#{sessions.length - idx}</div>
                                                                <div className="col-span-4 font-mono">{fmtMadrid(s.hora_entrada, 'date')} <span className="text-gray-400">{fmtMadrid(s.hora_entrada, 'time')}</span></div>
                                                                <div className="col-span-4 font-mono pl-2 border-l">
                                                                    {s.hora_salida ? (
                                                                        <span className="text-gray-400">{fmtMadrid(s.hora_salida, 'time')}</span>
                                                                    ) : <span className="text-green-600 italic">En curso</span>}
                                                                </div>
                                                                <div className="col-span-2 text-right font-bold text-gray-700">
                                                                    {calculateDuration(s.hora_entrada, s.hora_salida)}
                                                                </div>
                                                                <div className="col-span-1 flex justify-end">
                                                                    {canEditTimes && !isDeleted && (
                                                                        <button onClick={() => openTimeEditModal(s)} className="text-blue-500 opacity-0 group-hover:opacity-100 hover:text-blue-700">
                                                                            <Pencil className="w-3 h-3" />
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="pt-2 mt-4 border-t">
                                                {!activeSession && !isClosed && !isDeleted && (
                                                    <Button onClick={handleCheckIn} disabled={saving} className="w-full bg-green-600 hover:bg-green-700 text-white h-9 shadow-sm">
                                                        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Play className="w-3 h-3 mr-2 fill-current" />}
                                                        Registrar Entrada (Check-in)
                                                    </Button>
                                                )}
                                                
                                                {activeSession && !isClosed && !isDeleted && (
                                                    <Button onClick={handleCheckOut} disabled={saving} className="w-full bg-orange-600 hover:bg-orange-700 text-white h-9 shadow-sm">
                                                        {saving ? <Loader2 className="w-3 h-3 animate-spin mr-2"/> : <Square className="w-3 h-3 mr-2 fill-current" />}
                                                        Registrar Salida (Check-out)
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-muted-foreground dark:text-foreground flex items-center gap-2"><User className='w-4 h-4' /> Cliente</CardTitle></CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Cliente / Empresa</Label>
                                                <p className="font-medium text-sm">{parte.cliente_nombre}</p>
                                            </div>
                                            {parte.persona_contacto && (
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Persona de Contacto</Label>
                                                    <p className="font-medium text-sm">{parte.persona_contacto}</p>
                                                </div>
                                            )}
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Teléfono</Label>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-xs mt-1 ml-1 font-mono">{parte.telefono_contacto || 'No especificado'}</p>
                                                    {parte.telefono_contacto && (
                                                        <a 
                                                            href={`tel:${parte.telefono_contacto}`} 
                                                            className="inline-flex items-center justify-center rounded-full bg-green-100 p-1.5 text-green-700 hover:bg-green-200 transition-colors"
                                                            title="Llamar"
                                                        >
                                                            <Phone className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="space-y-1 pt-2 border-t">
                                                <Label className="text-xs text-muted-foreground">Trabajo Solicitado</Label>
                                                <p className="text-sm whitespace-pre-wrap">{parte.descripcion_trabajo}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-muted-foreground dark:text-foreground flex items-center gap-2"><HardHat className='w-4 h-4' /> Asignación</CardTitle></CardHeader>
                                        <CardContent className="space-y-2">
                                            <div className="space-y-1">
                                                <Label className="text-xs text-muted-foreground">Técnico Responsable</Label>
                                                <p className="font-medium text-lg">{parte.tecnico?.nombre} {parte.tecnico?.apellidos}</p>
                                                {parte.tecnico?.telefono && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Phone className="w-3 h-3" /> {parte.tecnico.telefono}</p>}
                                            </div>
                                            
                                            {parte.visita_agendada_at && (
                                                <div className="space-y-1 mt-2 bg-indigo-50 border border-indigo-100 rounded p-2">
                                                    <Label className="text-xs text-indigo-800 font-semibold flex items-center gap-1">
                                                        <CalendarCheck className="w-3 h-3" /> Visita Agendada
                                                    </Label>
                                                    <p className="font-medium text-sm text-indigo-900">
                                                        {fmtMadrid(parte.visita_agendada_at, 'date')} a las {fmtMadrid(parte.visita_agendada_at, 'time')}
                                                    </p>
                                                    {parte.visita_agendada_by && (
                                                        <p className="text-[10px] text-indigo-600 mt-0.5">
                                                            {parte.visita_agendada_by === user.id ? 'Por ti' : 'Por usuario asignado'}
                                                        </p>
                                                    )}
                                                </div>
                                            )}

                                            <div className="space-y-1 pt-2 border-t mt-2">
                                                <Label className="text-xs text-muted-foreground">Ubicación del Servicio</Label>
                                                <p className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-primary shrink-0" /> {parte.direccion_servicio}</p>
                                            </div>
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader className="pb-3 pt-4">
                                            <CardTitle className="text-sm font-bold uppercase text-muted-foreground dark:text-foreground flex items-center gap-2">
                                                <Package className='w-4 h-4' /> Materiales Asignados
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2 p-0">
                                            {materials.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-muted-foreground italic bg-muted/10">
                                                    No hay materiales asignados a este parte.
                                                </div>
                                            ) : (
                                                <div className="border-t">
                                                    {materials.map((item, index) => {
                                                        const cost = item.material_info?.precio_coste || 0;
                                                        const total = item.cantidad_solicitada * cost;
                                                        return (
                                                            <div key={item.id} className="p-3 border-b last:border-0 hover:bg-muted/5">
                                                                <div className="flex justify-between items-start mb-1">
                                                                    <span className="font-medium text-sm line-clamp-2">
                                                                        {item.descripcion_personalizada || item.material_info?.nombre || 'Material'}
                                                                    </span>
                                                                    <Badge variant="outline" className={item.header?.estado_solicitud === 'pendiente' ? 'text-amber-600 border-amber-200 bg-amber-50' : ''}>
                                                                        {item.header?.estado_solicitud}
                                                                    </Badge>
                                                                </div>
                                                                
                                                                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                                                    <span>{item.cantidad_solicitada} {item.unidad}</span>
                                                                    <span>{fmtMadrid(item.header?.fecha_solicitud, 'date')}</span>
                                                                </div>

                                                                {(isAdminOrEncargado) && (
                                                                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-dashed">
                                                                        <span className="text-[10px] text-muted-foreground">Coste: {formatCurrency(cost)}/ud</span>
                                                                        <span className="text-xs font-bold">{formatCurrency(total)}</span>
                                                                    </div>
                                                                )}
                                                                
                                                                {item.header?.notas && (
                                                                    <div className="mt-2 bg-yellow-50 p-1.5 rounded text-[10px] text-yellow-800 flex items-start gap-1">
                                                                        <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                                                        <span className="italic line-clamp-2">{item.header.notas}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {isClosed && (
                                        <Card className="border-green-200 bg-green-50/20 dark:bg-green-950/20 dark:border-green-700">
                                            <CardHeader className="pb-3 pt-4"><CardTitle className="text-sm font-bold uppercase text-green-700 dark:text-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> Resolución</CardTitle></CardHeader>
                                            <CardContent className="space-y-4 text-sm">
                                                <div className="space-y-1">
                                                    <Label className="text-xs text-muted-foreground">Trabajo Realizado</Label>
                                                    <p className="italic text-foreground/80 whitespace-pre-wrap">{parte.descripcion_cierre}</p>
                                                </div>
                                                <div className="flex gap-4 pt-2 border-t">
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Cliente</Label>
                                                        {signedSignatures.cliente ? (
                                                            <img src={signedSignatures.cliente} alt="Firma Cliente" className="w-full max-h-16 object-contain border rounded bg-white dark:bg-card" />
                                                        ) : <span className="text-xs italic">Sin firma</span>}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <Label className="text-xs text-muted-foreground">Técnico</Label>
                                                        {signedSignatures.tecnico ? (
                                                            <img src={signedSignatures.tecnico} className="h-16 object-contain" alt="Firma Técnico" crossOrigin="anonymous" />
                                                        ) : <span className="text-xs italic">Sin firma</span>}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )}
                                </div>
                            </ScrollArea>

                            {/* Right Column: Activity Log */}
                            <div id="activity-log-container" className="lg:col-span-2 flex flex-col h-full bg-card text-foreground overflow-hidden border-l dark:border-border">
                                <div className="flex-1 min-h-0 relative">
                                    <ParteActivityLog parteId={parteId} onStatusChange={fetchData} currentStatus={parte.estado} />
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="photos" className="h-full mt-0">
                        <ScrollArea className="h-full p-4 md:p-6">
                            <PartePhotoGallery parteId={parteId} />
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="docs" className="h-full mt-0">
                        <ScrollArea className="h-full p-4 md:p-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <File className="w-5 h-5" /> Documentación
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ParteDocuments 
                                        parteId={parteId} 
                                        canEdit={canEdit} 
                                        canDelete={canEdit} 
                                    />
                                </CardContent>
                            </Card>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="assignments" className="h-full mt-0">
                        <ScrollArea className="h-full p-4 md:p-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Users className="w-5 h-5" /> Gestión de Asignaciones
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ParteAssignmentManager 
                                        parteId={parteId} 
                                        currentTechnicianId={parte.tecnico_asignado_id} 
                                        onAssign={fetchData} 
                                        isAdmin={isAdminOrEncargado}
                                    />
                                </CardContent>
                            </Card>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </div>

            <EditParteModal 
                isOpen={isEditModalOpen} 
                onClose={() => setIsEditModalOpen(false)} 
                parteId={parteId}
                onParteUpdated={fetchData}
            />

            <ScheduleVisitModal 
                isOpen={isScheduleModalOpen}
                onClose={(open) => setIsScheduleModalOpen(open)}
                parteId={parteId}
                onSave={handleScheduleVisit}
            />

            {/* ... Alert Dialogs for Lead Conversion, Closure, Status, TimeEdit ... */}
            <AlertDialog open={isConvertAlertOpen} onOpenChange={setIsConvertAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Convertir Parte en Lead</AlertDialogTitle>
                        <AlertDialogDescription>
                            Se creará un nuevo lead con los datos de este parte de trabajo para su seguimiento comercial. 
                            <br/><br/>
                            <strong>Cliente:</strong> {parte.cliente_nombre}<br/>
                            <strong>Ref. Parte:</strong> {parte.custom_id || '#' + parte.id.slice(0, 8)}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConvertToLead} className="bg-indigo-600 hover:bg-indigo-700" disabled={converting}>
                            {converting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Megaphone className="w-4 h-4 mr-2" />}
                            {converting ? 'Creando...' : 'Confirmar y Crear Lead'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Dialog open={isClosureModalOpen} onOpenChange={setIsClosureModalOpen}>
                <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Cerrar Parte</DialogTitle>
                        <DialogDescription>Documenta el trabajo y recoge firmas.</DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="desc">Trabajo realizado (Obligatorio)</Label>
                            <Textarea
                                id="desc"
                                placeholder="Descripción..."
                                value={closureData.descripcion_cierre}
                                onChange={(e) => setClosureData(prev => ({ ...prev, descripcion_cierre: e.target.value }))}
                                className="min-h-[80px]"
                            />
                        </div>

                        <div className="space-y-3 p-3 border rounded-lg bg-yellow-50/30 dark:bg-yellow-950/30 dark:border-yellow-700">
                            <Label className="flex items-center gap-2 font-semibold text-yellow-800 dark:text-yellow-300 text-sm">
                                <Image className="w-4 h-4" /> Evidencia Final
                            </Label>
                            {existingFilesCount > 0 ? (
                                <p className="text-xs text-gray-700 dark:text-muted-foreground italic">Opcional (ya hay archivos en bitácora).</p>
                            ) : (
                                <p className="text-xs text-red-600 dark:text-red-400 font-bold">⚠️ Obligatorio: Sube una foto.</p>
                            )}
                            <input type="file" ref={fileInputRef} className="hidden" onChange={handleModalFileSelect} accept="image/*,application/pdf" capture="environment" />
                            {closureFile ? (
                                <div className="flex items-center justify-between p-2 bg-blue-100 border border-blue-300 rounded text-sm dark:bg-blue-900/50 dark:border-blue-700">
                                    <span className="truncate max-w-[200px]">{closureFile.name}</span>
                                    <button type="button" onClick={handleClearModalFile} className="text-red-500"><X className="w-4 h-4" /></button>
                                </div>
                            ) : (
                                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full border-dashed border-yellow-500 text-yellow-700 dark:border-yellow-700 dark:text-yellow-300" disabled={saving}>
                                    <Image className="w-4 h-4 mr-2" /> Subir Foto Final
                                </Button>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Firma Cliente</Label>
                            <SignaturePad canvasRef={clienteCanvasRef} onClear={() => handleClearSignature(clienteCanvasRef)} title="Firma Cliente" />
                        </div>
                        <div className="space-y-2">
                            <Label>Firma Técnico</Label>
                            <SignaturePad canvasRef={tecnicoCanvasRef} onClear={() => handleClearSignature(tecnicoCanvasRef)} title="Firma Técnico" />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsClosureModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleCloseParte} disabled={saving} className="bg-green-600 text-white">
                            {saving ? 'Cerrando...' : 'Confirmar Cierre'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isTransitionModalOpen} onOpenChange={setIsTransitionModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{transitionType === 'archivado' ? 'Archivar Parte' : 'Finalizar Parte'}</DialogTitle>
                        <DialogDescription>
                            Esta acción moverá el parte al histórico como {transitionType}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                        <Label htmlFor="transition-note" className="mb-2 block">Nota (Opcional)</Label>
                        <Textarea 
                            id="transition-note" 
                            placeholder="Detalles adicionales..."
                            value={transitionNote}
                            onChange={(e) => setTransitionNote(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTransitionModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleTransition} disabled={saving} className={transitionType === 'finalizado' ? 'bg-green-600 hover:bg-green-700' : ''}>
                            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                            Confirmar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isTimeEditModalOpen} onOpenChange={setIsTimeEditModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{timeEditData.sessionId ? 'Editar Sesión' : 'Añadir Sesión'}</DialogTitle>
                        <DialogDescription>Ajusta manualmente los tiempos de entrada y salida.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="start-time">Hora Entrada</Label>
                            <Input
                                id="start-time"
                                type="datetime-local"
                                value={timeEditData.start}
                                onChange={(e) => setTimeEditData({...timeEditData, start: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="end-time">Hora Salida</Label>
                            <Input
                                id="end-time"
                                type="datetime-local"
                                value={timeEditData.end}
                                onChange={(e) => setTimeEditData({...timeEditData, end: e.target.value})}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsTimeEditModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveTimeEdit} disabled={saving}>Guardar Cambios</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Cambiar Estado</DialogTitle>
                        <DialogDescription>Modificar manualmente el estado del parte.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="mb-2 block">Nuevo Estado</Label>
                        <Select value={newStatus} onValueChange={setNewStatus}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona estado" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="CONTACTADO">CONTACTADO</SelectItem>
                                <SelectItem value="VISITA AGENDADA">VISITA AGENDADA</SelectItem>
                                <SelectItem value="VISITADO">VISITADO</SelectItem>
                                <SelectItem value="PRESUPUESTADO">PRESUPUESTADO</SelectItem>
                                <SelectItem value="ACEPTADO">ACEPTADO</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsStatusModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleManualStatusChange} disabled={updatingStatus}>Guardar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden PDF Template (unchanged content, skipping here for brevity if it was large) */}
            <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
                <div id="parte-pdf-template" className="w-[190mm] bg-white p-4 text-black font-sans text-xs leading-normal">
                    {/* ... PDF Template Content (Assuming no changes needed here unless colors inside PDF were requested, but prompt implies UI) ... */}
                    {/* To be safe, I'll include the header since I need to close the tags properly */}
                    <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                        <div className="w-1/2">
                            <h1 className="text-xl font-bold tracking-widest mb-1">ORKALED INSTALACIONES SLU</h1>
                            <p className="text-[10px] text-gray-600">B88219837</p>
                            <p className="text-[10px] text-gray-600 mt-1">C/Deva 8 - 28041 - Madrid</p>
                            <p className="text-[10px] text-gray-600">Tfno: 913414682 | info@orkaled.com</p>
                        </div>
                        <div className="text-right w-1/2">
                            <h2 className="text-lg font-bold uppercase">Parte de Trabajo</h2>
                            <p className="text-base font-mono text-gray-700 mt-1">{parte.custom_id || '#' + parte.id.substring(0,8)}</p>
                            <p className="text-[10px] mt-1">Fecha: <strong>{fmtMadrid(parte.created_at, 'date')}</strong></p>
                            <div className="mt-2 inline-block px-3 py-1 border border-black text-[10px] font-bold uppercase">
                                {parte.es_garantia && (parte.estado === 'cerrado' || parte.estado === 'facturado' || parte.estado === 'finalizado') ? 'GARANTÍA' : mapInternalToUI(parte.estado)}
                            </div>
                        </div>
                    </div>
                    {/* ... Remaining PDF content omitted to save tokens as it's not the focus of refactoring unless requested. ... */}
                    {/* I'll paste the full PDF block content from previous known state to ensure file integrity */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="border p-3">
                            <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 text-[10px] uppercase">Datos del Cliente</h3>
                            <div className="text-[10px] space-y-1">
                                <p><span className="text-gray-500">Nombre:</span><br/>{parte.cliente_nombre}</p>
                                <p><span className="text-gray-500">Dirección:</span><br/>{parte.direccion_servicio}</p>
                                <p><span className="text-gray-500">Contacto:</span><br/>{parte.persona_contacto || '-'}</p>
                                <p><span className="text-gray-500">Teléfono:</span><br/>{parte.telefono_contacto || '-'}</p>
                            </div>
                        </div>
                        <div className="border p-3">
                            <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 text-[10px] uppercase">Datos del Servicio</h3>
                            <div className="text-[10px] space-y-1">
                                <p><span className="text-gray-500">Técnico Asignado:</span><br/>
                                    {parte.tecnico ? `${parte.tecnico.nombre} ${parte.tecnico.apellidos || ''}` : 'Sin asignar'}
                                </p>
                                <p><span className="text-gray-500">Fecha Visita:</span><br/>
                                    {parte.fecha_visita ? fmtMadrid(parte.fecha_visita) : 'Sin fecha'}
                                </p>
                                <p><span className="text-gray-500">Generado por:</span><br/>
                                    {parte.creador ? `${parte.creador.nombre}` : '-'}
                                </p>
                                <div className="mt-2 pt-2 border-t border-gray-200">
                                    <p className="font-bold mt-1"><span className="text-gray-500 font-normal">Tiempo Total Trabajado:</span> {formatMinutes(totalMinutesWorked)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <h3 className="font-bold bg-gray-100 p-2 text-[10px] uppercase border-t border-l border-r border-black">Descripción de la Solicitud</h3>
                        <div className="border border-black p-3 text-[10px] min-h-[20mm]">
                            <p className="whitespace-pre-wrap">{parte.descripcion_trabajo}</p>
                        </div>
                    </div>

                    {sessions.length > 0 && (
                        <div className="mb-6 avoid-break">
                            <h3 className="font-bold bg-gray-100 p-2 text-[10px] uppercase border-t border-l border-r border-black">Registro de Jornada</h3>
                            <div className="border border-black p-0 text-[9px]">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-300">
                                            <th className="text-left p-2 font-semibold">Fecha</th>
                                            <th className="text-center p-2 font-semibold">Entrada</th>
                                            <th className="text-center p-2 font-semibold">Salida</th>
                                            <th className="text-center p-2 font-semibold">Duración</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((s, i) => (
                                            <tr key={i} className="border-b border-gray-100 last:border-0">
                                                <td className="p-2">{fmtMadrid(s.hora_entrada, 'date')}</td>
                                                <td className="p-2 text-center">{fmtMadrid(s.hora_entrada, 'time')}</td>
                                                <td className="p-2 text-center">{s.hora_salida ? fmtMadrid(s.hora_salida, 'time') : 'En curso'}</td>
                                                <td className="p-2 text-center">{calculateDuration(s.hora_entrada, s.hora_salida)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {isClosed && (
                        <div className="mb-6">
                            <h3 className="font-bold bg-gray-100 p-2 text-[10px] uppercase border-t border-l border-r border-black">Trabajo Realizado (Resolución)</h3>
                            <div className="border border-black p-3 text-[10px] min-h-[20mm]">
                                <p className="whitespace-pre-wrap">{parte.descripcion_cierre}</p>
                                <p className="text-[9px] text-gray-500 mt-4 text-right">
                                    Fecha Cierre: {fmtMadrid(parte.fecha_cierre)}
                                </p>
                            </div>
                        </div>
                    )}

                    {materials.length > 0 && (
                        <div className="mb-6 avoid-break">
                            <h3 className="font-bold bg-gray-100 p-2 text-[10px] uppercase border-t border-l border-r border-black">Materiales Empleados</h3>
                            <div className="border border-black p-0 text-[10px]">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-gray-50 border-b border-gray-300">
                                            <th className="text-left p-2 font-semibold w-1/2">Material</th>
                                            <th className="text-center p-2 font-semibold w-1/4">Cant.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {materials.map((m, i) => (
                                            <tr key={i} className="border-b border-gray-100 last:border-0">
                                                <td className="p-2">{m.descripcion_personalizada || m.material_info?.nombre}</td>
                                                <td className="p-2 text-center">{m.cantidad_solicitada} {m.unidad}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {isClosed && (
                        <div className="mt-8 mb-8">
                            <div className="grid grid-cols-2 gap-10">
                                <div className="text-center">
                                    <div className="h-20 border-b border-black flex items-end justify-center mb-2">
                                        {signedSignatures.cliente ? (
                                            <img src={signedSignatures.cliente} className="h-16 object-contain" alt="Firma Cliente" crossOrigin="anonymous" />
                                        ) : <span className="text-[10px] italic text-gray-400 mb-2">Sin firma</span>}
                                    </div>
                                    <p className="text-[10px] font-bold uppercase">Firma Cliente</p>
                                    <p className="text-[9px]">{parte.cliente_nombre}</p>
                                </div>
                                <div className="text-center">
                                    <div className="h-20 border-b border-black flex items-end justify-center mb-2">
                                        {signedSignatures.tecnico ? (
                                            <img src={signedSignatures.tecnico} className="h-16 object-contain" alt="Firma Técnico" crossOrigin="anonymous" />
                                        ) : <span className="text-[10px] italic text-gray-400 mb-2">Sin firma</span>}
                                    </div>
                                    <p className="text-[10px] font-bold uppercase">Firma Técnico</p>
                                    <p className="text-[9px]">{parte.tecnico?.nombre}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {parteImages && parteImages.length > 0 && (
                        <div className="mt-8 page-break-before-always">
                            <h3 className="font-bold bg-gray-800 text-white p-2 text-[10px] uppercase mb-4 text-center">Anexo: Evidencias Fotográficas</h3>
                            <div className="grid grid-cols-2 gap-4">
                                {parteImages.map((img, idx) => (
                                    <div 
                                        key={idx} 
                                        className="pdf-image-card avoid-break border p-2 flex flex-col items-center justify-center bg-gray-50 rounded h-fit"
                                        style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
                                    >
                                        <div className="relative w-full">
                                            {img.origin === 'Cierre' && (
                                                <div className="absolute top-0 right-0 bg-yellow-100 text-yellow-800 text-[8px] px-1.5 py-0.5 rounded-bl border border-yellow-200 z-10 font-bold uppercase">
                                                    Cierre
                                                </div>
                                            )}
                                            {img.url ? (
                                                <img 
                                                    src={img.url} 
                                                    alt={`Evidencia ${idx + 1}`} 
                                                    className="max-h-[250px] object-contain max-w-full mb-2 border border-gray-200 bg-white" 
                                                    crossOrigin="anonymous"
                                                />
                                            ) : (
                                                <div className="h-24 w-full flex items-center justify-center bg-gray-200 text-gray-500 text-[9px]">
                                                    Imagen no disponible
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-[9px] text-center text-gray-600 mt-1 px-2 truncate w-full">
                                            {img.nombre_archivo || `Imagen ${idx + 1}`}
                                        </p>
                                        <p className="text-[8px] text-gray-400">
                                            {fmtMadrid(img.created_at)} • {img.origin || 'Galería'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-10 pt-4 border-t border-gray-300 text-center text-[9px] text-gray-500">
                        <p>Documento generado electrónicamente por Orkaled ERP el {fmtMadrid(new Date())}.</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ParteDetail;