import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { useLocation } from 'react-router-dom';
import {
  Loader2, Save, Scan, ArrowLeft, UploadCloud, Camera,
  Trash2, FileText, Plus, Pencil, Check, X, Package, AlertCircle,
  Building2, CircleDollarSign, ListChecks, Warehouse, RotateCcw
} from 'lucide-react';
import { analyzeInvoice } from '@/lib/openaiService';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ProviderSelect } from '@/components/ProviderSelect';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { validateSpanishTaxId } from '@/lib/spanishTaxId';
import { createReceivedInvoice } from '@/services/contasimpleInvoiceService';
import {
  PURCHASE_DOCUMENT_TYPES,
  buildInternalTicketNumber,
  classifyPurchaseDocument,
} from '@/lib/purchaseDocumentType';
import InvoiceLineDistribution, {
  buildDefaultAssignments,
  DestinationSelect,
  destinoObra,
  parseDestino,
} from '@/components/InvoiceLineDistribution';

const CATEGORIAS = ['electricidad', 'fontanería', 'pintura', 'albañilería', 'herramientas', 'materiales', 'otro'];
const UNIDADES = ['ud', 'm', 'm2', 'm3', 'kg', 'l', 'h', 'caja', 'rollo', 'pack'];
const CONTASIMPLE_PAYMENT_METHODS = [
  { id: '495834', name: 'Efectivo' },
  { id: '118408', name: 'Tarjeta MIGUEL' },
  { id: '1149112', name: 'Tarjeta débito MIGUEL' },
  { id: '1198714', name: 'Tarjeta FRAN' },
  { id: '1198715', name: 'Tarjeta ISRA' },
  { id: '1198742', name: 'Tarjeta PACO' },
  { id: '118400', name: 'Transferencia bancaria CAJA' },
  { id: '118610', name: 'Domiciliado CAJA' },
];
const CONTASIMPLE_EXPENSE_CLASSES = [
  { id: '600', name: 'Compras de mercaderías (materiales)' },
  { id: '602', name: 'Otros aprovisionamientos' },
  { id: '607', name: 'Trabajos realizados por otras empresas' },
  { id: '624', name: 'Transportes' },
  { id: '629', name: 'Otros servicios' },
  { id: '6293', name: 'Material de oficina' },
  { id: '6294', name: 'Material informático' },
];

