import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Loader2, CheckCircle2, PackageCheck } from 'lucide-react';
import { fmtMadrid } from '@/lib/utils';
import html2pdf from 'html2pdf.js';

// Mismo patrón de firma táctil que ParteDetail.jsx, para que se sienta igual en el móvil.
const SignaturePad = ({ onEnd, onClear, canvasRef }) => {
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
                canvas.height = 180;
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
                className="w-full h-[180px] cursor-crosshair block"
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
        </div>
    );
};

export default function FirmaEntregaEmpleado({ entregaId, navigate }) {
    const { sessionRole } = useAuth();
    const empleadoId = sessionRole?.empleadoId || null;

    const [entrega, setEntrega] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [firmaDataUrl, setFirmaDataUrl] = useState(null); // para incrustar en el PDF
    const canvasRef = useRef(null);
    const isMounted = useRef(true);

    useEffect(() => {
        isMounted.current = true;
        return () => { isMounted.current = false; };
    }, []);

    const fetchEntrega = useCallback(async () => {
        if (!entregaId) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('entregas_empleado')
                .select('*, empleado:empleados!empleado_id(nombre, apellidos, nombre_completo, dni_nie, fecha_nacimiento, fecha_incorporacion)')
                .eq('id', entregaId)
                .single();
            if (error) throw error;
            if (isMounted.current) setEntrega(data);
        } catch (error) {
            toast({ variant: 'destructive', title: 'No se pudo cargar la entrega', description: error.message });
        } finally {
            if (isMounted.current) setLoading(false);
        }
    }, [entregaId]);

    useEffect(() => { fetchEntrega(); }, [fetchEntrega]);

    const isCanvasEmpty = () => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const ctx = canvas.getContext('2d');
        return !ctx.getImageData(0, 0, canvas.width, canvas.height).data.some(channel => channel !== 0);
    };

    const handleClearSignature = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const esElDestinatario = empleadoId && entrega && empleadoId === entrega.empleado_id;

    const handleFirmar = async () => {
        if (isCanvasEmpty()) {
            toast({ variant: 'destructive', title: 'Falta la firma', description: 'Firma en el recuadro antes de confirmar.' });
            return;
        }

        setSaving(true);
        try {
            const canvas = canvasRef.current;
            const dataUrl = canvas.toDataURL('image/png');
            setFirmaDataUrl(dataUrl);

            // 1. Subir la firma
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const firmaPath = `firmas/${entregaId}_${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage
                .from('entregas_empleado')
                .upload(firmaPath, blob, { contentType: 'image/png', upsert: true });
            if (uploadError) throw new Error(`Error subiendo la firma: ${uploadError.message}`);

            // 2. Generar el PDF justificante a partir de la plantilla oculta
            //    (esperamos un tick para que el <img> con la firma ya esté pintado)
            await new Promise(r => setTimeout(r, 150));
            const element = document.getElementById('entrega-pdf-template');
            const pdfBlob = await html2pdf().set({
                margin: [10, 10, 10, 10],
                filename: `Entrega_${entregaId.slice(0, 8)}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            }).from(element).outputPdf('blob');

            const pdfPath = `pdf/${entregaId}.pdf`;
            const { error: pdfUploadError } = await supabase.storage
                .from('entregas_empleado')
                .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true });
            if (pdfUploadError) throw new Error(`Error subiendo el PDF: ${pdfUploadError.message}`);

            // 3. Marcar la entrega como firmada
            const { error: updateError } = await supabase
                .from('entregas_empleado')
                .update({
                    estado: 'firmado',
                    firma_url: firmaPath,
                    pdf_url: pdfPath,
                    firmado_at: new Date().toISOString(),
                })
                .eq('id', entregaId);
            if (updateError) throw updateError;

            // 5. Marcar la notificación original como leída (best-effort, no bloquea si falla)
            try {
                await supabase
                    .from('notificaciones')
                    .update({ estado: 'leida' })
                    .eq('entidad_id', entregaId)
                    .eq('empleado_id', empleadoId);
            } catch (_) { /* no crítico */ }

            // 6. Copiar el justificante a la carpeta de Documentación del empleado
            //    (solo lectura para él, no puede borrarlo — se hace con permisos elevados
            //    porque el empleado no tiene permiso de escritura en esa carpeta).
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                const accessToken = sessionData?.session?.access_token;
                if (accessToken) {
                    await fetch(`${supabase.supabaseUrl}/functions/v1/registrar-documento-entrega`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({ entrega_id: entregaId }),
                    });
                }
            } catch (_) { /* no crítico, no bloquea la firma */ }

            toast({ title: 'Firmado', description: 'Gracias, la entrega ha quedado registrada.' });
            fetchEntrega();
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error al firmar', description: error.message });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    if (!entrega) {
        return <p className="text-center text-muted-foreground py-16">Esta entrega ya no existe o no está disponible.</p>;
    }

    const yaFirmado = entrega.estado === 'firmado';

    return (
        <div className="max-w-lg mx-auto p-4 space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <PackageCheck className="w-5 h-5" /> Entrega de material
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Para</p>
                        <p className="font-medium">{entrega.empleado?.nombre} {entrega.empleado?.apellidos || ''}</p>
                        {entrega.empleado?.nombre_completo && (
                            <p className="text-xs text-muted-foreground">{entrega.empleado.nombre_completo}</p>
                        )}
                        {entrega.empleado?.dni_nie && (
                            <p className="text-xs text-muted-foreground">DNI/NIE: {entrega.empleado.dni_nie}</p>
                        )}
                    </div>

                    <div>
                        <p className="text-sm text-muted-foreground mb-1">Elementos entregados</p>
                        <ul className="text-sm border rounded-lg divide-y">
                            {(entrega.items || []).map((it, i) => (
                                <li key={i} className="flex justify-between px-3 py-2">
                                    <span>{it.nombre}</span>
                                    <span className="text-muted-foreground">x{it.cantidad}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {entrega.notas && (
                        <div>
                            <p className="text-sm text-muted-foreground">Notas</p>
                            <p className="text-sm">{entrega.notas}</p>
                        </div>
                    )}

                    {yaFirmado ? (
                        <div className="flex flex-col items-center gap-2 py-4 text-center">
                            <CheckCircle2 className="w-10 h-10 text-green-600" />
                            <p className="font-medium">Ya has firmado esta entrega</p>
                            <p className="text-xs text-muted-foreground">
                                {fmtMadrid(entrega.firmado_at)}
                            </p>
                        </div>
                    ) : !esElDestinatario ? (
                        <p className="text-sm text-muted-foreground italic text-center py-4">
                            Esta entrega no está pendiente de tu firma.
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Firma aquí para confirmar la recepción:</p>
                            <SignaturePad canvasRef={canvasRef} onClear={handleClearSignature} />
                            <Button onClick={handleFirmar} disabled={saving} className="w-full gap-2">
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Confirmar recepción y firmar
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Plantilla oculta para generar el PDF — igual de patrón que parte-pdf-template */}
            <div style={{ position: 'absolute', left: '-9999px', top: 0, width: '190mm' }}>
                <div id="entrega-pdf-template" style={{ padding: '20px', fontFamily: 'Arial, sans-serif', fontSize: '12px', color: '#111' }}>
                    <h2 style={{ marginBottom: 4 }}>Orkaled Instalaciones SLU</h2>
                    <h3 style={{ marginTop: 0, marginBottom: 16 }}>Acta de entrega de material</h3>
                    <p><strong>Empleado:</strong> {entrega.empleado?.nombre_completo || `${entrega.empleado?.nombre || ''} ${entrega.empleado?.apellidos || ''}`.trim()}</p>
                    {entrega.empleado?.dni_nie && <p><strong>DNI/NIE:</strong> {entrega.empleado.dni_nie}</p>}
                    {entrega.empleado?.fecha_incorporacion && (
                        <p><strong>Fecha de incorporación:</strong> {new Date(entrega.empleado.fecha_incorporacion).toLocaleDateString('es-ES')}</p>
                    )}
                    <p><strong>Fecha del acta:</strong> {fmtMadrid(new Date())}</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'left', borderBottom: '1px solid #ccc', padding: '4px 0' }}>Elemento</th>
                                <th style={{ textAlign: 'right', borderBottom: '1px solid #ccc', padding: '4px 0' }}>Cantidad</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(entrega.items || []).map((it, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '4px 0', borderBottom: '1px solid #eee' }}>{it.nombre}</td>
                                    <td style={{ padding: '4px 0', borderBottom: '1px solid #eee', textAlign: 'right' }}>{it.cantidad}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {entrega.notas && <p style={{ marginTop: 12 }}><strong>Notas:</strong> {entrega.notas}</p>}
                    <p style={{ marginTop: 24 }}>El empleado confirma haber recibido los elementos anteriores en buen estado, firmando electrónicamente a continuación:</p>
                    {firmaDataUrl && (
                        <img src={firmaDataUrl} alt="Firma" style={{ maxHeight: '80px', marginTop: 8 }} />
                    )}
                    <p style={{ marginTop: 24, fontSize: '10px', color: '#666' }}>
                        Documento generado y firmado electrónicamente desde el ERP de Orkaled Instalaciones SLU.
                    </p>
                </div>
            </div>
        </div>
    );
}
