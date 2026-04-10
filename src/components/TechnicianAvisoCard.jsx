import React, { useState } from 'react';
import { 
  Calendar, 
  User, 
  HardHat, 
  PenTool, 
  Loader2, 
  UploadCloud, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  MessageSquare,
  Phone
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { fmtMadrid } from '@/lib/utils';
import FotoEvidencia from '@/components/FotoEvidencia';

const TechnicianAvisoCard = ({ aviso, onOpenClosure, currentEmployeeId }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [comment, setComment] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSendingComment, setIsSendingComment] = useState(false);

  const getStatusBadge = (status) => {
    const s = status?.toLowerCase() || 'pendiente';
    switch (s) {
        case 'cerrado': return <Badge className="bg-green-100 text-green-800 hover:bg-green-200 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Completado</Badge>;
        case 'en_curso': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200"><Clock className="w-3 h-3 mr-1" /> En Curso</Badge>;
        default: return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-200"><AlertCircle className="w-3 h-3 mr-1" /> Pendiente</Badge>;
    }
  };

  const getCreatorShortName = (aviso) => {
    if (aviso.creador_interno) {
        if (aviso.creador_interno.nombre === 'Administracion') {
            return 'ATC';
        }
        return aviso.creador_interno.nombre || 'N/A';
    }
    return aviso.creador_rol || 'Sistema';
  };

  const handleUploadFile = async () => {
    if (!selectedFile) return;
    if (!currentEmployeeId) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo identificar al empleado." });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `avisos/${aviso.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
          .from('avisos-files')
          .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
      const fileUrl = urlData.publicUrl;

      // 1. Registrar en tabla de archivos
      await supabase.from('avisos_archivos').insert({
          aviso_id: aviso.id,
          archivo_url: fileUrl,
          nombre_archivo: selectedFile.name,
          tipo_archivo: selectedFile.type,
          subido_por: currentEmployeeId
      });

      // 2. Insertar en bitácora
      const fileContent = JSON.stringify({
          url: fileUrl,
          name: selectedFile.name,
          type: selectedFile.type,
          comment: "Evidencia subida desde listado móvil"
      });
      
      await supabase.from('avisos_comentarios').insert({
          aviso_id: aviso.id,
          usuario_id: currentEmployeeId,
          contenido: fileContent,
          tipo: 'archivo',
          fecha_creacion: new Date().toISOString()
      });

      toast({ title: "Archivo subido", description: "La evidencia se ha guardado correctamente." });
      setSelectedFile(null);

    } catch (error) {
      console.error('Error subiendo archivo:', error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo subir el archivo." });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendComment = async () => {
    if (!comment.trim()) return;
    if (!currentEmployeeId) return;

    setIsSendingComment(true);
    try {
      await supabase.from('avisos_comentarios').insert({
          aviso_id: aviso.id,
          usuario_id: currentEmployeeId,
          contenido: comment.trim(),
          tipo: 'comentario',
          fecha_creacion: new Date().toISOString()
      });

      toast({ title: "Comentario enviado", description: "Se ha registrado tu actualización." });
      setComment('');
    } catch (error) {
      console.error('Error enviando comentario:', error);
      toast({ variant: "destructive", title: "Error", description: "No se pudo enviar el comentario." });
    } finally {
      setIsSendingComment(false);
    }
  };

  return (
    <Card className="shadow-sm border-l-4 border-l-primary/20">
      <CardHeader className="flex-row justify-between items-start pb-2 px-4 pt-4">
           <CardTitle className="text-sm font-medium">
              <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary"/>
                  <span>{fmtMadrid(aviso.created_at, 'datetime')}</span>
              </div>
           </CardTitle>
           {getStatusBadge(aviso.estado)}
      </CardHeader>
      
      <CardContent className="px-4 py-2 space-y-4">
          <div>
            <p className="font-semibold text-foreground text-base mb-1">{aviso.direccion_servicio}</p>
            <div className="text-sm text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-primary/70"/>
                    <span>Creado por: <span className="font-medium">{getCreatorShortName(aviso)}</span></span>
                </div>
                
                {/* Client Info Section with Contact Person */}
                <div className="space-y-1 pt-1">
                    <div className="flex items-center gap-2">
                        <User className="w-3 h-3 text-primary/70" />
                        <span>Cliente: <span className="font-medium">{aviso.cliente_nombre || 'N/A'}</span></span>
                    </div>
                    
                    {(aviso.persona_contacto || aviso.telefono_contacto) && (
                        <div className="ml-5 flex flex-col gap-1 text-xs border-l-2 border-primary/10 pl-2 mt-1">
                            {aviso.persona_contacto && (
                                <div className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Contacto:</span>
                                    <span className="font-medium text-foreground">{aviso.persona_contacto}</span>
                                </div>
                            )}
                            {aviso.telefono_contacto && (
                                <div className="flex items-center gap-1">
                                    <Phone className="w-3 h-3 text-green-600" />
                                    <a 
                                        href={`tel:${aviso.telefono_contacto}`} 
                                        className="font-medium text-green-700 hover:underline"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {aviso.telefono_contacto}
                                    </a>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            <div className="mt-2 p-2 bg-muted/30 rounded text-xs text-muted-foreground italic border border-dashed">
               {aviso.descripcion_solicitud}
            </div>
          </div>

          {/* Sección 1 & 2: Evidencias */}
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Evidencias</p>
            <FotoEvidencia 
              onFotoCapturada={setSelectedFile} 
              currentFile={selectedFile}
              className="min-h-[100px]"
            />
            {selectedFile && (
              <Button 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
                onClick={handleUploadFile}
                disabled={isUploading}
              >
                {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2"/> : <UploadCloud className="w-4 h-4 mr-2" />}
                Subir Archivo
              </Button>
            )}
          </div>

          {/* Sección 3: Actualización Texto */}
          <div className="space-y-2 pt-2 border-t">
             <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Comentarios</p>
             <div className="flex gap-2">
                <Textarea 
                  placeholder="Escribe una actualización..." 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[40px] h-[40px] resize-none py-2 text-sm"
                />
                <Button 
                  size="icon" 
                  className="h-[40px] w-[40px] shrink-0" 
                  onClick={handleSendComment}
                  disabled={isSendingComment || !comment.trim()}
                >
                   {isSendingComment ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4" />}
                </Button>
             </div>
          </div>

      </CardContent>

      <CardFooter className="p-4 pt-2">
        {/* Sección 4: Cerrar Aviso */}
        {aviso.estado !== 'cerrado' && (
          <Button 
            className="w-full bg-slate-900 text-white hover:bg-slate-800" 
            size="lg"
            onClick={(e) => { e.stopPropagation(); onOpenClosure(aviso); }}
          >
            <PenTool className="w-4 h-4 mr-2"/>
            Cerrar Aviso
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default TechnicianAvisoCard;