const LineaEditable = ({
  linea,
  index,
  onChange,
  onDelete,
  proyectos,
  destinoPrincipal,
  distribucionActiva,
  onDistributionChange,
}) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(linea);
  const unidadesDisponibles = local.unidad && !UNIDADES.includes(local.unidad)
    ? [local.unidad, ...UNIDADES]
    : UNIDADES;

  const handleSave = () => { onChange(index, local); setEditing(false); };
  const handleCancel = () => { setLocal(linea); setEditing(false); };

  if (!editing) return (
    <div className="rounded-lg bg-muted/30 p-2 text-sm transition-colors hover:bg-muted/50">
      <div className="group flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {linea.referencia && <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{linea.referencia}</span>}
            <span className="truncate font-medium">{linea.nombre}</span>
            {linea.categoria && <Badge variant="outline" className="h-4 px-1 text-[10px]">{linea.categoria}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{linea.cantidad} {linea.unidad || 'ud'}</span>
            <span>×</span>
            <span>{Number(linea.precio_unitario || 0).toFixed(2)} €/ud</span>
            <span className="font-semibold text-foreground">{Number(linea.total_linea || 0).toFixed(2)} €</span>
            {!distribucionActiva && (
              <InvoiceLineDistribution
                linea={linea}
                proyectos={proyectos}
                destinoPrincipal={destinoPrincipal}
                enabled={false}
                onChange={onDistributionChange}
              />
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(index)}><Trash2 className="h-3 w-3" /></Button>
        </div>
      </div>
      {distribucionActiva && (
        <InvoiceLineDistribution
          linea={linea}
          proyectos={proyectos}
          destinoPrincipal={destinoPrincipal}
          enabled
          onChange={onDistributionChange}
        />
      )}
    </div>
  );

  return (
    <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <div><Label className="text-xs">Referencia</Label><Input value={local.referencia || ''} onChange={e => setLocal(p => ({ ...p, referencia: e.target.value }))} className="h-7 text-xs" /></div>
        <div><Label className="text-xs">Categoría</Label>
          <Select value={local.categoria || ''} onValueChange={v => setLocal(p => ({ ...p, categoria: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label className="text-xs">Nombre / Descripción</Label><Input value={local.nombre || ''} onChange={e => setLocal(p => ({ ...p, nombre: e.target.value }))} className="h-7 text-xs" /></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div><Label className="text-xs">Cantidad</Label><Input type="number" value={local.cantidad || ''} onChange={e => setLocal(p => ({ ...p, cantidad: e.target.value, total_linea: (e.target.value * (p.precio_unitario || 0)).toFixed(2) }))} className="h-7 text-xs" /></div>
        <div><Label className="text-xs">Unidad</Label>
          <Select value={local.unidad || 'ud'} onValueChange={v => setLocal(p => ({ ...p, unidad: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{unidadesDisponibles.map(u => <SelectItem key={u} value={u} className="text-xs">{u}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs">Precio/ud (€)</Label><Input type="number" value={local.precio_unitario || ''} onChange={e => setLocal(p => ({ ...p, precio_unitario: e.target.value, total_linea: ((p.cantidad || 1) * e.target.value).toFixed(2) }))} className="h-7 text-xs" /></div>
        <div><Label className="text-xs">Total (€)</Label><Input type="number" value={local.total_linea || ''} onChange={e => setLocal(p => ({ ...p, total_linea: e.target.value }))} className="h-7 text-xs" /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel}><X className="w-3 h-3 mr-1" />Cancelar</Button>
        <Button size="sm" className="h-7 text-xs" onClick={handleSave}><Check className="w-3 h-3 mr-1" />Guardar</Button>
      </div>
    </div>
  );
};

const GastosScanner = ({ navigate }) => {
  const location = useLocation();
  const routeParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const contextualReturnId = routeParams.get('devolucionProveedorId') || '';
  const returnTo = routeParams.get('returnTo') || '';
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [currentEmpleadoId, setCurrentEmpleadoId] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [ocrResult, setOcrResult] = useState(null);
  const [destinoPrincipal, setDestinoPrincipal] = useState('');
  const [distribucionActiva, setDistribucionActiva] = useState(false);
  const [devolucionesPendientes, setDevolucionesPendientes] = useState([]);
  const [loadingDevoluciones, setLoadingDevoluciones] = useState(false);
  const [devolucionContext, setDevolucionContext] = useState(null);
  const [loadingDevolucionContext, setLoadingDevolucionContext] = useState(Boolean(contextualReturnId));
  const [abonoProviderMismatch, setAbonoProviderMismatch] = useState(false);
  const { toast } = useToast();

  // Modal de crear proveedor nuevo
  const [nuevoProveedor, setNuevoProveedor] = useState(null); // { nombre, cif, email, telefono }
  const [showCrearProveedor, setShowCrearProveedor] = useState(false);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const cameraInputRef = useRef(null);

  const [formData, setFormData] = useState({
    proveedor_id: '',
    proveedor_nombre_ocr: '',
    proveedor_cif_ocr: '',
    numero_factura: '',
    fecha_emision: '',
    monto_bruto: '',
    iva: 0.21,
    iva_importe: '',
    total_con_iva: '',
    concepto: '',
    tipo_documento: PURCHASE_DOCUMENT_TYPES.REVIEW,
    tipo_documento_motivo: 'Pendiente de analizar.',
    numero_generado: false,
    receptor_nombre_ocr: '',
    receptor_cif_ocr: '',
    contasimple_metodo_pago_id: '495834',
    contasimple_metodo_pago_nombre: 'Efectivo',
    contasimple_tipo_gasto: '600',
    es_abono: false,
    tipo_documento_fiscal: 'factura',
    factura_original_numero: '',
    motivo_abono: '',
    devolucion_proveedor_id: '',
  });
  const nuevoProveedorCifValidation = useMemo(
    () => validateSpanishTaxId(nuevoProveedor?.cif),
    [nuevoProveedor?.cif],
  );
  const cifOcrValidation = useMemo(
    () => validateSpanishTaxId(formData.proveedor_cif_ocr),
    [formData.proveedor_cif_ocr],
  );
  const devolucionSeleccionada = useMemo(
    () => devolucionesPendientes.find((item) => item.id === formData.devolucion_proveedor_id) || null,
    [devolucionesPendientes, formData.devolucion_proveedor_id],
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData?.session?.user;
        if (user) {
          const { data: empData } = await supabase.from('empleados').select('id').eq('auth_user_id', user.id).single();
          if (empData) setCurrentEmpleadoId(empData.id);
        }
        const { data: provData } = await supabase.from('proveedores').select('id, nombre, cif').order('nombre');
        const { data: projData } = await supabase.from('proyectos').select('id, nombre_proyecto').eq('estado', 'activo').order('nombre_proyecto');
        if (provData) setProveedores(provData);
        if (projData) setProyectos(projData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    let active = true;
    const loadReturnContext = async () => {
      if (!contextualReturnId) {
        setLoadingDevolucionContext(false);
        return;
      }
      setLoadingDevolucionContext(true);
      const { data, error } = await supabase
        .from('v_devoluciones_proveedor_pendientes_abono')
        .select('*')
        .eq('id', contextualReturnId)
        .maybeSingle();
      if (!active) return;
      if (error || !data) {
        toast({
          variant: 'destructive',
          title: 'Devolución no disponible',
          description: error?.message || 'La devolución ya no está pendiente de abono.',
        });
        setLoadingDevolucionContext(false);
        return;
      }
      setDevolucionContext(data);
      setDevolucionesPendientes([data]);
      setDestinoPrincipal(destinoObra(data.obra_id));
      setFormData((current) => ({
        ...current,
        proveedor_id: data.proveedor_id || '',
        proveedor_nombre_ocr: data.proveedor_nombre || '',
        proveedor_cif_ocr: data.proveedor_cif || '',
        tipo_documento: PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE,
        tipo_documento_motivo: 'Abono iniciado desde una devolución pendiente.',
        es_abono: true,
        tipo_documento_fiscal: 'factura_rectificativa',
        factura_original_numero: data.numero_factura_origen || '',
        motivo_abono: data.motivo || '',
        devolucion_proveedor_id: data.id,
      }));
      setLoadingDevolucionContext(false);
    };
    loadReturnContext();
    return () => { active = false; };
  }, [contextualReturnId, toast]);

  useEffect(() => {
    let active = true;
    const loadPendingReturns = async () => {
      if (!formData.es_abono || !formData.proveedor_id) {
        setDevolucionesPendientes([]);
        return;
      }
      setLoadingDevoluciones(true);
      const { data, error } = await supabase
        .from('v_devoluciones_proveedor_pendientes_abono')
        .select('*')
        .eq('proveedor_id', formData.proveedor_id)
        .order('created_at', { ascending: false });
      if (!active) return;
      if (error) {
        console.warn('[Abonos] No se pudieron cargar devoluciones pendientes:', error.message);
        setDevolucionesPendientes([]);
      } else {
        setDevolucionesPendientes(data || []);
      }
      setLoadingDevoluciones(false);
    };
    loadPendingReturns();
    return () => { active = false; };
  }, [formData.es_abono, formData.proveedor_id]);

  useEffect(() => {
    if (!devolucionSeleccionada?.obra_id) return;
    setDestinoPrincipal(destinoObra(devolucionSeleccionada.obra_id));
    setLineas((current) => current.map((linea) => ({ ...linea, asignaciones: [] })));
  }, [devolucionSeleccionada?.id, devolucionSeleccionada?.obra_id]);

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(selectedFile));
      setLineas([]);
      setOcrResult(null);
      setAbonoProviderMismatch(false);
      setDistribucionActiva(false);
      setFormData(prev => ({
        ...prev,
        numero_factura: '', fecha_emision: '', total_con_iva: '', iva: '', monto_bruto: '', concepto: '',
        tipo_documento: contextualReturnId ? PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE : PURCHASE_DOCUMENT_TYPES.REVIEW,
        tipo_documento_motivo: contextualReturnId ? 'Abono iniciado desde una devolución pendiente.' : 'Pendiente de analizar.',
        numero_generado: false,
        receptor_nombre_ocr: '',
        receptor_cif_ocr: '',
        es_abono: Boolean(contextualReturnId),
        tipo_documento_fiscal: contextualReturnId ? 'factura_rectificativa' : 'factura',
        factura_original_numero: contextualReturnId ? (devolucionContext?.numero_factura_origen || prev.factura_original_numero) : '',
        motivo_abono: contextualReturnId ? (devolucionContext?.motivo || prev.motivo_abono) : '',
        devolucion_proveedor_id: contextualReturnId || '',
      }));
    }
  };

  const onDrop = (acceptedFiles) => handleFileSelect(acceptedFiles[0]);
  const onCameraCapture = (e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noClick: true, noKeyboard: true,
    accept: { 'image/*': ['.jpeg', '.jpg', '.png', '.webp', '.heic'], 'application/pdf': ['.pdf'] },
    maxFiles: 1, multiple: false
  });

  useEffect(() => { return () => { if (preview) URL.revokeObjectURL(preview); }; }, [preview]);

  const handleAnalyze = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeInvoice(file);
      setOcrResult(result);
      const documentClassification = classifyPurchaseDocument({
        recipientName: result.receptor_nombre,
        recipientTaxId: result.receptor_cif,
      });
      const ocrDetectedCreditNote = Boolean(result.es_abono)
        || ['abono', 'factura_rectificativa'].includes(result.tipo_documento_fiscal);
      const isCreditNote = Boolean(contextualReturnId) || ocrDetectedCreditNote;
      const documentNumber = result.numero_factura || await buildInternalTicketNumber({
        file,
        date: result.fecha,
        providerTaxId: result.proveedor_cif,
        total: result.total,
      });

      // Intentar match de proveedor
      // Buscar SIEMPRE por CIF primero — normalizar eliminando todo excepto letras y números
      const normalizarCIF = (cif) => cif ? cif.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';
      const cifValidation = validateSpanishTaxId(result.proveedor_cif);

      console.log('[OCR] CIF detectado:', result.proveedor_cif);
      console.log('[OCR] CIF normalizado:', normalizarCIF(result.proveedor_cif));
      console.log('[OCR] Proveedores con CIF:', proveedores.filter(p => p.cif).map(p => ({ nombre: p.nombre, cif: p.cif, normalizado: normalizarCIF(p.cif) })));

      let foundProvider = null;
      if (cifValidation.valid) {
        const cifBuscado = cifValidation.normalized;
        foundProvider = proveedores.find(p =>
          p.cif && normalizarCIF(p.cif) === cifBuscado
        );
      }
      console.log('[OCR] Proveedor encontrado:', foundProvider);

      setFormData(prev => ({
        ...prev,
        numero_factura: documentNumber,
        fecha_emision: result.fecha || new Date().toISOString().split('T')[0],
        total_con_iva: result.total == null ? '' : Math.abs(Number(result.total)),
        iva: result.iva_porcentaje ? result.iva_porcentaje / 100 : 0.21,
        iva_importe: result.iva_importe == null ? '' : Math.abs(Number(result.iva_importe)),
        monto_bruto: result.subtotal != null
          ? Math.abs(Number(result.subtotal))
          : (result.total != null && result.iva_importe != null
            ? Math.abs(Number(result.total) - Number(result.iva_importe)).toFixed(2)
            : (documentClassification.type === PURCHASE_DOCUMENT_TYPES.EXPENSE ? Math.abs(Number(result.total || 0)) : '')),
        proveedor_id: contextualReturnId ? (devolucionContext?.proveedor_id || prev.proveedor_id) : (foundProvider ? foundProvider.id : ''),
        proveedor_nombre_ocr: contextualReturnId ? (devolucionContext?.proveedor_nombre || prev.proveedor_nombre_ocr) : (result.proveedor_nombre || ''),
        proveedor_cif_ocr: contextualReturnId ? (devolucionContext?.proveedor_cif || prev.proveedor_cif_ocr) : (result.proveedor_cif || ''),
        concepto: result.proveedor_nombre || '',
        tipo_documento: isCreditNote ? PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE : documentClassification.type,
        tipo_documento_motivo: isCreditNote
          ? 'El OCR ha identificado una factura rectificativa o abono de proveedor.'
          : documentClassification.reason,
        numero_generado: !result.numero_factura,
        receptor_nombre_ocr: result.receptor_nombre || '',
        receptor_cif_ocr: result.receptor_cif || '',
        es_abono: isCreditNote,
        tipo_documento_fiscal: isCreditNote
          ? (result.tipo_documento_fiscal === 'abono' ? 'abono' : 'factura_rectificativa')
          : (result.tipo_documento_fiscal || 'factura'),
        factura_original_numero: contextualReturnId
          ? (devolucionContext?.numero_factura_origen || prev.factura_original_numero)
          : (result.factura_original_numero || ''),
        motivo_abono: result.motivo_abono || devolucionContext?.motivo || '',
        devolucion_proveedor_id: contextualReturnId || '',
      }));

      if (contextualReturnId) {
        const expectedTaxId = validateSpanishTaxId(devolucionContext?.proveedor_cif).normalized;
        if (cifValidation.valid && expectedTaxId && cifValidation.normalized !== expectedTaxId) {
          setAbonoProviderMismatch(true);
          toast({
            variant: 'destructive',
            title: 'El proveedor del abono no coincide',
            description: `El OCR ha leído ${result.proveedor_cif}; la devolución pertenece a ${devolucionContext?.proveedor_cif}. Revisa el documento.`,
          });
        } else {
          setAbonoProviderMismatch(false);
          toast({ title: `Abono de ${devolucionContext?.proveedor_nombre || 'proveedor'} identificado`, description: 'La devolución y la obra permanecen bloqueadas.' });
        }
        if (!ocrDetectedCreditNote) {
          toast({
            variant: 'destructive',
            title: 'El OCR no confirma que sea un abono',
            description: 'Comprueba que el documento sea una factura rectificativa antes de guardarlo.',
          });
        }
      } else if (foundProvider) {
        toast({ title: `Proveedor identificado: ${foundProvider.nombre}`, description: 'Coincidencia por CIF.' });
      } else {
        // No encontrado — mostrar modal para crear
        setNuevoProveedor({
          nombre: result.proveedor_nombre || '',
          cif: result.proveedor_cif || '',
          email: '',
          telefono: '',
          direccion: '',
        });
        setShowCrearProveedor(true);
      }

      if (!cifValidation.valid) {
        toast({
          variant: 'destructive',
          title: 'CIF/NIF detectado incorrecto',
          description: `${result.proveedor_cif || 'Sin identificar'} — ${cifValidation.reason}`,
        });
      }

      // Cargar líneas extraídas
      if (result.lineas && result.lineas.length > 0) {
        setLineas(result.lineas.map(l => ({
          referencia: l.referencia || '',
          nombre: l.nombre || '',
          categoria: l.categoria || 'materiales',
          cantidad: Math.abs(Number(l.cantidad || 1)),
          unidad: l.unidad || 'ud',
          precio_unitario: Math.abs(Number(l.precio_unitario || 0)),
          total_linea: Math.abs(Number(l.total_linea || 0)),
        })));
      }

      toast({ title: "Análisis completado", description: `Se han extraído ${result.lineas?.length || 0} líneas de producto.` });
      if (!result.numero_factura) {
        toast({
          title: 'Referencia interna generada',
          description: `${documentNumber} — el documento no contiene un número legible.`,
        });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error en el análisis", description: error.message });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCrearProveedor = async () => {
    if (!nuevoProveedor?.nombre?.trim()) {
      toast({ variant: 'destructive', title: 'El nombre es obligatorio' });
      return;
    }
    const cifValidation = validateSpanishTaxId(nuevoProveedor.cif);
    if (!cifValidation.valid) {
      toast({ variant: 'destructive', title: 'CIF/NIF incorrecto', description: cifValidation.reason });
      return;
    }
    setCreandoProveedor(true);
    try {
      const { data, error } = await supabase.from('proveedores').insert({
        nombre: nuevoProveedor.nombre.trim(),
        cif: cifValidation.normalized,
        email: nuevoProveedor.email?.trim() || null,
        telefono: nuevoProveedor.telefono?.trim() || null,
        direccion: nuevoProveedor.direccion?.trim() || null,
        activo: true,
      }).select().single();

      if (error) throw error;

      // Añadir a la lista local y seleccionarlo
      setProveedores(prev => [...prev, data]);
      setFormData(prev => ({
        ...prev,
        proveedor_id: data.id,
        proveedor_nombre_ocr: data.nombre,
        proveedor_cif_ocr: data.cif,
      }));
      setShowCrearProveedor(false);
      setNuevoProveedor(null);
      toast({ title: `Proveedor "${data.nombre}" creado`, description: 'Seleccionado automáticamente.' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al crear proveedor', description: err.message });
    } finally {
      setCreandoProveedor(false);
    }
  };

  const handleLineaChange = (index, updated) => {
    setLineas(prev => prev.map((l, i) => i === index ? updated : l));
  };

  const handleLineaDelete = (index) => {
    setLineas(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddLinea = () => {
    setLineas(prev => [...prev, { referencia: '', nombre: '', categoria: 'materiales', cantidad: 1, unidad: 'ud', precio_unitario: 0, total_linea: 0, asignaciones: [] }]);
  };

  const lineasConDestino = useMemo(() => lineas.map((linea) => ({
    ...linea,
    asignaciones: linea.asignaciones?.length
      ? linea.asignaciones
      : buildDefaultAssignments(linea, destinoPrincipal),
  })), [lineas, destinoPrincipal]);

  const resumenDestinos = useMemo(() => {
    const resumen = { obras: new Set(), general: 0, almacen: 0, importeObras: 0 };
    lineasConDestino.forEach((linea) => {
      const precio = Number(linea.precio_unitario || 0);
      linea.asignaciones.forEach((asignacion) => {
        const importe = Number(asignacion.cantidad || 0) * precio;
        if (asignacion.destino_tipo === 'obra') {
          resumen.obras.add(asignacion.obra_id);
          resumen.importeObras += importe;
        } else if (asignacion.destino_tipo === 'general') {
          resumen.general += importe;
        } else if (asignacion.destino_tipo === 'almacen') {
          resumen.almacen += importe;
        }
      });
    });
    return resumen;
  }, [lineasConDestino]);

  const handleSave = async () => {
    if (abonoProviderMismatch) {
      toast({
        variant: 'destructive',
        title: 'Proveedor incompatible',
        description: 'No se puede vincular este documento: su CIF no coincide con el proveedor de la devolución.',
      });
      return;
    }
    if (formData.tipo_documento === PURCHASE_DOCUMENT_TYPES.REVIEW) {
      toast({
        variant: 'destructive',
        title: 'Clasificación pendiente',
        description: 'Confirma si el documento es una factura recibida o un gasto/ticket antes de guardarlo.',
      });
      return;
    }
    if (formData.tipo_documento === PURCHASE_DOCUMENT_TYPES.EXPENSE
      && (!formData.contasimple_metodo_pago_id || !formData.contasimple_tipo_gasto)) {
      toast({
        variant: 'destructive',
        title: 'Datos contables pendientes',
        description: 'Selecciona el método de pago y el tipo contable del gasto.',
      });
      return;
    }
    if (!formData.numero_factura || !formData.total_con_iva) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Verifica el número de factura y el total." });
      return;
    }
    if (!formData.proveedor_id) {
      toast({ variant: "destructive", title: "Proveedor requerido", description: "Selecciona un proveedor." });
      return;
    }
    const selectedProvider = proveedores.find((provider) => provider.id === formData.proveedor_id);
    const providerTaxId = selectedProvider?.cif || formData.proveedor_cif_ocr;
    const providerTaxIdValidation = validateSpanishTaxId(providerTaxId);
    if (!providerTaxIdValidation.valid) {
      toast({
        variant: 'destructive',
        title: 'CIF/NIF del proveedor incorrecto',
        description: providerTaxIdValidation.reason,
      });
      return;
    }
    if (!currentEmpleadoId) {
      toast({ variant: "destructive", title: "Usuario no identificado", description: "No se ha podido relacionar tu sesión con un empleado." });
      return;
    }
    if (!file) {
      toast({ variant: "destructive", title: "Documento requerido", description: "Adjunta la foto o PDF de la factura." });
      return;
    }
    if (!parseDestino(destinoPrincipal)) {
      toast({ variant: "destructive", title: "Destino requerido", description: "Selecciona una obra, gastos generales o almacén propio." });
      return;
    }
    if (lineas.length === 0) {
      toast({ variant: "destructive", title: "Sin materiales", description: "Revisa el OCR y añade al menos una línea de material." });
      return;
    }

    const lineaIncompleta = lineas.find(l => (
      !l.referencia?.trim()
      || !l.nombre?.trim()
      || !l.unidad
      || Number(l.cantidad) === 0
      || Number(l.precio_unitario) < 0
    ));

    if (lineaIncompleta) {
      toast({
        variant: "destructive",
        title: "Línea pendiente de revisar",
        description: "Cada material necesita referencia, descripción, unidad, una cantidad distinta de cero y precio.",
      });
      return;
    }

    const repartoInvalido = lineasConDestino.find((linea) => {
      if (!linea.asignaciones.length) return true;
      const suma = linea.asignaciones.reduce((total, asignacion) => total + Number(asignacion.cantidad || 0), 0);
      return Math.abs(suma - Number(linea.cantidad || 0)) > 0.001
        || linea.asignaciones.some((asignacion) => (
          Number(asignacion.cantidad || 0) === 0
          || !['obra', 'general', 'almacen'].includes(asignacion.destino_tipo)
          || (asignacion.destino_tipo === 'obra' && !asignacion.obra_id)
        ));
    });

    if (repartoInvalido) {
      toast({
        variant: "destructive",
        title: "Distribución incompleta",
        description: `Revisa el reparto de ${repartoInvalido.nombre || 'una línea'}: todas sus unidades deben tener destino.`,
      });
      return;
    }

    if (formData.es_abono && lineasConDestino.some((linea) => (
      linea.asignaciones.some((asignacion) => asignacion.destino_tipo === 'almacen')
    ))) {
      toast({
        variant: "destructive",
        title: "Salida de almacén pendiente de definir",
        description: "Por ahora asigna el abono a la obra o a gastos generales. La devolución de stock propio debe registrarse desde el movimiento de almacén.",
      });
      return;
    }

    const signoFiscal = formData.es_abono ? -1 : 1;
    const baseImponibleVisible = Math.abs(Number(formData.monto_bruto));
    const totalFacturaVisible = Math.abs(Number(formData.total_con_iva));
    const ivaImporteVisible = Math.abs(Number(formData.iva_importe || (totalFacturaVisible - baseImponibleVisible)));
    const baseImponible = signoFiscal * baseImponibleVisible;
    const totalFactura = signoFiscal * totalFacturaVisible;
    const ivaImporte = signoFiscal * ivaImporteVisible;

    if (!Number.isFinite(baseImponibleVisible) || baseImponibleVisible <= 0 || !Number.isFinite(totalFacturaVisible) || totalFacturaVisible <= 0) {
      toast({ variant: "destructive", title: "Importes incorrectos", description: "Revisa la base imponible y el total." });
      return;
    }

    if (Math.abs((baseImponibleVisible + ivaImporteVisible) - totalFacturaVisible) > 0.02) {
      toast({ variant: "destructive", title: "La factura no cuadra", description: "La base imponible más el IVA debe coincidir con el total." });
      return;
    }

    setIsSaving(true);
    let uploadedPath = null;
    try {
      const { data: duplicateCheck, error: duplicateError } = await supabase.rpc('flopy_verificar_factura_duplicada', {
        p_proveedor_nif: formData.proveedor_cif_ocr || null,
        p_numero_factura: formData.numero_factura,
        p_total: totalFactura,
      });
      if (duplicateError) throw duplicateError;
      if (duplicateCheck?.duplicada) {
        toast({
          variant: "destructive",
          title: "Factura ya registrada",
          description: `La factura ${formData.numero_factura} ya existe y no se ha vuelto a guardar.`,
        });
        return;
      }

      const rawExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const fileExtension = /^[a-z0-9]+$/.test(rawExtension) ? rawExtension : 'bin';
      uploadedPath = `materiales/${currentEmpleadoId}/${Date.now()}-${crypto.randomUUID()}.${fileExtension}`;

      const { error: uploadError } = await supabase.storage
        .from('facturas_ocr')
        .upload(uploadedPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('facturas_ocr').getPublicUrl(uploadedPath);
      if (!urlData?.publicUrl) throw new Error('No se pudo obtener la URL del documento.');

      const lineasOcr = lineasConDestino.map((l, index) => {
        const cantidad = signoFiscal * Math.abs(Number(l.cantidad));
        const precioUnitario = Number(l.precio_unitario);
        const baseLinea = signoFiscal * Math.abs(Number(l.total_linea || (Math.abs(cantidad) * precioUnitario)));
        return {
          numero_linea: index + 1,
          referencia: l.referencia.trim(),
          descripcion: l.nombre.trim(),
          categoria: l.categoria || 'materiales',
          cantidad,
          unidad: l.unidad || 'ud',
          precio_unitario: precioUnitario,
          base_linea: baseLinea,
          total_linea: baseLinea,
          es_material: true,
          asignaciones: l.asignaciones.map((asignacion) => ({
            destino_tipo: asignacion.destino_tipo,
            obra_id: asignacion.destino_tipo === 'obra' ? asignacion.obra_id : null,
            cantidad: signoFiscal * Math.abs(Number(asignacion.cantidad)),
          })),
        };
      });

      const intakeParams = {
        p_subido_por: currentEmpleadoId,
        p_proveedor_id: formData.proveedor_id,
        p_imagen_url: urlData.publicUrl,
        p_proveedor_nombre: formData.proveedor_nombre_ocr || proveedores.find(p => p.id === formData.proveedor_id)?.nombre || null,
        p_proveedor_nif: formData.proveedor_cif_ocr || proveedores.find(p => p.id === formData.proveedor_id)?.cif || null,
        p_numero_factura: formData.numero_factura,
        p_fecha_factura: formData.fecha_emision,
        p_base_imponible: baseImponible,
        p_iva_importe: ivaImporte,
        p_total: totalFactura,
        p_json_ocr: {
          ...(ocrResult || {}),
          tipo_documento_erp: formData.tipo_documento,
          tipo_documento_motivo: formData.tipo_documento_motivo,
          numero_documento_generado: formData.numero_generado,
          receptor_nombre: formData.receptor_nombre_ocr || ocrResult?.receptor_nombre || null,
          receptor_cif: formData.receptor_cif_ocr || ocrResult?.receptor_cif || null,
          contasimple_metodo_pago_id: Number(formData.contasimple_metodo_pago_id),
          contasimple_metodo_pago_nombre: formData.contasimple_metodo_pago_nombre,
          contasimple_tipo_gasto: Number(formData.contasimple_tipo_gasto),
          tipo_documento_fiscal: formData.es_abono ? formData.tipo_documento_fiscal : 'factura',
          es_abono: formData.es_abono,
          factura_original_numero: formData.factura_original_numero || null,
          motivo_abono: formData.motivo_abono || null,
          devolucion_proveedor_id: formData.devolucion_proveedor_id || null,
        },
        p_lineas: lineasOcr,
        p_confianza_ocr: Number(ocrResult?.confianza_ocr || ocrResult?.confianza) || null,
        p_motor_ocr: 'openai_vision',
      };
      const rpcName = formData.es_abono && formData.devolucion_proveedor_id
        ? 'ia360_registrar_abono_vinculado_desde_ocr'
        : 'ia360_registrar_factura_distribuida_desde_ocr';
      if (rpcName === 'ia360_registrar_abono_vinculado_desde_ocr') {
        intakeParams.p_devolucion_id = formData.devolucion_proveedor_id;
        intakeParams.p_factura_original_numero = formData.factura_original_numero || null;
      }
      const { data: intakeResult, error: intakeError } = await supabase.rpc(rpcName, intakeParams);
      if (intakeError) throw intakeError;

      if (!intakeResult?.ok) {
        if (uploadedPath) {
          await supabase.storage.from('facturas_ocr').remove([uploadedPath]);
          uploadedPath = null;
        }
        if (intakeResult?.duplicada) {
          toast({ variant: "destructive", title: "Factura duplicada", description: "La factura ya estaba registrada y no se ha creado otra copia." });
          return;
        }
        throw new Error(intakeResult?.error || 'No se pudo registrar la factura.');
      }

      let contasimpleResult = null;
      let contasimpleError = null;
      if (contextualReturnId) {
        try {
          contasimpleResult = await createReceivedInvoice(intakeResult.factura_id);
        } catch (error) {
          contasimpleError = error;
          console.error('[Abono] No se pudo enviar a ContaSimple:', error);
        }
      }

      if (contextualReturnId && contasimpleResult) {
        toast({
          title: "Abono registrado y enviado",
          description: `La devolución queda abonada y ContaSimple ha creado el documento ${contasimpleResult.documentNumber || formData.numero_factura}.`,
        });
      } else if (contextualReturnId && contasimpleError) {
        toast({
          variant: "destructive",
          title: "Abono guardado; envío pendiente",
          description: `${contasimpleError.message} El abono no se ha perdido y podrá reenviarse desde la bandeja de ContaSimple.`,
        });
      } else {
        toast({
          title: "Factura distribuida y contabilizada",
          description: `${intakeResult.asignaciones_creadas || lineas.length} destinos internos guardados; la factura queda preparada una sola vez para ContaSimple.`,
        });
      }

      // Reset
      setFile(null); setPreview(null); setLineas([]); setOcrResult(null);
      setDestinoPrincipal(''); setDistribucionActiva(false);
      setFormData({
        proveedor_id: '', proveedor_nombre_ocr: '', proveedor_cif_ocr: '', numero_factura: '',
        fecha_emision: '', monto_bruto: '', iva: 0.21, iva_importe: '', total_con_iva: '', concepto: '',
        tipo_documento: PURCHASE_DOCUMENT_TYPES.REVIEW,
        tipo_documento_motivo: 'Pendiente de analizar.',
        numero_generado: false,
        receptor_nombre_ocr: '',
        receptor_cif_ocr: '',
        contasimple_metodo_pago_id: '495834',
        contasimple_metodo_pago_nombre: 'Efectivo',
        contasimple_tipo_gasto: '600',
        es_abono: false,
        tipo_documento_fiscal: 'factura',
        factura_original_numero: '',
        motivo_abono: '',
        devolucion_proveedor_id: '',
      });
      if (contextualReturnId && returnTo) navigate(returnTo);

    } catch (err) {
      console.error(err);
      if (uploadedPath) {
        await supabase.storage.from('facturas_ocr').remove([uploadedPath]);
      }
      toast({ variant: "destructive", title: "Error al guardar", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate && navigate(returnTo || -1)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">{contextualReturnId ? 'Registrar factura de abono' : 'Escáner de Facturas'}</h1>
          <p className="text-sm text-muted-foreground">
            {contextualReturnId
              ? 'Adjunta el abono recibido para cerrar esta devolución y prepararlo para ContaSimple.'
              : 'Sube una foto, ticket o PDF — la IA extraerá proveedor, referencias, unidades e importes'}
          </p>
        </div>
      </div>

      {contextualReturnId && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <span className="text-emerald-700">Compra registrada</span>
            <span className="text-slate-400">→</span>
            <span className="text-emerald-700">Material devuelto</span>
            <span className="text-slate-400">→</span>
            <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-amber-800">Subir abono</span>
            <span className="text-slate-400">→</span>
            <span className="text-slate-500">Enviar a ContaSimple</span>
          </div>
          <p className="mt-2 text-xs text-slate-700">
            {loadingDevolucionContext
              ? 'Cargando la devolución…'
              : `${devolucionContext?.obra_nombre || 'Obra'} · factura original ${devolucionContext?.numero_factura_origen || 'sin número'} · ${Number(devolucionContext?.importe_base_estimado || 0).toFixed(2)} € pendientes de abono`}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Columna izquierda — Imagen */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Documento</CardTitle>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div {...getRootProps()} className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragActive ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <input {...getInputProps()} />
                  <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Arrastra aquí o elige una opción</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button variant="outline" size="sm" onClick={open}><FileText className="w-4 h-4 mr-2" />Subir archivo</Button>
                    <Button variant="outline" size="sm" onClick={() => cameraInputRef.current?.click()}><Camera className="w-4 h-4 mr-2" />Usar cámara</Button>
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onCameraCapture} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-3">JPG, PNG, WEBP, HEIC, PDF</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-lg overflow-hidden bg-muted max-h-[300px] flex items-center justify-center">
                    {file.type === 'application/pdf' ? (
                      <div className="flex flex-col items-center p-8 text-muted-foreground">
                        <FileText className="w-16 h-16 mb-2" />
                        <p className="text-sm font-medium">{file.name}</p>
                      </div>
                    ) : (
                      <img src={preview} alt="Factura" className="max-h-[300px] w-full object-contain" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1" onClick={handleAnalyze} disabled={isAnalyzing}>
                      {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando...</> : <><Scan className="w-4 h-4 mr-2" />Analizar con IA</>}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => { setFile(null); setPreview(null); setLineas([]); setOcrResult(null); }}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha — Datos extraídos */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Datos de la factura</CardTitle>
              <CardDescription>Revisa y corrige si es necesario</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-xs">Proveedor *</Label>
                {contextualReturnId ? (
                  <div className="mt-1 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2">
                    <p className="text-sm font-medium text-slate-900">{devolucionContext?.proveedor_nombre || formData.proveedor_nombre_ocr || 'Cargando proveedor…'}</p>
                    <p className="text-[11px] text-slate-600">CIF: {devolucionContext?.proveedor_cif || formData.proveedor_cif_ocr || '—'} · fijado por la devolución</p>
                  </div>
                ) : (
                  <ProviderSelect
                    value={formData.proveedor_id}
                    onValueChange={(val) => {
                      const provider = proveedores.find((item) => item.id === val);
                      setFormData(p => ({
                        ...p,
                        proveedor_id: val,
                        proveedor_nombre_ocr: provider?.nombre || p.proveedor_nombre_ocr,
                        proveedor_cif_ocr: provider?.cif || p.proveedor_cif_ocr,
                        devolucion_proveedor_id: '',
                      }));
                    }}
                    placeholder={formData.proveedor_nombre_ocr ? `Detectado: ${formData.proveedor_nombre_ocr}` : "Buscar proveedor..."}
                    className="mt-1"
                  />
                )}
                {abonoProviderMismatch && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>El CIF leído en el documento no coincide con el proveedor de esta devolución.</span>
                  </div>
                )}
                {formData.proveedor_cif_ocr && !cifOcrValidation.valid && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span><strong>CIF/NIF detectado: {formData.proveedor_cif_ocr}.</strong> {cifOcrValidation.reason}</span>
                  </div>
                )}
              </div>
              <div className={`rounded-lg border p-3 ${formData.es_abono ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Naturaleza del documento *</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Confirma si aumenta el gasto o devuelve importe y material.</p>
                  </div>
                  {formData.es_abono && (
                    <Badge variant="outline" className="border-amber-300 bg-white text-amber-800">
                      <RotateCcw className="mr-1 h-3 w-3" />Abono
                    </Badge>
                  )}
                </div>
                <Select
                  value={formData.es_abono ? 'abono' : 'factura'}
                  disabled={Boolean(contextualReturnId)}
                  onValueChange={(value) => setFormData((current) => ({
                    ...current,
                    es_abono: value === 'abono',
                    tipo_documento_fiscal: value === 'abono' ? 'factura_rectificativa' : 'factura',
                    tipo_documento: value === 'abono' ? PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE : current.tipo_documento,
                    tipo_documento_motivo: value === 'abono'
                      ? 'Factura rectificativa confirmada manualmente.'
                      : current.tipo_documento_motivo,
                    devolucion_proveedor_id: value === 'abono' ? current.devolucion_proveedor_id : '',
                  }))}
                >
                  <SelectTrigger className="h-9 bg-background text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="factura">Compra / gasto normal</SelectItem>
                    <SelectItem value="abono">Abono / factura rectificativa</SelectItem>
                  </SelectContent>
                </Select>
                {formData.es_abono && (
                  <div className="mt-3 space-y-3 border-t border-amber-200 pt-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label className="text-xs">Factura original indicada</Label>
                        <Input
                          value={formData.factura_original_numero}
                          onChange={(event) => setFormData((current) => ({ ...current, factura_original_numero: event.target.value }))}
                          placeholder="Ej. FV-2026-01847"
                          readOnly={Boolean(contextualReturnId)}
                          className="mt-1 h-8 bg-white text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Motivo del abono</Label>
                        <Input
                          value={formData.motivo_abono}
                          onChange={(event) => setFormData((current) => ({ ...current, motivo_abono: event.target.value }))}
                          placeholder="Devolución de material"
                          className="mt-1 h-8 bg-white text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Devolución pendiente relacionada</Label>
                      <Select
                        value={formData.devolucion_proveedor_id || 'sin_vincular'}
                        onValueChange={(value) => setFormData((current) => ({
                          ...current,
                          devolucion_proveedor_id: value === 'sin_vincular' ? '' : value,
                        }))}
                        disabled={loadingDevoluciones || Boolean(contextualReturnId)}
                      >
                        <SelectTrigger className="mt-1 h-9 bg-white text-sm"><SelectValue placeholder="Selecciona una devolución" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sin_vincular">Sin devolución previa — abono directo</SelectItem>
                          {devolucionesPendientes.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.obra_nombre} · {item.numero_factura_origen || 'factura sin número'} · {Number(item.importe_base_estimado || 0).toFixed(2)} €
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-[11px] text-amber-800">
                        {devolucionSeleccionada
                          ? 'El abono cerrará esta devolución. La obra no se descontará una segunda vez.'
                          : 'Si la devolución no se registró antes, distribuye ahora las líneas a las obras afectadas.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nº documento *</Label>
                  <Input value={formData.numero_factura} onChange={e => setFormData(p => ({ ...p, numero_factura: e.target.value }))} className="h-8 text-sm mt-1" />
                  {formData.numero_generado && <p className="mt-1 text-[10px] text-amber-700">Referencia interna generada automáticamente.</p>}
                </div>
                <div>
                  <Label className="text-xs">Fecha</Label>
                  <Input type="date" value={formData.fecha_emision} onChange={e => setFormData(p => ({ ...p, fecha_emision: e.target.value }))} className="h-8 text-sm mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Base (€)</Label>
                  <Input type="number" value={formData.monto_bruto} onChange={e => setFormData(p => ({ ...p, monto_bruto: e.target.value }))} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">IVA importe (€)</Label>
                  <Input type="number" value={formData.iva_importe} onChange={e => {
                    const ivaImporte = parseFloat(e.target.value) || 0;
                    const base = parseFloat(formData.monto_bruto) || 1;
                    setFormData(p => ({ ...p, iva_importe: e.target.value, iva: ivaImporte / base }));
                  }} className="h-8 text-sm mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Total (€) *</Label>
                  <Input type="number" value={formData.total_con_iva} onChange={e => setFormData(p => ({ ...p, total_con_iva: e.target.value }))} className="h-8 text-sm mt-1" />
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Registro en ContaSimple *</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Se determina por los datos del destinatario, no por el número del ticket.</p>
                  </div>
                  <Badge variant="outline" className={formData.tipo_documento === PURCHASE_DOCUMENT_TYPES.REVIEW ? 'border-amber-300 bg-amber-50 text-amber-800' : 'border-blue-200 bg-blue-50 text-blue-700'}>
                    {formData.tipo_documento === PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE ? 'Factura recibida' : formData.tipo_documento === PURCHASE_DOCUMENT_TYPES.EXPENSE ? 'Gasto / ticket' : 'Revisar'}
                  </Badge>
                </div>
                <Select
                  value={formData.tipo_documento}
                  onValueChange={(value) => setFormData((current) => ({
                    ...current,
                    tipo_documento: value,
                    tipo_documento_motivo: 'Clasificación confirmada manualmente.',
                  }))}
                >
                  <SelectTrigger className="h-9 bg-background text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PURCHASE_DOCUMENT_TYPES.RECEIVED_INVOICE}>Factura recibida — aparecen los datos de ORKALED</SelectItem>
                    <SelectItem value={PURCHASE_DOCUMENT_TYPES.EXPENSE}>Gasto / ticket — no aparecen los datos de ORKALED</SelectItem>
                    <SelectItem value={PURCHASE_DOCUMENT_TYPES.REVIEW}>Necesita revisión</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-2 text-[11px] text-muted-foreground">{formData.tipo_documento_motivo}</p>
                {(formData.receptor_nombre_ocr || formData.receptor_cif_ocr) && (
                  <p className="mt-1 text-[11px] text-slate-600">Destinatario leído: {formData.receptor_nombre_ocr || 'sin nombre'}{formData.receptor_cif_ocr ? ` · ${formData.receptor_cif_ocr}` : ''}</p>
                )}
                {formData.tipo_documento === PURCHASE_DOCUMENT_TYPES.EXPENSE && (
                  <div className="mt-3 grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">Método de pago *</Label>
                      <Select
                        value={formData.contasimple_metodo_pago_id}
                        onValueChange={(value) => {
                          const option = CONTASIMPLE_PAYMENT_METHODS.find((item) => item.id === value);
                          setFormData((current) => ({
                            ...current,
                            contasimple_metodo_pago_id: value,
                            contasimple_metodo_pago_nombre: option?.name || '',
                          }));
                        }}
                      >
                        <SelectTrigger className="mt-1 h-9 bg-background text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTASIMPLE_PAYMENT_METHODS.map((option) => (
                            <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo contable *</Label>
                      <Select
                        value={formData.contasimple_tipo_gasto}
                        onValueChange={(value) => setFormData((current) => ({ ...current, contasimple_tipo_gasto: value }))}
                      >
                        <SelectTrigger className="mt-1 h-9 bg-background text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CONTASIMPLE_EXPENSE_CLASSES.map((option) => (
                            <SelectItem key={option.id} value={option.id}>{option.id}. {option.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-primary/15 bg-primary/[0.035] p-3">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Destino principal de la compra *</Label>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Se aplicará a todos los productos salvo que edites su distribución.</p>
                  </div>
                  {destinoPrincipal && <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">Asignado</Badge>}
                </div>
                {contextualReturnId ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50/70 px-3 text-sm font-medium text-slate-800">
                    <Building2 className="h-4 w-4 text-amber-700" />
                    {devolucionContext?.obra_nombre || 'Cargando obra…'}
                    <span className="ml-auto text-[10px] font-normal text-slate-500">Fijada por la devolución</span>
                  </div>
                ) : (
                  <DestinationSelect
                    value={destinoPrincipal}
                    onValueChange={setDestinoPrincipal}
                    proyectos={proyectos}
                    className="h-9 bg-background text-sm"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Líneas de productos */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Líneas de producto
                    {lineas.length > 0 && <Badge variant="secondary" className="text-xs">{lineas.length}</Badge>}
                  </CardTitle>
                  <CardDescription className="text-xs">Referencia y unidad son obligatorias para comparar con el presupuesto</CardDescription>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  {lineas.length > 0 && !contextualReturnId && (
                    <Button
                      type="button"
                      size="sm"
                      variant={distribucionActiva ? 'secondary' : 'outline'}
                      className="h-7 text-xs"
                      onClick={() => setDistribucionActiva((value) => !value)}
                      disabled={!destinoPrincipal}
                    >
                      <ListChecks className="mr-1 h-3 w-3" />
                      {distribucionActiva ? 'Cerrar distribución' : 'Editar distribución'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAddLinea}>
                    <Plus className="mr-1 h-3 w-3" />Añadir
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {lineas.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Las líneas aparecerán aquí tras el análisis</p>
                </div>
              ) : (
                lineas.map((linea, idx) => (
                  <LineaEditable
                    key={idx}
                    linea={linea}
                    index={idx}
                    onChange={handleLineaChange}
                    onDelete={handleLineaDelete}
                    proyectos={proyectos}
                    destinoPrincipal={destinoPrincipal}
                    distribucionActiva={distribucionActiva}
                    onDistributionChange={(asignaciones) => handleLineaChange(idx, { ...linea, asignaciones })}
                  />
                ))
              )}

              {lineas.length > 0 && destinoPrincipal && (
                <div className="mt-3 grid grid-cols-1 gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-md bg-muted/35 px-3 py-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <div><p className="text-[10px] uppercase text-muted-foreground">Obras</p><p className="text-sm font-semibold">{resumenDestinos.obras.size} · {resumenDestinos.importeObras.toFixed(2)} €</p></div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-muted/35 px-3 py-2">
                    <Warehouse className="h-4 w-4 text-primary" />
                    <div><p className="text-[10px] uppercase text-muted-foreground">Almacén</p><p className="text-sm font-semibold">{resumenDestinos.almacen.toFixed(2)} €</p></div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md bg-muted/35 px-3 py-2">
                    <CircleDollarSign className="h-4 w-4 text-primary" />
                    <div><p className="text-[10px] uppercase text-muted-foreground">Generales</p><p className="text-sm font-semibold">{resumenDestinos.general.toFixed(2)} €</p></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botón guardar */}
          <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving || loadingDevolucionContext || !formData.numero_factura || !formData.total_con_iva}>
            {isSaving
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{contextualReturnId ? 'Registrando y enviando…' : 'Contabilizando…'}</>
              : <><Save className="mr-2 h-4 w-4" />{contextualReturnId ? 'Confirmar abono y enviar a ContaSimple' : 'Guardar factura y distribución'}</>}
          </Button>
        </div>
      </div>

      {/* Modal crear proveedor nuevo */}
      <Dialog open={showCrearProveedor} onOpenChange={setShowCrearProveedor}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Proveedor no encontrado — ¿Crear nuevo?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              La IA ha detectado este proveedor en la factura pero no existe en tu base de datos. Revisa los datos y confirma para crearlo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nombre *</Label>
                <Input value={nuevoProveedor?.nombre || ''} onChange={e => setNuevoProveedor(p => ({ ...p, nombre: e.target.value }))} className="mt-1" placeholder="Nombre del proveedor" />
              </div>
              <div>
                <Label className="text-xs">CIF / NIF *</Label>
                <Input
                  value={nuevoProveedor?.cif || ''}
                  onChange={e => setNuevoProveedor(p => ({ ...p, cif: e.target.value }))}
                  className={`mt-1 ${nuevoProveedor?.cif && !nuevoProveedorCifValidation.valid ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                  placeholder="B12345678"
                  aria-invalid={Boolean(nuevoProveedor?.cif && !nuevoProveedorCifValidation.valid)}
                />
                {nuevoProveedor?.cif && !nuevoProveedorCifValidation.valid && (
                  <p className="mt-1 text-xs text-destructive">{nuevoProveedorCifValidation.reason}</p>
                )}
              </div>
              <div>
                <Label className="text-xs">Teléfono</Label>
                <Input value={nuevoProveedor?.telefono || ''} onChange={e => setNuevoProveedor(p => ({ ...p, telefono: e.target.value }))} className="mt-1" placeholder="600 000 000" />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input value={nuevoProveedor?.email || ''} onChange={e => setNuevoProveedor(p => ({ ...p, email: e.target.value }))} className="mt-1" placeholder="proveedor@email.com" />
              </div>
              <div>
                <Label className="text-xs">Dirección</Label>
                <Input value={nuevoProveedor?.direccion || ''} onChange={e => setNuevoProveedor(p => ({ ...p, direccion: e.target.value }))} className="mt-1" placeholder="Calle, número..." />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCrearProveedor(false)}>Seleccionar manualmente</Button>
            <Button
              onClick={handleCrearProveedor}
              disabled={creandoProveedor || !nuevoProveedor?.nombre?.trim() || !nuevoProveedorCifValidation.valid}
            >
              {creandoProveedor ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Crear proveedor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default GastosScanner;
