import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, Layers, Package, BarChart3, History, User, Warehouse, Wrench, Building, ArrowRight, Info, Calculator } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import FileManager from '@/components/FileManager';
import MaterialCrudModal from '@/components/MaterialCrudModal';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const MaterialDetailView = ({ materialId, navigate }) => {
  const { sessionRole } = useAuth();
  const [material, setMaterial] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const canManage = ['admin', 'encargado'].includes(sessionRole?.rol);

  const fetchMaterial = async () => {
    setLoading(true);
    try {
      // 1. Fetch Material Data
      const { data: materialData, error: materialError } = await supabase
        .from('materiales')
        .select('*, proveedores(nombre)')
        .eq('id', materialId)
        .single();

      if (materialError) throw materialError;

      // Manually fetch creator info if created_by exists
      let creatorInfo = { nombre: 'Sistema', email: '' };
      if (materialData.created_by) {
        const { data: creatorData } = await supabase
          .from('empleados')
          .select('nombre, email, apellidos')
          .eq('id', materialData.created_by)
          .single();
        
        if (creatorData) {
          creatorInfo = { 
            nombre: `${creatorData.nombre} ${creatorData.apellidos || ''}`.trim(),
            email: creatorData.email
          };
        }
      }

      // 2. Fetch Requests (Salidas) via View
      // Note: We only count requests that are "gestionada" or "entregada" as actual stock exits for calculation purposes normally,
      // but to show full history we might include pending. However, pending requests strictly speaking haven't reduced stock yet
      // unless we reserved it. For simplicity in this timeline, we will assume 'gestionada'/'entregada' means stock moved.
      const { data: requestsData, error: requestsError } = await supabase
        .from('v_solicitudes_material_detalle_v2')
        .select(`
          solicitud_id,
          fecha_solicitud,
          cantidad,
          unidad,
          estado_solicitud,
          empleado_nombre,
          proyecto_nombre,
          parte_custom_id,
          parte_cliente_nombre,
          tipo,
          preparada,
          preparada_at
        `)
        .eq('material_id', materialId)
        .neq('estado_solicitud', 'cancelada')
        .order('fecha_solicitud', { ascending: true }); // Ascending first to calculate running balance

      if (requestsError) throw requestsError;

      // 3. Build Timeline (Chronological first)
      let timelineEvents = [];

      // A. Initial Creation (Entrada Inicial)
      const initialStock = materialData.stock_inicial || 0; // Default to 0 if null, assuming stock_actual captures it if distinct logic used
      
      // If we have a creation date, that's our first event
      if (materialData.fecha_creacion) {
        timelineEvents.push({
          id: 'creation',
          type: 'entrada',
          subtype: 'creation',
          date: materialData.fecha_creacion,
          quantity: initialStock,
          user: creatorInfo.nombre,
          description: 'Entrada Inicial / Creación',
          destination: 'Almacén',
          icon: Package,
          rawQuantity: initialStock 
        });
      }

      // B. Add Requests (Salidas)
      // Only include items that actually affect stock (prepared/delivered) OR pending ones if we want to show intent.
      // Ideally, only 'preparada' = true items reduce stock in the current logic.
      requestsData.forEach(req => {
        let dest = 'Desconocido';
        let icon = Warehouse; 

        if (req.parte_custom_id) {
           dest = `Parte ${req.parte_custom_id}`;
           if (req.parte_cliente_nombre) dest += ` - ${req.parte_cliente_nombre}`;
           icon = Wrench;
        } else if (req.proyecto_nombre) {
           dest = `Obra: ${req.proyecto_nombre}`;
           icon = Building;
        } else {
           dest = 'Nave / Taller';
           icon = Warehouse;
        }

        // Determining if this event actually reduced stock based on 'preparada' flag or status
        // Usually, the app deducts stock when 'preparada' becomes true.
        const isStockDeducted = req.preparada === true || ['gestionada', 'entregada', 'recibido'].includes(req.estado_solicitud);
        
        timelineEvents.push({
          id: req.solicitud_id,
          type: 'salida',
          subtype: 'request',
          date: req.preparada_at || req.fecha_solicitud, // Use preparation date if available, else request date
          quantity: req.cantidad,
          user: req.empleado_nombre || 'Usuario desconocido',
          description: 'Salida de Stock',
          destination: dest,
          status: req.estado_solicitud,
          icon: icon,
          isStockDeducted: isStockDeducted,
          rawQuantity: -Math.abs(req.cantidad) // Negative for exits
        });
      });

      // Sort chronological to calculate balance
      timelineEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate Running Balance
      let currentBalance = 0;
      
      // If we don't have stock_inicial recorded but we have stock_actual, we might need to back-calculate.
      // But let's assume stock_inicial is the anchor.
      // If stock_inicial is 0 but stock_actual is > 0 and no entries, it means we missed the initial entry or manual adjustments.
      // For this view, we calculate purely based on the events list.
      
      timelineEvents = timelineEvents.map(event => {
        if (event.type === 'entrada') {
            currentBalance += event.rawQuantity;
        } else if (event.type === 'salida' && event.isStockDeducted) {
            currentBalance += event.rawQuantity; // rawQuantity is negative
        }
        return { ...event, runningBalance: currentBalance };
      });

      // Now reverse for display (newest first)
      timelineEvents.reverse();

      setMaterial(materialData);
      setHistory(timelineEvents);

    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo cargar el material o su historial' });
      navigate('/inventario/materiales');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (materialId) {
      fetchMaterial();
    }
  }, [materialId]);

  if (loading) return (
    <div className="flex justify-center items-center h-full p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
  
  if (!material) return null;

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate('/inventario/materiales')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              {material.nombre || material.descripcion}
              {material.codigo && <Badge variant="outline" className="ml-2 font-mono">{material.codigo}</Badge>}
            </h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              {material.categoria && <Badge variant="secondary">{material.categoria}</Badge>}
              <span>Creado el {new Date(material.fecha_creacion).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => setIsEditModalOpen(true)}>
            <Edit className="mr-2 h-4 w-4" /> Editar Material
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Image & Quick Stats */}
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted/30 flex items-center justify-center border relative group">
                {material.foto_url ? (
                  <img src={material.foto_url} alt={material.nombre} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center text-muted-foreground/40">
                    <Layers className="h-16 w-16 mb-2" />
                    <span className="text-sm">Sin imagen</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="h-5 w-5" />
                Estado de Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-2">
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-muted-foreground">Stock Actual</span>
                <span className="font-bold text-2xl text-primary">
                  {material.stock_actual} <span className="text-base font-normal text-muted-foreground">{material.unidad_medida}</span>
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-muted-foreground">Precio Coste</span>
                <span className="font-medium">
                  {material.precio_coste ? `${Number(material.precio_coste).toFixed(2)} €` : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center border-b pb-3">
                <span className="text-muted-foreground">Stock Inicial</span>
                <span className="font-medium text-muted-foreground">
                  {material.stock_inicial !== null ? material.stock_inicial : '-'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Details & Timeline */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Información Detallada
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Nombre / Descripción Corta</h4>
                  <p className="text-base">{material.nombre || '-'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Categoría</h4>
                  <p className="text-base">{material.categoria || '-'}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Proveedor</h4>
                  <p className="text-base">
                    {material.proveedores?.nombre ? (
                      <span className="text-primary font-medium cursor-pointer hover:underline" onClick={() => navigate(`/crm/proveedores/${material.proveedor_id}`)}>
                        {material.proveedores.nombre}
                      </span>
                    ) : (
                      <span className="text-muted-foreground italic">No asignado</span>
                    )}
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Descripción Completa</h4>
                <div className="bg-muted/20 p-3 rounded-md border text-sm whitespace-pre-wrap">
                  {material.descripcion || 'Sin descripción detallada.'}
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Observaciones / Notas Internas</h4>
                <div className="bg-muted/20 p-3 rounded-md border text-sm whitespace-pre-wrap min-h-[60px]">
                  {material.observaciones || 'Sin observaciones.'}
                </div>
              </div>
            </CardContent>
          </Card>

           {/* --- HISTORY TIMELINE --- */}
           <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historial de Movimientos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No hay movimientos registrados para este material.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 dark:border-slate-800 ml-3 space-y-8 py-2">
                  {history.map((item, idx) => (
                    <div key={`${item.type}-${item.id}-${idx}`} className="relative pl-8 group">
                      {/* Timeline Dot */}
                      <span className={`
                        absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center z-10
                        ${item.type === 'entrada' ? 'border-green-500 bg-green-50' : 'border-blue-500 bg-blue-50'}
                      `}>
                         <span className={`h-1.5 w-1.5 rounded-full ${item.type === 'entrada' ? 'bg-green-500' : 'bg-blue-500'}`} />
                      </span>
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 p-3 rounded-lg hover:bg-muted/30 transition-colors border border-transparent hover:border-border">
                        <div className="space-y-2 flex-1">
                          {/* Header Row */}
                          <div className="flex flex-wrap items-center gap-2">
                             <Badge variant={item.type === 'entrada' ? "success" : "secondary"} className="text-xs px-2 py-0.5 h-6">
                               {item.type === 'entrada' ? 'ENTRADA' : 'SALIDA'}
                             </Badge>
                             <span className="font-semibold text-sm">{item.description}</span>
                             
                             <div className="flex items-center gap-2 ml-auto sm:ml-2">
                                <Badge variant="outline" className={`font-mono text-sm ${item.type === 'entrada' ? 'text-green-600 border-green-200 bg-green-50' : 'text-blue-600 border-blue-200 bg-blue-50'}`}>
                                  {item.type === 'entrada' ? '+' : '-'}{item.quantity} {material.unidad_medida}
                                </Badge>
                                
                                {item.runningBalance !== undefined && (
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full border">
                                    <Calculator className="w-3 h-3" />
                                    <span>Saldo: <strong>{item.runningBalance}</strong></span>
                                  </div>
                                )}
                             </div>
                          </div>

                          {/* Destination / Details */}
                          <div className="flex items-center gap-2 text-sm text-foreground/80">
                             {item.icon && <item.icon className="w-4 h-4 text-muted-foreground" />}
                             <span className="font-medium">{item.destination}</span>
                          </div>
                          
                          {/* User & Status */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-full">
                               <User className="w-3 h-3" /> 
                               <span className="font-medium">{item.user}</span>
                            </span>
                            
                            {item.status && (
                               <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold border flex items-center gap-1
                                 ${item.status === 'pendiente' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 
                                   item.status === 'aprobada' ? 'bg-green-50 text-green-700 border-green-200' :
                                   item.status === 'gestionada' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                                   item.status === 'entregada' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                   item.status === 'cancelada' ? 'bg-slate-50 text-slate-700 border-slate-200' :
                                   'bg-slate-50 border-slate-200'}
                               `}>
                                 {item.status === 'gestionada' && <ArrowRight className="w-3 h-3" />}
                                 {item.status}
                                 {!item.isStockDeducted && item.type === 'salida' && ' (Reserva)'}
                               </span>
                            )}
                          </div>
                        </div>

                        {/* Date Column */}
                        <div className="text-xs text-muted-foreground sm:text-right shrink-0 min-w-[80px] flex flex-col items-end justify-center">
                           <span className="font-medium text-foreground">{format(new Date(item.date), "d MMM yyyy", { locale: es })}</span>
                           <span className="opacity-70">{format(new Date(item.date), "HH:mm")}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documentación, Manuales y Archivos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-4">
                Sube aquí fichas técnicas, manuales de uso, certificados de calidad u otros documentos relacionados con este material.
              </div>
              <FileManager 
                bucketName="materiales_docs" 
                prefix={material.id} 
                canEdit={canManage} 
                defaultView="list"
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {isEditModalOpen && (
        <MaterialCrudModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          onSuccess={() => {
            fetchMaterial();
            setIsEditModalOpen(false);
          }}
          material={material}
        />
      )}
    </div>
  );
};

export default MaterialDetailView;