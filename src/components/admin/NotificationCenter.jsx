import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNotification } from "@/contexts/NotificationContext";
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Bell, Check, Trash2, Archive, RefreshCw, 
  MessageSquare, FileText, AlertCircle, Briefcase, 
  User, Layers, MailOpen, Inbox, Filter
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from 'react-router-dom';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from 'framer-motion';

// --- Helper: URL Extraction ---
const getInternalPath = (url) => {
  if (!url) return null;
  if (url.startsWith('/')) return url;
  if (url.startsWith('http')) {
      try {
          const urlObj = new URL(url);
          return urlObj.pathname + urlObj.search + urlObj.hash;
      } catch (e) {
          console.error("Error parsing URL:", url, e);
          return null;
      }
  }
  return '/' + url; 
};

// --- Helper: Icon mapping ---
const getNotificationIcon = (type) => {
  const t = type?.toLowerCase()?.trim();
  switch (t) {
    case 'lead': return <User className="h-4 w-4 text-blue-500" />;
    case 'obra':
    case 'proyecto': return <Briefcase className="h-4 w-4 text-orange-500" />;
    case 'parte': 
    case 'status_change': return <FileText className="h-4 w-4 text-green-500" />;
    case 'tarea': return <Layers className="h-4 w-4 text-purple-500" />;
    case 'comentario': return <MessageSquare className="h-4 w-4 text-yellow-500" />;
    case 'aviso': return <AlertCircle className="h-4 w-4 text-red-500" />;
    default: return <Bell className="h-4 w-4 text-gray-500" />;
  }
};

// --- Helper: Check Existence ---
const checkEntityExists = async (type, id) => {
  if (!id || !type) return false;
  let table = null;
  const t = type.toLowerCase().trim();
  
  if (t === 'lead') table = 'leads';
  else if (['obra', 'proyecto'].includes(t)) table = 'proyectos';
  else if (t === 'parte' || t === 'status_change') table = 'partes';
  else if (t === 'tarea') table = 'tareas';
  else if (t === 'aviso') table = 'avisos';
  
  if (!table) return true;

  try {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('id', id);
    if (error) return true; 
    return count > 0;
  } catch (e) { return true; }
};

// --- Helper: Route mapping ---
const getEntityRoute = (type, id) => {
  if (!id) return null;
  const t = type?.toLowerCase()?.trim();
  
  if (t === 'lead') return `/crm/leads/${id}`;
  if (['obra', 'proyecto'].includes(t)) return `/gestion/obras/${id}`;
  if (t === 'parte' || t === 'status_change') return `/gestion/partes/detail/${id}`;
  if (t === 'aviso') return `/gestion/avisos/${id}`;
  if (t === 'tarea') return `/gestion/tareas`; 
  return null;
};

