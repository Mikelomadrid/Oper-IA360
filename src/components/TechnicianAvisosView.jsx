import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { ClipboardList, CheckCircle2, Loader2, FileArchive, AlertCircle, Clock, Search, Filter, HardHat, Camera } from 'lucide-react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtMadrid } from '@/lib/utils';
import AvisoShareModal from '@/components/AvisoShareModal';
import TechnicianAvisoCard from '@/components/TechnicianAvisoCard';
import PhotoUploadModal from '@/components/PhotoUploadModal';

const TechnicianAvisosView = ({ navigate }) => {
  const { user } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAviso, setSelectedAviso] = useState(null);
  const [currentEmployeeId, setCurrentEmployeeId] = useState(null);
  const [isClosureModalOpen, setIsClosureModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('activos');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // New Photo Logic
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);

  const [closureData, setClosureData] = useState({ descripcion_tecnico: '', cliente_acepta_nombre: '' });

  useEffect(() => {
    if (user) { fetchAvisos(); fetchEmployeeId(); }
  }, [user]);

  const fetchEmployeeId = async () => {
      const { data } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
      if (data) setCurrentEmployeeId(data.id);
  };

  const fetchAvisos = async () => {
    setLoading(true);
    try {
      const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
      if (!empData) throw new Error('Empleado no encontrado');
      const { data, error } = await supabase.from('avisos')
        .select(`*, proyecto:proyectos(nombre_proyecto), tecnico:empleados!avisos_tecnico_asignado_id_fkey(id, nombre, apellidos), creador_interno:empleados!avisos_creador_id_fkey(nombre, apellidos, rol)`)
        .eq('tecnico_asignado_id', empData.id).order('created_at', { ascending: false });
      if (error) throw error;
      setAvisos(data || []);
    } catch (error) { toast({ variant: 'destructive', title: 'Error', description: 'Error al cargar avisos.' }); } 
    finally { setLoading(false); }
  };

  const filteredAvisos = useMemo(() => avisos.filter(a => (statusFilter === 'activos' ? a.estado !== 'cerrado' : true)).filter(a => JSON.stringify(a).toLowerCase().includes(searchTerm.toLowerCase())), [avisos, searchTerm, statusFilter]);

  const handleOpenClosure = (aviso) => {
    setSelectedAviso(aviso);
    setClosureData({ descripcion_tecnico: '', cliente_acepta_nombre: aviso.cliente_nombre || '' });
    setUploadedFiles([]);
    setIsClosureModalOpen(true);
  };

  const handlePhotosSelected = (files) => {
      setUploadedFiles(files);
      setIsPhotoModalOpen(false);
  };

  const handleSubmitClosure = async () => {
    if (!closureData.descripcion_tecnico.trim() || !closureData.cliente_acepta_nombre.trim()) {
      toast({ variant: "destructive", title: "Falta información", description: "Descripción y nombre son obligatorios." });
      return;
    }
    setIsSubmitting(true);
    try {
      // 1. Upload Photos
      for (const file of uploadedFiles) {
          const fileName = `avisos/${selectedAviso.id}_${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from('avisos_fotos').upload(fileName, file);
          if (upErr) throw upErr;
          
          const { data: urlData } = supabase.storage.from('avisos_fotos').getPublicUrl(fileName);
          
          await supabase.from('avisos_archivos').insert({
              aviso_id: selectedAviso.id,
              archivo_url: urlData.publicUrl,
              nombre_archivo: file.name,
              tipo_archivo: file.type,
              subido_por: currentEmployeeId
          });
      }

      // 2. Close Aviso
      await supabase.from('avisos').update({
          estado: 'cerrado',
          fecha_cierre: new Date().toISOString(),
          descripcion_tecnico: closureData.descripcion_tecnico,
          cliente_acepta_nombre: closureData.cliente_acepta_nombre
      }).eq('id', selectedAviso.id);

      toast({ title: "Aviso cerrado" });
      setIsClosureModalOpen(false);
      fetchAvisos();
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "No se pudo cerrar el aviso." });
    } finally { setIsSubmitting(false); }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold flex items-center gap-2"><ClipboardList className="w-8 h-8"/> Mis Avisos</h1>
        <div className="flex gap-4">
            <Input placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} className="max-w-md"/>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado"/></SelectTrigger>
                <SelectContent><SelectItem value="activos">Activos</SelectItem><SelectItem value="todos">Todos</SelectItem></SelectContent>
            </Select>
        </div>

        {loading ? <div className="text-center py-12"><Loader2 className="animate-spin inline"/></div> : (
            <div className="space-y-4">
                {filteredAvisos.map(aviso => (
                    <TechnicianAvisoCard key={aviso.id} aviso={aviso} onOpenClosure={handleOpenClosure} currentEmployeeId={currentEmployeeId}/>
                ))}
            </div>
        )}

        <Dialog open={isClosureModalOpen} onOpenChange={setIsClosureModalOpen}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader><DialogTitle>Cerrar Aviso</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <Label>Descripción del trabajo</Label>
                    <Textarea value={closureData.descripcion_tecnico} onChange={e=>setClosureData(p=>({...p, descripcion_tecnico:e.target.value}))}/>
                    
                    <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/10" onClick={() => setIsPhotoModalOpen(true)}>
                        {uploadedFiles.length > 0 ? (
                            <div className="text-green-600 font-medium flex items-center justify-center gap-2"><CheckCircle2/> {uploadedFiles.length} fotos listas</div>
                        ) : (
                            <><Camera className="mx-auto h-6 w-6 text-muted-foreground"/><span className="text-sm">Adjuntar Fotos</span></>
                        )}
                    </div>

                    <Label>Nombre Cliente</Label>
                    <Input value={closureData.cliente_acepta_nombre} onChange={e=>setClosureData(p=>({...p, cliente_acepta_nombre:e.target.value}))}/>
                </div>
                <DialogFooter><Button variant="ghost" onClick={()=>setIsClosureModalOpen(false)}>Cancelar</Button><Button onClick={handleSubmitClosure} disabled={isSubmitting}>Confirmar</Button></DialogFooter>
            </DialogContent>
        </Dialog>

        <PhotoUploadModal isOpen={isPhotoModalOpen} onClose={()=>setIsPhotoModalOpen(false)} onPhotosSelected={handlePhotosSelected} />
    </div>
  );
};

export default TechnicianAvisosView;