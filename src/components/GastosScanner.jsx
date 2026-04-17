import React, { useState, useEffect, useCallback, useRef } from 'react';
import jsPDF from 'jspdf';
import { useDropzone } from 'react-dropzone';
import {
  Loader2, Save, Scan, ArrowLeft, UploadCloud, Camera,
  Trash2, FileText, Plus, Pencil, Check, X, Package, AlertCircle
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

const CATEGORIAS = ['electricidad', 'fontanería', 'pintura', 'albañilería', 'herramientas', 'materiales', 'otro'];

const LineaEditable = ({ linea, index, onChange, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(linea);

  const handleSave = () => { onChange(index, local); setEditing(false); };
  const handleCancel = () => { setLocal(linea); setEditing(false); };

  if (!editing) return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 group text-sm">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {linea.referencia && <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{linea.referencia}</span>}
          <span className="font-medium truncate">{linea.nombre}</span>
          {linea.categoria && <Badge variant="outline" className="text-[10px] h-4 px-1">{linea.categoria}</Badge>}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>{linea.cantidad} uds</span>
          <span>×</span>
          <span>{Number(linea.precio_unitario || 0).toFixed(2)} €/ud</span>
          <span className="font-semibold text-foreground">{Number(linea.total_linea || 0).toFixed(2)} €</span>
        </div>
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}><Pencil className="w-3 h-3" /></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(index)}><Trash2 className="w-3 h-3" /></Button>
      </div>
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
      <div className="grid grid-cols-3 gap-2">
        <div><Label className="text-xs">Cantidad</Label><Input type="number" value={local.cantidad || ''} onChange={e => setLocal(p => ({ ...p, cantidad: e.target.value, total_linea: (e.target.value * (p.precio_unitario || 0)).toFixed(2) }))} className="h-7 text-xs" /></div>
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

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

const imageFileToPdfBlob = async (file) => {
  const dataUrl = await fileToDataUrl(file);
  const image = new Image();
  image.src = dataUrl;

  await new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = reject;
  });

  const orientation = image.width >= image.height ? 'l' : 'p';
  const pdf = new jsPDF({ orientation, unit: 'pt', format: [image.width, image.height] });
  pdf.addImage(dataUrl, 'JPEG', 0, 0, image.width, image.height);
  return pdf.output('blob');
};

