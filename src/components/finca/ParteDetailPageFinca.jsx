import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Trash2, Calendar, Wrench, AlertTriangle, Loader2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from "@/components/ui/use-toast";
import html2pdf from 'html2pdf.js';
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
import ParteFormFinca from './ParteFormFinca';

const fetchWithTimeout = (promise, ms) => {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error('Request timed out'));
        }, ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export default function ParteDetailPageFinca() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loadingAuth } = useAuth();
  const { toast } = useToast();

  const [parte, setParte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [projects, setProjects] = useState([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [currentUserEmployeeId, setCurrentUserEmployeeId] = useState(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  useEffect(() => {
    const fetchProjects = async () => {
        try {
            const { data } = await supabase.from('proyectos').select('id, nombre_proyecto');
            setProjects(data || []);
        } catch (err) {
            console.error("Error fetching projects:", err);
        }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchEmp = async () => {
      if (!user) return;
      const { data } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
      if (data) setCurrentUserEmployeeId(data.id);
    };
    fetchEmp();
  }, [user]);

  const fetchParte = async () => {
    if (loadingAuth) return;
    if (!currentUserEmployeeId) return; // Wait for employee ID

    if (!user) {
        setLoading(false);
        setErrorMsg("Debes iniciar sesión.");
        return;
    }
    if (!id) {
        setLoading(false);
        setErrorMsg("ID de parte no válido.");
        return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const queryPromise = supabase
        .from('finca_partes_trabajo')
        .select('*')
        .eq('id', id)
        .eq('created_by', currentUserEmployeeId)
        .single();

      const { data: parteData, error: parteError } = await fetchWithTimeout(queryPromise, 10000);

      if (parteError) {
          if (parteError.code === 'PGRST116') {
              throw new Error("El parte no existe o no tienes permisos para verlo.");
          }
          throw parteError;
      }

      if (!parteData) {
          throw new Error("Parte no encontrado.");
      }

      let projectData = null;
      if (parteData.propiedad_id) {
          try {
              const { data: pData } = await supabase
                .from('proyectos')
                .select('nombre_proyecto')
                .eq('id', parteData.propiedad_id)
                .single();
              projectData = pData;
          } catch (projErr) {
              console.warn("Error fetching project name (non-critical):", projErr);
          }
      }

      setParte({
          ...parteData,
          proyecto: projectData
      });

    } catch (error) {
      console.error("Detailed Fetch Error:", error);
      let msg = error.message || "Error desconocido al cargar el parte.";
      
      if (msg === 'Request timed out') {
          msg = "La solicitud tardó demasiado.";
      }
      
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParte();
  }, [id, currentUserEmployeeId, loadingAuth]);

  const handleUpdate = async (formData) => {
    if (!currentUserEmployeeId) return;
    
    try {
        const { error } = await supabase
            .from('finca_partes_trabajo')
            .update({ 
                ...formData, 
                estado: formData.estado ? formData.estado.toLowerCase() : undefined,
                updated_at: new Date() 
            })
            .eq('id', id)
            .eq('created_by', currentUserEmployeeId); 
        
        if (error) throw error;
        
        toast({ title: "Actualizado", description: "Parte actualizado correctamente." });
        setIsEditing(false);
        fetchParte();
    } catch (error) {
        console.error("Update error:", error);
        toast({ variant: "destructive", title: "Error", description: "Fallo al actualizar el parte." });
    }
  };

  const handleDelete = async () => {
    if (!currentUserEmployeeId) return;

    try {
        const { error } = await supabase
            .from('finca_partes_trabajo')
            .delete()
            .eq('id', id)
            .eq('created_by', currentUserEmployeeId);
            
        if (error) throw error;
        
        toast({ title: "Eliminado", description: "Parte eliminado correctamente." });
        navigate('/gestion/partes-finca');
    } catch (error) {
        console.error("Delete error:", error);
        toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el parte." });
    }
  };

  const handleDownloadPDF = async () => {
      setGeneratingPdf(true);
      const element = document.getElementById('finca-parte-pdf-template');
      const opt = {
          margin: [10, 10, 10, 10], 
          filename: `Parte_Finca_${id.slice(0,8)}.pdf`,
          image: { type: 'jpeg', quality: 0.98 }, 
          html2canvas: { 
              scale: 2, 
              useCORS: true, 
              logging: false,
              scrollY: 0, 
              windowWidth: element.scrollWidth 
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      try {
          await html2pdf().set(opt).from(element).save();
          toast({ title: "PDF Descargado", description: "El documento se ha generado correctamente." });
      } catch (e) {
          console.error("PDF Error:", e);
          toast({ variant: "destructive", title: "Error PDF", description: "No se pudo generar el PDF." });
      } finally {
          setGeneratingPdf(false);
      }
  };

  const getStatusBadge = (status) => {
    const map = {
        contactado: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200", dot: "bg-blue-500" },
        agendada_visita: { bg: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-200", dot: "bg-indigo-500" },
        visitado: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200", dot: "bg-purple-500" },
        en_preparacion: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200", dot: "bg-amber-500" },
        presupuestado: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200", dot: "bg-orange-500" },
        aceptado: { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200", dot: "bg-emerald-500" },
        cerrado: { bg: "bg-slate-800", text: "text-white", border: "border-slate-900", dot: "bg-slate-600" }, // Added for consistency
        completado: { bg: "bg-green-700", text: "text-white", border: "border-green-800", dot: "bg-green-500" }, // Added for consistency
    };
    
    const normalizedStatus = status ? status.toLowerCase() : 'desconocido';
    const style = map[normalizedStatus] || { bg: "bg-gray-100", text: "text-gray-800", border: "border-gray-200", dot: "bg-gray-500" };
    
    const label = normalizedStatus.replace(/_/g, ' ').toUpperCase();
    
    return (
        <Badge variant="secondary" className={`text-sm px-3 py-1 flex items-center gap-2 ${style.bg} ${style.text} ${style.border} border`}>
            <span className={`w-2 h-2 rounded-full ${style.dot}`}></span>
            {label}
        </Badge>
    );
  };

  if (loading || loadingAuth || !currentUserEmployeeId) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Cargando detalles del parte...</p>
        </div>
      );
  }

  if (errorMsg) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 space-y-6 text-center">
            <div className="bg-destructive/10 p-4 rounded-full">
                <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
                <h3 className="text-lg font-semibold">No se pudo cargar el parte</h3>
                <p className="text-muted-foreground max-w-md mx-auto">{errorMsg}</p>
            </div>
            <Button onClick={() => navigate('/gestion/partes-finca')} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" /> Volver al listado
            </Button>
        </div>
      );
  }

  // Check if status is effectively closed/completed for Finca context
  const isClosed = ['aceptado', 'completado', 'cerrado'].includes(parte.estado?.toLowerCase());

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 relative">
      <Button variant="ghost" onClick={() => navigate('/gestion/partes-finca')} className="gap-2 pl-0 hover:pl-2 transition-all">
        <ArrowLeft className="h-4 w-4" /> Volver a mis partes
      </Button>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold text-foreground">{parte.titulo}</h1>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground text-sm">
                <Wrench className="h-4 w-4" />
                <span>Creado el {format(new Date(parte.created_at), 'd MMM yyyy', { locale: es })}</span>
            </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto flex-wrap">
            {isClosed && (
                <Button 
                    onClick={handleDownloadPDF} 
                    disabled={generatingPdf}
                    className="bg-blue-600 hover:bg-blue-700 text-white border border-blue-700 shadow-sm px-3 h-9 md:w-auto flex-none" // Adjusted classes for narrower button
                    size="sm" // Use small size to reduce padding
                >
                    {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-1" />}
                    PARTE
                </Button>
            )}
            
            <Button 
                variant="outline" 
                onClick={() => setIsEditing(!isEditing)}
                className="flex-1 md:flex-none"
            >
                {isEditing ? 'Cancelar' : 'Editar'}
            </Button>
            <Button 
                variant="destructive" 
                size="icon" 
                onClick={() => setDeleteOpen(true)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
      </div>

      {isEditing ? (
          <Card className="border-primary/20 shadow-lg">
              <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="text-lg">Editar Parte</CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                  <ParteFormFinca 
                    initialData={parte} 
                    onSubmit={handleUpdate} 
                    projects={projects} 
                  />
              </CardContent>
          </Card>
      ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-6">
                  <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-lg">Descripción</CardTitle></CardHeader>
                      <CardContent>
                          {parte.descripcion ? (
                              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                                  {parte.descripcion}
                              </p>
                          ) : (
                              <p className="text-sm text-muted-foreground italic">Sin descripción detallada.</p>
                          )}
                      </CardContent>
                  </Card>
              </div>
              <div className="space-y-6">
                  <Card>
                      <CardHeader className="pb-3"><CardTitle className="text-lg">Información</CardTitle></CardHeader>
                      <CardContent className="space-y-5">
                          <div>
                              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Estado</span>
                              <div className="mt-1.5">{getStatusBadge(parte.estado)}</div>
                          </div>
                          <div>
                              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Prioridad</span>
                              <div className="mt-1.5"><Badge variant="outline" className="text-sm border-foreground/20">{parte.prioridad.toUpperCase()}</Badge></div>
                          </div>
                          <div>
                              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Propiedad / Obra</span>
                              <div className="mt-1 font-medium text-foreground">
                                  {parte.proyecto?.nombre_proyecto || <span className="text-muted-foreground italic">No asignada</span>}
                              </div>
                          </div>
                          {parte.fecha_seguimiento && (
                              <div>
                                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Próximo Seguimiento</span>
                                  <div className="mt-1.5 flex items-center gap-2 p-2 bg-muted/50 rounded-md border text-sm">
                                      <Calendar className="h-4 w-4 text-primary" />
                                      {format(new Date(parte.fecha_seguimiento), 'dd/MM/yyyy')}
                                  </div>
                              </div>
                          )}
                      </CardContent>
                  </Card>
              </div>
          </div>
      )}

      {/* Hidden PDF Template for Finca Admin */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
          <div id="finca-parte-pdf-template" className="w-[190mm] bg-white p-4 text-black font-sans text-xs leading-normal">
              <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
                  <div className="w-1/2">
                      <h1 className="text-xl font-bold tracking-widest mb-1">ORKALED INSTALACIONES SLU</h1>
                      <p className="text-[10px] text-gray-600">B88219837</p>
                      <p className="text-[10px] text-gray-600 mt-1">C/Deva 8 - 28041 - Madrid</p>
                      <p className="text-[10px] text-gray-600">Tfno: 913414682 | info@orkaled.com</p>
                  </div>
                  <div className="text-right w-1/2">
                      <h2 className="text-lg font-bold uppercase">Solicitud / Parte</h2>
                      <p className="text-base font-mono text-gray-700 mt-1">#{parte.id.substring(0,8)}</p>
                      <p className="text-[10px] mt-1">Fecha: <strong>{format(new Date(parte.created_at), 'dd/MM/yyyy')}</strong></p>
                      <div className="mt-2 inline-block px-3 py-1 border border-black text-[10px] font-bold uppercase">
                          {parte.estado}
                      </div>
                  </div>
              </div>

              <div className="mb-6">
                  <div className="border p-3">
                      <h3 className="font-bold border-b border-gray-300 pb-1 mb-2 text-[10px] uppercase">Detalles de la Solicitud</h3>
                      <div className="text-[10px] space-y-2">
                          <p><span className="text-gray-500 font-bold">Título:</span><br/>{parte.titulo}</p>
                          <p><span className="text-gray-500 font-bold">Propiedad / Obra:</span><br/>
                              {parte.proyecto?.nombre_proyecto || 'No asignada'}
                          </p>
                          <p><span className="text-gray-500 font-bold">Prioridad:</span><br/>{parte.prioridad?.toUpperCase()}</p>
                          {parte.fecha_seguimiento && (
                              <p><span className="text-gray-500 font-bold">Fecha Seguimiento:</span><br/>{format(new Date(parte.fecha_seguimiento), 'dd/MM/yyyy')}</p>
                          )}
                      </div>
                  </div>
              </div>

              <div className="mb-6">
                  <h3 className="font-bold bg-gray-100 p-2 text-[10px] uppercase border-t border-l border-r border-black">Descripción</h3>
                  <div className="border border-black p-3 text-[10px] min-h-[40mm]">
                      <p className="whitespace-pre-wrap">{parte.descripcion || 'Sin descripción detallada.'}</p>
                  </div>
              </div>

              <div className="mt-10 pt-4 border-t border-gray-300 text-center text-[9px] text-gray-500">
                  <p>Documento generado electrónicamente por Orkaled ERP el {format(new Date(), 'dd/MM/yyyy HH:mm')}.</p>
              </div>
          </div>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente este parte de trabajo. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                Eliminar Parte
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}