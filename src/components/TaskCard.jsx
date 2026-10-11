import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Pencil, Trash2, CheckCircle, Camera, MessageCircle as MessageCircleWarning, UserCheck, Lock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/lib/customSupabaseClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const TaskCard = ({ 
  task, 
  canManage, 
  currentEmployeeId, 
  isAccessible = true, // ✅ NUEVO PROP
  onCardClick, 
  onEdit, 
  onDelete, 
  onRevisar, 
  onShowEvidences 
}) => {
  const { subtareas, ultima_revision, subtareas_completadas, total_subtareas } = task;
  const [thumbnails, setThumbnails] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);

  const completedCount = subtareas_completadas || 0;
  const totalCount = total_subtareas || 0;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const isTaskInReviewOrCompleted = task.estado === 'pendiente_revision' || task.estado === 'completada' || task.estado === 'completada_validada';

  const isRejected = useMemo(() => {
    return task.estado === 'en_progreso' && ultima_revision && ultima_revision.aprobado === false;
  }, [task.estado, ultima_revision]);

  const isAssignedToMe = currentEmployeeId &&
    (task.empleado_asignado_id === currentEmployeeId ||
      (task.asignados && task.asignados.some(a => a.empleado_id === currentEmployeeId)));
  
  // ✅ MODIFICADO: Solo es clickable si es accesible
  const isClickable = isAccessible && (!canManage || isAssignedToMe);

  // Fetch thumbnails if evidences exist
  useEffect(() => {
    let isMounted = true;
    if (task.evidencias_count > 0) {
      const fetchThumbnails = async () => {
        const { data } = await supabase.rpc('get_evidencias_por_tarea', { p_tarea_id: task.id });
        if (data && isMounted) {
          // Process first 3 images for thumbnails with signed URLs
          const processed = await Promise.all(data
            .slice(0, 4) // Limit to 4 to fetch
            .map(async (ev) => {
              const pathOrUrl = ev.archivo_path || ev.archivo_url;
              if (!pathOrUrl) return null;

              let url = pathOrUrl;
              // Handle stored paths from proyecto_fotos bucket
              if (pathOrUrl.startsWith('proyecto_fotos/')) {
                const relativePath = pathOrUrl.replace(/^proyecto_fotos\//, '');
                const { data: signedData } = await supabase.storage
                  .from('proyecto_fotos')
                  .createSignedUrl(relativePath, 3600); // 1h expiry

                if (signedData?.signedUrl) {
                  url = signedData.signedUrl;
                }
              }

              // Check if it looks like an image
              const isImage = url.match(/\.(jpg|jpeg|png|webp|gif)/i) || url.includes('token='); // Token indicates signed URL likely for img
              return isImage ? { id: ev.evidencia_id, url } : null;
            }));

          if (isMounted) {
            setThumbnails(processed.filter(Boolean));
          }
        }
      };
      fetchThumbnails();
    }
    return () => { isMounted = false; };
  }, [task.evidencias_count, task.id]);

  const getStatusBadge = (status) => {
    if (isRejected) {
      return <Badge variant="destructive" className="border-destructive text-destructive-foreground">Rechazada</Badge>;
    }
    switch (status) {
      case 'en_progreso':
        return <Badge variant="outline" className="border-blue-500 text-blue-500">En Progreso</Badge>;
      case 'pendiente_revision':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-500">Pendiente Revisión</Badge>;
      case 'completada':
      case 'completada_validada':
        return <Badge variant="outline" className="border-green-500 text-green-500">Completada</Badge>;
      default:
        return <Badge variant="secondary">Pendiente</Badge>;
    }
  };

  const progressText = useMemo(() => {
    if (totalCount === 0) {
      return 'Sin subtareas';
    }
    return `${completedCount}/${totalCount}`;
  }, [completedCount, totalCount]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card
        className={cn(
          "overflow-hidden transition-all flex flex-col h-full relative",
          isTaskInReviewOrCompleted ? 'bg-muted/30' : 'bg-card',
          isClickable ? 'cursor-pointer hover:border-primary/50' : '',
          // ✅ NUEVO: Estilos para tarjeta bloqueada
          !isAccessible && !canManage && 'grayscale opacity-60 cursor-not-allowed'
        )}
        onClick={isClickable ? onCardClick : (!isAccessible ? onCardClick : undefined)}
      >
        {/* ✅ NUEVO: Overlay de bloqueo */}
        {!isAccessible && !canManage && (
          <div className="absolute inset-0 bg-slate-900/5 dark:bg-slate-900/20 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 dark:bg-slate-800/90 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-sm border">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {!task.fecha_inicio_real ? 'No iniciada' : 'Otra obra'}
              </span>
            </div>
          </div>
        )}

        <CardHeader className="pb-3">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <CardTitle className={cn(
                "text-lg leading-snug",
                !isAccessible && !canManage && "text-muted-foreground"
              )}>
                {task.titulo}
              </CardTitle>
              <p className="text-xs text-muted-foreground line-clamp-1 font-medium">{task.nombre_proyecto}</p>
              {isAssignedToMe && canManage && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 mt-1 w-fit flex items-center gap-1 text-[10px] px-1.5 h-5">
                  <UserCheck className="w-3 h-3" /> Asignada a mí
                </Badge>
              )}
            </div>
            <div className="flex flex-col items-end gap-1">
              {getStatusBadge(task.estado)}
            </div>
          </div>
          {isRejected && !canManage && (
            <Alert variant="destructive" className="mt-2 py-2">
              <MessageCircleWarning className="h-4 w-4" />
              <AlertTitle className="text-sm font-semibold">Rechazada</AlertTitle>
              <AlertDescription className="text-xs mt-1">
                {ultima_revision?.comentario || 'Ver detalles'}
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        <CardContent className="flex-grow flex flex-col gap-3">
          {/* Description and Assignees */}
          <div className="flex justify-between items-start gap-4">
            <p className="text-sm text-muted-foreground line-clamp-2 flex-1">
              {task.descripcion || "Sin descripción adicional"}
            </p>

            {/* Assignee Avatars with Hover Effect */}
            {task.asignados && task.asignados.length > 0 && (
              <div className="flex -space-x-2 shrink-0 h-8 items-center pr-2 flex-wrap max-w-[50%] justify-end">
                {task.asignados.map((a, idx) => (
                  <div
                    key={a.empleado_id}
                    className="relative cursor-help"
                    style={{ zIndex: 10 + idx }}
                    title={a.empleado_nombre || "Técnico"}
                  >
                    <Avatar className="w-7 h-7 border-2 border-background shadow-sm ring-1 ring-slate-200/50">
                      {a.foto_url ? (
                        <img src={a.foto_url} alt={a.empleado_nombre} className="w-full h-full object-cover" />
                      ) : (
                        <AvatarFallback className="text-[8px] bg-slate-100 font-bold">
                          {(a.empleado_nombre?.substring(0, 2) || "SA").toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Thumbnails Gallery */}
          {thumbnails.length > 0 && (
            <div className="flex gap-2 overflow-hidden mt-1">
              {thumbnails.map((thumb) => (
                <button
                  key={thumb.id}
                  onClick={(e) => { e.stopPropagation(); setSelectedImage(thumb.url); }}
                  className="h-12 w-12 rounded bg-muted border overflow-hidden shrink-0 relative group"
                >
                  <img
                    src={thumb.url}
                    alt="Evidence"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="text-white w-4 h-4" />
                  </div>
                </button>
              ))}
              {task.evidencias_count > thumbnails.length && (
                <div className="h-12 w-12 rounded bg-muted border flex items-center justify-center text-xs text-muted-foreground shrink-0"
                  title={`${task.evidencias_count - thumbnails.length} foto(s) más no mostradas en miniatura`}
                >
                  +{task.evidencias_count - thumbnails.length}
                </div>
              )}
            </div>
          )}

          {/* Lightbox Modal (Full-Size Image Viewer) */}
          <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
            <DialogContent className="max-w-5xl p-2 bg-black/95 border-none shadow-2xl overflow-hidden rounded-xl flex items-center justify-center z-[10000]">
              <DialogTitle className="sr-only">Previsualización de Foto</DialogTitle>
              {selectedImage && (
                <img
                  src={selectedImage}
                  alt="Evidencia en grande"
                  className="w-full h-auto max-h-[85vh] object-contain rounded-lg pointer-events-none"
                />
              )}
            </DialogContent>
          </Dialog>

          <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto pt-2">
            <span>Progreso</span>
            <span>{progressText}</span>
          </div>
          {totalCount > 0 && (
            <Progress value={progress} className="h-1.5" />
          )}
        </CardContent>
        {canManage && (
          <CardFooter className="bg-muted/20 p-2 justify-between gap-2 border-t">
            <div className="flex gap-2 flex-1">
              {task.estado === 'pendiente_revision' ? (
                <Button size="sm" className="flex-1 h-8 text-xs" onClick={(e) => { e.stopPropagation(); onRevisar(task); }}>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                  Validar
                </Button>
              ) : task.evidencias_count > 0 ? (
                <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs bg-white hover:bg-slate-100 border shadow-sm" onClick={(e) => { e.stopPropagation(); onShowEvidences(task); }}>
                  <Camera className="mr-1.5 h-3.5 w-3.5" />
                  Evidencias
                </Button>
              ) : (
                <span className="text-[10px] text-muted-foreground italic pl-1 self-center">Sin evidencias</span>
              )}
            </div>

            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(task); }}><Pencil className="h-3.5 w-3.5" /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={(e) => e.stopPropagation()}><Trash2 className="h-3.5 w-3.5" /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>¿Eliminar Tarea?</AlertDialogTitle></AlertDialogHeader>
                  <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(task.id)}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardFooter>
        )}
      </Card>
    </motion.div>
  );
};

export default TaskCard;
