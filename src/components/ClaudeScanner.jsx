import { useState, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Loader2, UploadCloud, FileText, Camera, Trash2,
  Scan, Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';

export const SCANNER_MODOS = {
  factura: {
    label: 'Factura',
    icon: '🧾',
    descripcion: 'Extrae datos de facturas: proveedor, importe, IVA, fecha...',
    prompt: `Analiza esta factura y extrae todos los datos relevantes.
Responde SOLO con este JSON sin texto adicional ni markdown:
{
  "tipo": "factura",
  "proveedor": "nombre del proveedor",
  "nif_proveedor": "NIF o CIF",
  "numero_factura": "número",
  "fecha": "YYYY-MM-DD",
  "fecha_vencimiento": "YYYY-MM-DD o null",
  "base_imponible": 0.00,
  "iva_porcentaje": 21,
  "iva_importe": 0.00,
  "total": 0.00,
  "concepto": "descripción general",
  "lineas": [
    { "descripcion": "...", "cantidad": 1, "precio_unitario": 0.00, "total": 0.00 }
  ],
  "notas": "cualquier otra info relevante o null"
}`
  },
  presupuesto: {
    label: 'Presupuesto / Mediciones',
    icon: '📐',
    descripcion: 'Extrae partidas, mediciones y precios de presupuestos de obra.',
    prompt: `Analiza este presupuesto de obra y extrae TODAS las partidas con sus mediciones.
Responde SOLO con este JSON sin texto adicional ni markdown:
{
  "tipo": "presupuesto",
  "titulo": "título del presupuesto o null",
  "cliente": "nombre del cliente o null",
  "fecha": "YYYY-MM-DD o null",
  "total": 0.00,
  "partidas": [
    {
      "capitulo": "capítulo o null",
      "codigo": "código de partida o null",
      "descripcion": "descripción de la partida",
      "tipo_trabajo": "alicatado|solado|pintura|pladur|fontaneria|electricidad|albanileria|carpinteria|otro",
      "cantidad": 0.00,
      "unidad": "m²|ml|m³|ud|pa|kg|h",
      "precio_unitario": 0.00,
      "total_partida": 0.00
    }
  ]
}`
  },
  documento: {
    label: 'Documento general',
    icon: '📄',
    descripcion: 'Entiende y resume cualquier documento: contratos, albaranes, certificados...',
    prompt: `Analiza este documento y extrae toda la información relevante.
Responde SOLO con este JSON sin texto adicional ni markdown:
{
  "tipo": "documento",
  "tipo_documento": "tipo específico (contrato, albarán, certificado, etc.)",
  "titulo": "título o asunto del documento",
  "fecha": "YYYY-MM-DD o null",
  "partes_involucradas": ["persona/empresa 1", "persona/empresa 2"],
  "puntos_clave": ["punto 1", "punto 2", "punto 3"],
  "resumen": "resumen completo del documento en 2-4 frases",
  "datos_importantes": { "campo": "valor" },
  "notas": "cualquier info adicional relevante o null"
}`
  },
  plano: {
    label: 'Plano',
    icon: '🗺️',
    descripcion: 'Interpreta planos de obra: estancias, superficies, distribución...',
    prompt: `Analiza este plano de obra y extrae toda la información que puedas identificar.
Responde SOLO con este JSON sin texto adicional ni markdown:
{
  "tipo": "plano",
  "tipo_plano": "planta|alzado|sección|detalle|instalaciones|otro",
  "escala": "escala si es visible o null",
  "estancias": [
    {
      "nombre": "nombre de la estancia",
      "superficie_m2": 0.00,
      "dimensiones": "largo x ancho o null",
      "observaciones": "null o notas"
    }
  ],
  "superficie_total": 0.00,
  "observaciones_generales": "descripción general del plano",
  "elementos_destacados": ["elemento 1", "elemento 2"]
}`
  },
  nota: {
    label: 'Nota a mano',
    icon: '✏️',
    descripcion: 'Transcribe y entiende notas escritas a mano.',
    prompt: `Transcribe y analiza esta nota escrita a mano.
Responde SOLO con este JSON sin texto adicional ni markdown:
{
  "tipo": "nota",
  "transcripcion_completa": "texto completo transcrito tal cual",
  "fecha": "YYYY-MM-DD si aparece o null",
  "autor": "nombre si aparece o null",
  "tipo_nota": "pedido|recordatorio|medición|instrucción|otro",
  "puntos_clave": ["punto 1", "punto 2"],
  "datos_numericos": [
    { "concepto": "...", "valor": 0.00, "unidad": "..." }
  ],
  "resumen": "resumen de lo que dice la nota"
}`
  }
};

const ResultadoViewer = ({ resultado }) => {
  if (!resultado) return null;

  const renderValor = (valor) => {
    if (valor === null || valor === undefined) return <span className="text-muted-foreground italic text-xs">—</span>;
    if (typeof valor === 'boolean') return valor ? '✅' : '❌';
    if (typeof valor === 'number') return valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (typeof valor === 'string') return valor;
    if (Array.isArray(valor)) {
      return (
        <ul className="list-disc list-inside space-y-0.5">
          {valor.map((item, i) => (
            <li key={i} className="text-xs">{typeof item === 'object' ? JSON.stringify(item) : item}</li>
          ))}
        </ul>
      );
    }
    if (typeof valor === 'object') {
      return (
        <div className="space-y-1 pl-2 border-l-2 border-muted">
          {Object.entries(valor).map(([k, v]) => (
            <div key={k}>
              <span className="text-xs font-semibold text-muted-foreground capitalize">{k.replace(/_/g, ' ')}: </span>
              <span className="text-xs">{renderValor(v)}</span>
            </div>
          ))}
        </div>
      );
    }
    return String(valor);
  };

  const camposTabla = { lineas: 'Líneas de factura', partidas: 'Partidas', estancias: 'Estancias', datos_numericos: 'Datos numéricos' };
  const camposSimples = Object.entries(resultado).filter(([k]) => !Object.keys(camposTabla).includes(k) && k !== 'tipo');
  const camposComplejos = Object.entries(resultado).filter(([k]) => Object.keys(camposTabla).includes(k));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {camposSimples.map(([clave, valor]) => (
          <div key={clave} className={`p-2 rounded-lg bg-muted/30 ${typeof valor === 'string' && valor.length > 50 ? 'col-span-2' : ''}`}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">{clave.replace(/_/g, ' ')}</div>
            <div className="text-sm font-medium">{renderValor(valor)}</div>
          </div>
        ))}
      </div>
      {camposComplejos.map(([clave, valor]) => (
        <div key={clave}>
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {camposTabla[clave]} ({Array.isArray(valor) ? valor.length : 0})
          </div>
          {Array.isArray(valor) && valor.length > 0 && (
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {valor.map((item, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-muted/30 text-xs space-y-0.5">
                  {Object.entries(item).map(([k, v]) => (
                    <div key={k} className="flex gap-2">
                      <span className="text-muted-foreground font-medium capitalize shrink-0">{k.replace(/_/g, ' ')}:</span>
                      <span>{renderValor(v)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

const ClaudeScanner = ({ modo: modoProp, onResultado, onGuardar, children }) => {
  const [modo, setModo] = useState(modoProp || 'factura');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const cameraRef = useRef(null);

  const modoConfig = SCANNER_MODOS[modo];

  const fileToBase64 = (f) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(f);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
  });

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setResultado(null);
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(f));
  };

  const onDrop = useCallback((files) => { if (files[0]) handleFile(files[0]); }, [preview]);
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop, noClick: true, noKeyboard: true,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
    maxFiles: 1, multiple: false,
  });

  const analizar = async () => {
    if (!file) return;
    setAnalizando(true);
    setError(null);
    setResultado(null);

    try {
      const base64 = await fileToBase64(file);
      const mediaType = file.type || 'image/jpeg';

      toast({ title: `${modoConfig.icon} Analizando con Claude...`, description: 'Esto puede tardar unos segundos.' });

      // Llamada a la Edge Function de Supabase con token de sesión
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No hay sesión activa. Por favor, recarga la página.');

      const supabaseUrl = window.SUPABASE_CONFIG?.url || import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = window.SUPABASE_CONFIG?.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/claude-scanner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({ base64, mediaType, prompt: modoConfig.prompt })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Error ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const texto = data.content?.find(b => b.type === 'text')?.text || '';
      const clean = texto.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(clean);

      setResultado(parsed);
      onResultado?.(parsed, modo);

      toast({
        title: '✅ Análisis completado',
        description: `Documento analizado correctamente como ${modoConfig.label}.`,
        className: 'bg-green-600 text-white',
      });
    } catch (err) {
      console.error(err);
      setError('Error al analizar: ' + err.message);
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setAnalizando(false);
    }
  };

  const limpiar = () => {
    setFile(null);
    setPreview(null);
    setResultado(null);
    setError(null);
  };

  const guardar = async () => {
    if (!resultado || !onGuardar) return;
    setGuardando(true);
    try {
      await onGuardar(resultado, modo);
      toast({ title: '✅ Guardado correctamente', className: 'bg-blue-600 text-white' });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error al guardar', description: err.message });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      {!modoProp && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {Object.entries(SCANNER_MODOS).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setModo(key); limpiar(); }}
              className={`p-3 rounded-xl border-2 text-left transition-all ${modo === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
            >
              <div className="text-2xl mb-1">{cfg.icon}</div>
              <div className="text-xs font-semibold">{cfg.label}</div>
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">{modoConfig.icon} {modoConfig.label}</CardTitle>
              <CardDescription className="text-xs">{modoConfig.descripcion}</CardDescription>
            </CardHeader>
            <CardContent>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                  onClick={open}
                >
                  <input {...getInputProps()} />
                  <UploadCloud className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">Arrastra o haz clic para subir</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); open(); }}>
                      <FileText className="w-4 h-4 mr-2" /> PDF / Imagen
                    </Button>
                    <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}>
                      <Camera className="w-4 h-4 mr-2" /> Cámara
                    </Button>
                  </div>
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
                  <p className="text-[10px] text-muted-foreground mt-3">JPG, PNG, PDF · Máx 20MB</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl overflow-hidden bg-muted flex items-center justify-center max-h-[280px]">
                    {file.type === 'application/pdf' ? (
                      <div className="flex flex-col items-center p-8 text-muted-foreground">
                        <FileText className="w-16 h-16 mb-2 text-blue-500" />
                        <p className="text-sm font-medium text-center">{file.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <img src={preview} alt="preview" className="max-h-[280px] w-full object-contain" />
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={analizar} disabled={analizando}>
                      {analizando
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analizando...</>
                        : <><Scan className="w-4 h-4 mr-2" />Analizar con Claude</>
                      }
                    </Button>
                    <Button variant="outline" size="icon" onClick={limpiar}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">⚠️ {error}</div>
              )}
            </CardContent>
          </Card>
          {children}
        </div>

        <div>
          <Card className={`transition-all ${resultado ? 'border-green-200 bg-green-50/20' : ''}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{resultado ? '✅ Resultado' : '📋 Resultado'}</CardTitle>
                {resultado && <Badge variant="secondary" className="text-xs">{modoConfig.label}</Badge>}
              </div>
              <CardDescription className="text-xs">
                {resultado ? 'Revisa los datos extraídos' : 'El resultado aparecerá aquí tras el análisis'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!resultado ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Scan className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm">Sube un documento y pulsa "Analizar con Claude"</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <ResultadoViewer resultado={resultado} />
                  {onGuardar && (
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={guardar} disabled={guardando}>
                      {guardando
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Guardando...</>
                        : <><Save className="w-4 h-4 mr-2" />Guardar en la obra</>
                      }
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ClaudeScanner;