// --- Component: Notification Row ---
const NotificationRow = ({ 
  notification, 
  isSelected, 
  onSelect, 
  onClick,
  onAction,
  processing 
}) => {
  const { 
    id, 
    tipo_entidad,
    titulo, 
    mensaje, 
    estado, 
    fecha_creacion, 
    datos_nuevos 
  } = notification;

  const isUnread = estado === 'no_leida';
  const isProcessing = processing === id;
  
  // Format Date
  let dateStr = '';
  try {
    const dateObj = new Date(fecha_creacion);
    const isToday = new Date().toDateString() === dateObj.toDateString();
    dateStr = isToday 
        ? format(dateObj, "HH:mm", { locale: es }) 
        : format(dateObj, "d MMM", { locale: es });
  } catch (e) { dateStr = '-'; }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: isProcessing ? 0.5 : 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group flex items-start gap-3 p-4 border-b hover:bg-muted/40 transition-colors cursor-pointer relative",
        isUnread ? "bg-blue-50/40 dark:bg-blue-900/10" : "bg-background",
        isSelected && "bg-muted",
        isProcessing && "pointer-events-none grayscale"
      )}
      onClick={(e) => onClick(e, notification)}
    >
      <div className="flex-shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
        <Checkbox 
          checked={isSelected} 
          onCheckedChange={(checked) => onSelect(id, checked)}
          className={cn(
            "transition-opacity data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100 sm:opacity-0" 
          )}
        />
      </div>

      <div className={cn(
        "w-2 h-2 rounded-full flex-shrink-0 mt-2 transition-colors",
        isUnread ? "bg-blue-500" : "bg-transparent"
      )} />

      <div className="flex-shrink-0 mt-1 text-muted-foreground">
        {getNotificationIcon(tipo_entidad || notification.tipo_objeto)}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between">
            <span className={cn(
              "text-sm",
              isUnread ? "font-bold text-foreground" : "font-medium text-foreground/80"
            )}>
              {titulo || 'Notificación'}
            </span>
            <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
              {dateStr}
            </span>
        </div>
        
        <p className={cn(
          "text-sm line-clamp-2",
          isUnread ? "text-foreground" : "text-muted-foreground"
        )}>
          {mensaje}
        </p>
        
        {datos_nuevos?.tipo_cambio && (
            <div className="mt-1">
                <Badge variant="outline" className="text-[10px] h-4 px-1 py-0 font-normal opacity-70">
                  {datos_nuevos.tipo_cambio}
                </Badge>
            </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-4 top-3 bg-background/80 backdrop-blur-sm pl-2 rounded-l-md shadow-sm" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={() => onAction('toggleRead', id)}
          title={isUnread ? "Marcar leída" : "Marcar no leída"}
        >
          {isUnread ? <MailOpen className="h-3.5 w-3.5" /> : <Inbox className="h-3.5 w-3.5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onAction('delete', id)}
          title="Eliminar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
};

export const NotificationCenter = () => {
  const { user, sessionRole } = useAuth();
  const { refreshCount, adjustCount } = useNotification();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('unread'); // all (active), unread, archived
  const [loading, setLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [processingId, setProcessingId] = useState(null);
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [idsToDelete, setIdsToDelete] = useState([]); 

  const cleanupDuplicates = async (duplicateIds) => {
    if (!duplicateIds || duplicateIds.length === 0) return;
    try {
        await supabase.from('notificaciones').delete().in('id', duplicateIds);
    } catch (e) { console.error(e); }
  };

  const fetchNotifications = async () => {
    if (!sessionRole?.empleadoId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('notificaciones')
        .select('*')
        .eq('empleado_id', sessionRole.empleadoId)
        .order('fecha_creacion', { ascending: false });

      if (filter === 'unread') {
        query = query.eq('estado', 'no_leida');
      } else if (filter === 'all') {
        query = query.neq('estado', 'eliminada');
      } else if (filter === 'archived') {
        query = query.eq('estado', 'eliminada');
      }

      const { data, error } = await query;
      if (error) throw error;

      // Deduplication
      const uniqueMap = new Map();
      const cleanData = [];
      const dupes = [];

      for (const item of (data || [])) {
          const contentKey = `${item.tipo_entidad}-${item.entidad_id}-${item.mensaje}`;
          if (uniqueMap.has(contentKey)) {
              const existing = uniqueMap.get(contentKey);
              if (Math.abs(new Date(existing.fecha_creacion) - new Date(item.fecha_creacion)) < 5000) {
                  dupes.push(item.id);
                  continue; 
              }
          }
          uniqueMap.set(contentKey, item);
          cleanData.push(item);
      }

      if (dupes.length > 0) cleanupDuplicates(dupes);

      // Filtrar notificaciones generadas por el propio admin (MIKELO)
      const filteredData = cleanData.filter(n => {
        if (!n.mensaje) return true;
        const author = n.mensaje.split(': ')[0]?.trim().toUpperCase();
        return author !== 'MIKELO';
      });
      setNotifications(filteredData);
      setSelectedIds(new Set()); 
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Error al cargar notificaciones." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [sessionRole?.empleadoId, filter]);

  const handleSelect = (id, checked) => {
    const newSelected = new Set(selectedIds);
    checked ? newSelected.add(id) : newSelected.delete(id);
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked) => {
    setSelectedIds(checked ? new Set(notifications.map(n => n.id)) : new Set());
  };

  const handleRowClick = async (e, notification) => {
    if (e.target.closest('button') || e.target.closest('[role="checkbox"]')) return;
    setProcessingId(notification.id);

    try {
        // Optimistic Read
        if (notification.estado === 'no_leida') {
            adjustCount(-1);
            await supabase.from('notificaciones').update({ 
                estado: 'leida',
                fecha_lectura: new Date().toISOString()
            }).eq('id', notification.id);
            setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, estado: 'leida' } : n));
        }

        let destination = notification.link;
        if (!destination && (notification.entidad_id || notification.referencia_id)) {
            destination = getEntityRoute(
                notification.tipo_entidad || notification.tipo_objeto, 
                notification.entidad_id || notification.referencia_id
            );
        }

        if (destination) {
            navigate(getInternalPath(destination));
        } else {
            toast({ description: "Esta notificación no tiene enlace." });
        }
    } catch (err) {
        console.error(err);
    } finally {
        setProcessingId(null);
    }
  };

  const performAction = async (ids, actionType) => {
    if (!ids.length) return;
    try {
      if (actionType === 'delete') {
        setProcessingId('bulk-deleting');
        const { count } = await supabase.from('notificaciones').delete({ count: 'exact' }).in('id', ids);
        if (count > 0) {
            setNotifications(prev => prev.filter(n => !ids.includes(n.id)));
            toast({ description: `${count} eliminadas.` });
        }
      } else {
        const newStatus = actionType === 'unread' ? 'no_leida' : (actionType === 'archive' ? 'eliminada' : 'leida');
        
        // Optimistic UI
        setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, estado: newStatus } : n));
        
        await supabase.from('notificaciones').update({ estado: newStatus }).in('id', ids);
        refreshCount();
      }
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      fetchNotifications();
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-background rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10 gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center gap-2 px-2">
            <Checkbox checked={notifications.length > 0 && selectedIds.size === notifications.length} onCheckedChange={handleSelectAll} />
            {selectedIds.size > 0 && <span className="text-sm font-medium text-muted-foreground">{selectedIds.size} seleccionados</span>}
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[140px] h-9 border-dashed"><SelectValue placeholder="Filtrar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Recibidos</SelectItem>
              <SelectItem value="unread">No leídos</SelectItem>
              <SelectItem value="archived">Archivados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <AnimatePresence>
            {selectedIds.size > 0 ? (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => performAction(Array.from(selectedIds), 'read')} title="Marcar como leído"><MailOpen className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => performAction(Array.from(selectedIds), 'unread')} title="Marcar como no leído"><Inbox className="h-4 w-4" /></Button>
                <div className="h-4 w-px bg-border mx-1" />
                <Button variant="ghost" size="sm" onClick={() => { setIdsToDelete(Array.from(selectedIds)); setDeleteDialogOpen(true); }} className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </motion.div>
            ) : (
              <Button variant="ghost" size="icon" onClick={fetchNotifications} disabled={loading} title="Actualizar"><RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /></Button>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-background">
        <div className="flex flex-col min-h-[300px]">
          {loading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground/50" /><p className="text-muted-foreground text-sm">Cargando...</p></div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground"><Inbox className="h-12 w-12 opacity-20 mb-2"/><p>No tienes notificaciones</p></div>
          ) : (
            <div className="divide-y divide-border">
              <AnimatePresence initial={false}>
                {notifications.map((notif) => (
                  <NotificationRow key={notif.id} notification={notif} isSelected={selectedIds.has(notif.id)} onSelect={handleSelect} onClick={handleRowClick} onAction={(type, id) => { if(type==='delete'){ setIdsToDelete([id]); setDeleteDialogOpen(true); } else { performAction([id], type === 'toggleRead' ? (notif.estado==='leida'?'unread':'read') : type); } }} processing={processingId} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </ScrollArea>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>¿Eliminar notificaciones?</AlertDialogTitle><AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDeleteDialogOpen(false); setIdsToDelete([]); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await performAction(idsToDelete, 'delete'); setDeleteDialogOpen(false); setIdsToDelete([]); }} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default NotificationCenter;