const GastosScanner = ({ navigate }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [proveedores, setProveedores] = useState([]);
  const [providerSelectKey, setProviderSelectKey] = useState(0);
  const [proyectos, setProyectos] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [currentEmpleadoId, setCurrentEmpleadoId] = useState(null);
  const [lineas, setLineas] = useState([]);
  const { toast } = useToast();

  // Modal de crear proveedor nuevo
  const [nuevoProveedor, setNuevoProveedor] = useState(null); // { nombre, cif, email, telefono }
  const [showCrearProveedor, setShowCrearProveedor] = useState(false);
  const [creandoProveedor, setCreandoProveedor] = useState(false);
  const cameraInputRef = useRef(null);

  const [formData, setFormData] = useState({
    proveedor_id: '',
    proveedor_nombre_ocr: '',
    numero_factura: '',
    fecha_emision: '',
    monto_bruto: '',
    iva: 0.21,
    iva_importe: '',
    total_con_iva: '',
    concepto: '',
    proyecto_id: 'general',
  });

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

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      setFile(selectedFile);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(selectedFile));
      setLineas([]);
      setFormData(prev => ({ ...prev, numero_factura: '', fecha_emision: '', total_con_iva: '', iva: '', monto_bruto: '', concepto: '' }));
    }
  };

  const onDrop = useCallback((acceptedFiles) => handleFileSelect(acceptedFiles[0]), [preview]);
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

      // Intentar match de proveedor
      // Buscar SIEMPRE por CIF primero — normalizar eliminando todo excepto letras y números
      const normalizarCIF = (cif) => cif ? cif.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() : '';

      console.log('[OCR] CIF detectado:', result.proveedor_cif);
      console.log('[OCR] CIF normalizado:', normalizarCIF(result.proveedor_cif));
      console.log('[OCR] Proveedores con CIF:', proveedores.filter(p => p.cif).map(p => ({ nombre: p.nombre, cif: p.cif, normalizado: normalizarCIF(p.cif) })));
           
      const normalizarNombreProveedor = (nombre) =>
        nombre
          ? nombre
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\bsl\b/gi, 's.l.')
              .replace(/\bsa\b/gi, 's.a.')
              .replace(/[^a-zA-Z0-9]/g, '')
              .toLowerCase()
          : '';
   
      let foundProvider = null;
      if (result.proveedor_cif) {
        const cifBuscado = normalizarCIF(result.proveedor_cif);
        foundProvider = proveedores.find(p =>
          p.cif && normalizarCIF(p.cif) === cifBuscado
        );
      }
            if (!foundProvider && result.proveedor_nombre) {
        const nombreBuscado = normalizarNombreProveedor(result.proveedor_nombre);
        foundProvider = proveedores.find(p =>
          normalizarNombreProveedor(p.nombre) === nombreBuscado
        );
      }

      console.log('[OCR] Proveedor encontrado:', foundProvider);

      setFormData(prev => ({
        ...prev,
        numero_factura: result.numero_factura || '',
        fecha_emision: result.fecha || new Date().toISOString().split('T')[0],
        total_con_iva: result.total || '',
        iva: result.iva_porcentaje ? result.iva_porcentaje / 100 : 0.21,
        iva_importe: result.iva_importe || '',
        monto_bruto: result.subtotal || (result.total && result.iva_importe ? (result.total - result.iva_importe).toFixed(2) : ''),
        proveedor_id: foundProvider ? foundProvider.id : '',
        proveedor_nombre_ocr: result.proveedor_nombre || '',
        concepto: result.proveedor_nombre || '',
      }));

      if (foundProvider) {
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

      // Cargar líneas extraídas
      if (result.lineas && result.lineas.length > 0) {
        setLineas(result.lineas.map(l => ({
          referencia: l.referencia || '',
          nombre: l.nombre || '',
          categoria: l.categoria || 'materiales',
          cantidad: l.cantidad || 1,
          precio_unitario: l.precio_unitario || 0,
          total_linea: l.total_linea || 0,
        })));
      }

      toast({ title: "Análisis completado", description: `Se han extraído ${result.lineas?.length || 0} líneas de producto.` });
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
    setCreandoProveedor(true);
    try {
      const { data, error } = await supabase.from('proveedores').insert({
        nombre: nuevoProveedor.nombre.trim(),
        cif: nuevoProveedor.cif?.trim() || null,
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
      }));
      setProviderSelectKey(prev => prev + 1);
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
    setLineas(prev => [...prev, { referencia: '', nombre: '', categoria: 'materiales', cantidad: 1, precio_unitario: 0, total_linea: 0 }]);
  };

  const handleSave = async () => {
    if (!formData.numero_factura || !formData.total_con_iva) {
      toast({ variant: "destructive", title: "Faltan datos", description: "Verifica el número de factura y el total." });
      return;
    }
    if (!formData.proveedor_id) {
      toast({ variant: "destructive", title: "Proveedor requerido", description: "Selecciona un proveedor." });
      return;
    }

    setIsSaving(true);
    try {
      // 1. Guardar cabecera en gastos
      const { data: gastoData, error: gastoError } = await supabase.from('gastos').insert({
        proveedor_id: formData.proveedor_id,
        numero_factura: formData.numero_factura,
        fecha_emision: formData.fecha_emision,
        fecha_vencimiento: formData.fecha_emision || null,
        monto_bruto: parseFloat(formData.monto_bruto) || 0,
        iva: parseFloat(formData.iva) || 0.21, // porcentaje decimal: 0.21 = 21%
        concepto: formData.concepto,
        estado_pago: 'pendiente_pago',
        proyecto_id: formData.proyecto_id === 'general' ? null : formData.proyecto_id,
        gasto_nave_taller: formData.proyecto_id === 'general',
      }).select().single();

      if (gastoError) throw gastoError;

      // 2. Guardar líneas de factura
      if (lineas.length > 0) {
        const lineasInsert = lineas.filter(l => l.nombre).map(l => ({
          gasto_id: gastoData.id,
          proveedor_id: formData.proveedor_id,
          referencia: l.referencia || null,
          nombre: l.nombre,
          categoria: l.categoria || null,
          cantidad: parseFloat(l.cantidad) || 1,
          precio_unitario: parseFloat(l.precio_unitario) || 0,
          total_linea: parseFloat(l.total_linea) || 0,
        }));

        const { error: lineasError } = await supabase.from('factura_lineas').insert(lineasInsert);
        if (lineasError) console.error('Error guardando líneas:', lineasError);

        // 3. Actualizar catálogo del proveedor
        for (const l of lineas.filter(l => l.nombre)) {
          const { data: existente } = await supabase
            .from('catalogo_proveedor_productos')
            .select('id, veces_comprado')
            .eq('proveedor_id', formData.proveedor_id)
            .eq('referencia', l.referencia || '')
            .maybeSingle();

          if (existente) {
            await supabase.from('catalogo_proveedor_productos').update({
              nombre: l.nombre,
              categoria: l.categoria || null,
              ultimo_precio: parseFloat(l.precio_unitario) || 0,
              ultima_compra: formData.fecha_emision || new Date().toISOString().split('T')[0],
              veces_comprado: (existente.veces_comprado || 0) + 1,
              updated_at: new Date().toISOString(),
            }).eq('id', existente.id);
          } else {
            await supabase.from('catalogo_proveedor_productos').insert({
              proveedor_id: formData.proveedor_id,
              referencia: l.referencia || null,
              nombre: l.nombre,
              categoria: l.categoria || null,
              ultimo_precio: parseFloat(l.precio_unitario) || 0,
              ultima_compra: formData.fecha_emision || new Date().toISOString().split('T')[0],
              veces_comprado: 1,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      // 4. Subir factura siempre en PDF
      if (file && gastoData) {
        const pdfPath = `gastos/${gastoData.id}.pdf`;
        let pdfFile = file;

        if (file.type !== 'application/pdf') {
          const pdfBlob = await imageFileToPdfBlob(file);
          pdfFile = new File([pdfBlob], `${gastoData.id}.pdf`, { type: 'application/pdf' });
        }

        const { error: uploadError } = await supabase.storage.from('facturas_ocr').upload(pdfPath, pdfFile, {
          contentType: 'application/pdf',
          upsert: true,
        });

        if (!uploadError) {
          await supabase.from('adjuntos').insert({
            entidad_id: gastoData.id,
            tipo_entidad: 'gasto',
            nombre_archivo: `${gastoData.id}.pdf`,
            url_almacenamiento: pdfPath,
            fecha_subida: new Date().toISOString(),
            subido_por_empleado_id: currentEmpleadoId
          });
        }
      }

      toast({ title: "Factura guardada", description: `${lineas.length} líneas guardadas en el catálogo del proveedor.` });

      // Reset
      setFile(null); setPreview(null); setLineas([]);
      setFormData({ proveedor_id: '', proveedor_nombre_ocr: '', numero_factura: '', fecha_emision: '', monto_bruto: '', iva: 0.21, iva_importe: '', total_con_iva: '', concepto: '', proyecto_id: 'general' });

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error al guardar", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate && navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold">Escáner de Facturas</h1>
          <p className="text-sm text-muted-foreground">Sube una foto, ticket o PDF — Claude extraerá todos los datos automáticamente</p>
        </div>
      </div>

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
                      {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando...</> : <><Scan className="w-4 h-4 mr-2" />Analizar con Claude</>}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => { setFile(null); setPreview(null); setLineas([]); }}><Trash2 className="w-4 h-4" /></Button>
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
                <ProviderSelect
                  key={providerSelectKey}
                  value={formData.proveedor_id}
                  onValueChange={(val) => setFormData(p => ({ ...p, proveedor_id: val }))}
                  placeholder={formData.proveedor_nombre_ocr ? `Detectado / creado: ${formData.proveedor_nombre_ocr}` : "Buscar proveedor..."}
                  className="mt-1"
                />

              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Nº Factura *</Label>
                  <Input value={formData.numero_factura} onChange={e => setFormData(p => ({ ...p, numero_factura: e.target.value }))} className="h-8 text-sm mt-1" />
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
              <div>
                <Label className="text-xs">Proyecto</Label>
                <Select value={formData.proyecto_id} onValueChange={v => setFormData(p => ({ ...p, proyecto_id: v }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General / Nave</SelectItem>
                    {proyectos.map(p => <SelectItem key={p.id} value={p.id}>{p.nombre_proyecto}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Líneas de productos */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    Líneas de producto
                    {lineas.length > 0 && <Badge variant="secondary" className="text-xs">{lineas.length}</Badge>}
                  </CardTitle>
                  <CardDescription className="text-xs">Se guardarán en el catálogo del proveedor</CardDescription>
                </div>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAddLinea}>
                  <Plus className="w-3 h-3 mr-1" />Añadir
                </Button>
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
                  <LineaEditable key={idx} linea={linea} index={idx} onChange={handleLineaChange} onDelete={handleLineaDelete} />
                ))
              )}
            </CardContent>
          </Card>

          {/* Botón guardar */}
          <Button className="w-full" size="lg" onClick={handleSave} disabled={isSaving || !formData.numero_factura || !formData.total_con_iva}>
            {isSaving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</> : <><Save className="w-4 h-4 mr-2" />Guardar factura y catálogo</>}
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
              Claude ha detectado este proveedor en la factura pero no existe en tu base de datos. Revisa los datos y confirma para crearlo.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Nombre *</Label>
                <Input value={nuevoProveedor?.nombre || ''} onChange={e => setNuevoProveedor(p => ({ ...p, nombre: e.target.value }))} className="mt-1" placeholder="Nombre del proveedor" />
              </div>
              <div>
                <Label className="text-xs">CIF / NIF</Label>
                <Input value={nuevoProveedor?.cif || ''} onChange={e => setNuevoProveedor(p => ({ ...p, cif: e.target.value }))} className="mt-1" placeholder="B12345678" />
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
            <Button onClick={handleCrearProveedor} disabled={creandoProveedor}>
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
