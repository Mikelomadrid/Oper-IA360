import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowLeft, FileDown, Eraser, PenTool, CheckCircle2, FileText, Plus, Save } from 'lucide-react';
import { AsyncSearchableSelector } from './AsyncSearchableSelector';
import { fmtMadrid } from '@/lib/utils';
import html2pdf from 'html2pdf.js';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from '@/contexts/SupabaseAuthContext';

const COMPANY_SIGNATURE_URL = "https://horizons-cdn.hostinger.com/808fff9f-110a-4f5f-89b2-8e5912626737/449538f84cafe27b85243ad77dc49d78.png";

// --- Signature Pad Component ---
const SignaturePad = ({ canvasRef, onClear, onEnd }) => {
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
                canvas.height = 160;
                // re-apply context settings after resize
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                ctx.strokeStyle = '#000000';
            }
        };

        // Small delay to ensure parent is rendered (especially in modals)
        const timer = setTimeout(resizeCanvas, 100);
        window.addEventListener('resize', resizeCanvas);
        
        return () => {
            window.removeEventListener('resize', resizeCanvas);
            clearTimeout(timer);
        };
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
        if (e.cancelable) e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        if (e.cancelable) e.preventDefault();
        const { x, y } = getCoordinates(e);
        const ctx = canvasRef.current.getContext('2d');
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (onEnd) onEnd();
        }
    };

    return (
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-900/50 touch-none select-none overflow-hidden h-40">
            <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair block touch-none"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
                style={{ touchAction: 'none' }}
            />
            <div className="absolute top-2 left-2 pointer-events-none">
                <span className="text-[10px] uppercase text-muted-foreground font-semibold bg-white/80 px-2 py-1 rounded dark:bg-black/50">
                    Espacio para firmar
                </span>
            </div>
            <Button 
                type="button"
                variant="outline" 
                size="sm" 
                onClick={onClear} 
                className="absolute top-2 right-2 h-8 w-8 p-0 bg-white/80 hover:bg-white dark:bg-black/50 dark:hover:bg-black/70"
                title="Borrar firma"
            >
                <Eraser className="h-4 w-4 text-muted-foreground" />
            </Button>
        </div>
    );
};

// --- Create Form with Signature Modal ---
const CreateCertificateForm = ({ projectId, onCreated, onCancel }) => {
    const { empleadoId } = useAuth();
    const [loading, setLoading] = useState(false);
    const [showSignatureModal, setShowSignatureModal] = useState(false);
    const [signerName, setSignerName] = useState('');
    const signatureRef = useRef(null);
    const [signatureUrl, setSignatureUrl] = useState(null);

    const [formData, setFormData] = useState({
        project_id: projectId || '',
        expediente: '',
        centro: '',
        objeto: '',
        fecha_inicio: '',
        fecha_fin: '',
        responsable: 'Miguel Ángel',
        empresa: 'ORKALED INSTALACIONES S.L.U.',
        garantia: '12 meses desde la fecha de finalización'
    });

    // Initial load if projectId is passed
    useEffect(() => {
        const loadProject = async () => {
            if (projectId && !formData.objeto) {
                const { data } = await supabase.from('proyectos').select('nombre_proyecto, fecha_inicio, fecha_fin_real, cliente:clientes(nombre)').eq('id', projectId).single();
                if (data) {
                    setFormData(prev => ({
                        ...prev,
                        expediente: projectId.substring(0, 8).toUpperCase(),
                        objeto: data.nombre_proyecto,
                        centro: data.cliente?.nombre || '',
                        fecha_inicio: data.fecha_inicio ? data.fecha_inicio.split('T')[0] : '',
                        fecha_fin: data.fecha_fin_real ? data.fecha_fin_real.split('T')[0] : new Date().toISOString().split('T')[0]
                    }));
                }
            }
        };
        loadProject();
    }, [projectId]);

    const fetchProjects = async (search) => {
        let query = supabase.from('proyectos').select('id, nombre_proyecto, fecha_inicio, cliente:clientes(nombre)').ilike('nombre_proyecto', `%${search}%`).order('nombre_proyecto');
        const { data } = await query;
        return data.map(p => ({ value: p.id, label: p.nombre_proyecto, fecha_inicio: p.fecha_inicio, cliente_nombre: p.cliente?.nombre }));
    };

    const handleProjectSelect = (value, label, extra) => {
        setFormData(prev => ({
            ...prev,
            project_id: value,
            expediente: value.substring(0, 8).toUpperCase(),
            objeto: label,
            centro: extra?.cliente_nombre || '',
            fecha_inicio: extra?.fecha_inicio ? extra.fecha_inicio.split('T')[0] : ''
        }));
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handlePreSubmit = (e) => {
        e.preventDefault();
        if (!formData.project_id) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selecciona un proyecto.' });
            return;
        }
        if (!formData.centro || !formData.objeto) {
            toast({ variant: 'destructive', title: 'Error', description: 'Complete los campos obligatorios (Centro, Objeto).' });
            return;
        }
        setShowSignatureModal(true);
    };

    const handleClearSignature = () => {
        const canvas = signatureRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            setSignatureUrl(null);
        }
    };

    const handleSignatureEnd = () => {
        const canvas = signatureRef.current;
        if (canvas) {
            setSignatureUrl(canvas.toDataURL());
        }
    };

    const handleSaveAndFinish = async () => {
        if (!signatureUrl) {
            toast({ variant: 'destructive', title: 'Firma requerida', description: 'Debe firmar el documento para finalizar.' });
            return;
        }
        if (!signerName) {
            toast({ variant: 'destructive', title: 'Nombre requerido', description: 'Indique el nombre del firmante.' });
            return;
        }
        if (!empleadoId) {
            toast({ variant: 'destructive', title: 'Error de sesión', description: 'No se pudo identificar al empleado actual. Recarga la página.' });
            return;
        }

        setLoading(true);
        try {
            // 1. Upload Signature
            const blob = await (await fetch(signatureUrl)).blob();
            const fileName = `signature_acta_${formData.project_id}_${Date.now()}.png`;
            const { error: uploadError } = await supabase.storage.from('signatures').upload(fileName, blob);
            if (uploadError) throw uploadError;
            
            const signaturePublicUrl = supabase.storage.from('signatures').getPublicUrl(fileName).data.publicUrl;

            // 2. Insert Record
            const { data, error } = await supabase.from('project_completion_certificates').insert([{
                project_id: formData.project_id,
                expediente: formData.expediente,
                centro: formData.centro,
                objeto: formData.objeto,
                fecha_inicio: formData.fecha_inicio || null,
                fecha_fin: formData.fecha_fin || null,
                responsable_tecnico: formData.responsable,
                empresa_contratista: formData.empresa,
                periodo_garantia: formData.garantia,
                status: 'signed', // Saved as signed directly
                client_signature_url: signaturePublicUrl,
                client_signer_name: signerName,
                client_signed_at: new Date(),
                created_by: empleadoId 
            }]).select();

            if (error) throw error;

            toast({ title: 'Acta Creada', description: 'El acta se ha guardado correctamente y está lista para descargar.' });
            
            // Close modal and notify parent (which should likely redirect to viewer)
            setShowSignatureModal(false);
            if (onCreated && data[0]) onCreated(data[0]); 

        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el acta. ' + (err.message || '') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-4 p-4 border rounded-lg bg-card max-w-4xl mx-auto my-6 shadow-sm">
            <div className="flex justify-between items-center mb-2 border-b pb-4">
                <div>
                    <h3 className="text-xl font-bold">Nueva Acta de Finalización</h3>
                    <p className="text-sm text-muted-foreground">Complete los datos y firme para generar el acta.</p>
                </div>
                <Button variant="ghost" onClick={onCancel}><ArrowLeft className="mr-2 h-4 w-4"/> Cancelar</Button>
            </div>
            
            <form onSubmit={handlePreSubmit} className="space-y-6">
                {/* Project Selector */}
                <div className="space-y-2">
                    <Label className="text-base">Selección de Proyecto</Label>
                    <div className="max-w-md">
                        <AsyncSearchableSelector 
                            fetcher={fetchProjects} 
                            placeholder="Buscar proyecto por nombre..." 
                            value={formData.project_id}
                            initialLabel={formData.objeto}
                            onSelect={(val, label, extra) => handleProjectSelect(val, label, extra)} 
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="expediente">Nº Expediente / Referencia</Label>
                        <Input id="expediente" name="expediente" value={formData.expediente} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="centro">Centro / Ubicación <span className="text-red-500">*</span></Label>
                        <Input id="centro" name="centro" value={formData.centro} onChange={handleChange} required placeholder="Ej: Comunidad Propietarios..." />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="objeto">Objeto de la Obra <span className="text-red-500">*</span></Label>
                    <Textarea id="objeto" name="objeto" value={formData.objeto} onChange={handleChange} required className="min-h-[80px]" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="fecha_inicio">Fecha Inicio Obra</Label>
                        <Input type="date" id="fecha_inicio" name="fecha_inicio" value={formData.fecha_inicio} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="fecha_fin">Fecha Fin Obra</Label>
                        <Input type="date" id="fecha_fin" name="fecha_fin" value={formData.fecha_fin} onChange={handleChange} />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <Label htmlFor="responsable">Responsable Técnico</Label>
                        <Input id="responsable" name="responsable" value={formData.responsable} onChange={handleChange} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="garantia">Periodo Garantía</Label>
                        <Input id="garantia" name="garantia" value={formData.garantia} onChange={handleChange} />
                    </div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="empresa">Empresa Contratista</Label>
                    <Input id="empresa" name="empresa" value={formData.empresa} onChange={handleChange} />
                </div>

                <div className="flex justify-end pt-6">
                    <Button type="submit" size="lg" className="bg-blue-600 hover:bg-blue-700">
                        <PenTool className="mr-2 h-4 w-4" /> Firmar Acta
                    </Button>
                </div>
            </form>

            {/* Signature Modal */}
            <Dialog open={showSignatureModal} onOpenChange={setShowSignatureModal}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Firma de Conformidad</DialogTitle>
                        <DialogDescription>
                            El cliente debe firmar a continuación para dar conformidad a la finalización de la obra.
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Nombre del Firmante</Label>
                            <Input 
                                value={signerName} 
                                onChange={(e) => setSignerName(e.target.value)} 
                                placeholder="Nombre y Apellidos de quien firma" 
                            />
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Firma Digital</Label>
                            <SignaturePad 
                                canvasRef={signatureRef} 
                                onClear={handleClearSignature} 
                                onEnd={handleSignatureEnd}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowSignatureModal(false)} disabled={loading}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSaveAndFinish} disabled={loading || !signatureUrl || !signerName}>
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Crear Acta y Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const CertificateViewer = ({ certificate, onBack }) => {
    const [generating, setGenerating] = useState(false);
    const [companySignatureSrc, setCompanySignatureSrc] = useState(null);

    // Pre-load signature as Base64 to ensure it renders in HTML2Canvas (bypass CORS)
    useEffect(() => {
        const loadSignature = async () => {
            try {
                const response = await fetch(COMPANY_SIGNATURE_URL);
                if (!response.ok) throw new Error('Failed to load image');
                const blob = await response.blob();
                const reader = new FileReader();
                reader.onloadend = () => {
                    setCompanySignatureSrc(reader.result);
                };
                reader.readAsDataURL(blob);
            } catch (e) {
                console.error("Error loading company signature, falling back to URL", e);
                setCompanySignatureSrc(COMPANY_SIGNATURE_URL);
            }
        };
        loadSignature();
    }, []);

    const handleGeneratePDF = async () => {
        setGenerating(true);
        try {
            const element = document.getElementById('certificate-template');
            // Wait longer for images to settle
            await new Promise(r => setTimeout(r, 1500));

            const opt = {
                margin: [10, 10, 10, 10],
                filename: `Acta_${certificate.expediente}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            const pdfBlob = await html2pdf().set(opt).from(element).output('blob');
            const pdfName = `Acta_Final_${certificate.expediente}_${Date.now()}.pdf`;
            
            const { error: pdfUploadError } = await supabase.storage.from('project_docs_generated').upload(pdfName, pdfBlob);
            if (pdfUploadError) throw pdfUploadError;

            const finalPdfUrl = supabase.storage.from('project_docs_generated').getPublicUrl(pdfName).data.publicUrl;

            // Update Record
            await supabase.from('project_completion_certificates')
                .update({ final_pdf_url: finalPdfUrl })
                .eq('id', certificate.id);

            // Trigger download locally
            html2pdf().set(opt).from(element).save();
            toast({ title: 'PDF Generado', description: 'El PDF se ha generado y guardado correctamente.' });
            
            if(onBack) onBack(); 

        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Error al generar el PDF.' });
        } finally {
            setGenerating(false);
        }
    };

    return (
        <div className="flex flex-col lg:flex-row h-full gap-4">
            {/* Left Control Panel */}
            <div className="w-full lg:w-1/3 space-y-4 p-4 bg-card border rounded-lg overflow-y-auto max-h-[calc(100vh-100px)]">
                <Button variant="ghost" onClick={onBack} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Volver
                </Button>
                
                <div className="text-center p-6 space-y-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900">
                    <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto" />
                    <h3 className="font-bold text-green-700 dark:text-green-400">Acta Firmada</h3>
                    <div className="text-sm space-y-1">
                        <p>Firmado por: <strong>{certificate.client_signer_name}</strong></p>
                        <p className="text-muted-foreground">{format(parseISO(certificate.client_signed_at), 'dd/MM/yyyy HH:mm')}</p>
                    </div>
                    
                    {certificate.final_pdf_url ? (
                        <Button className="w-full" onClick={() => window.open(certificate.final_pdf_url, '_blank')}>
                            <FileDown className="mr-2 h-4 w-4" /> Descargar PDF
                        </Button>
                    ) : (
                        <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleGeneratePDF} disabled={generating}>
                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                            Generar PDF Final
                        </Button>
                    )}
                </div>
            </div>

            {/* Right Preview Panel */}
            <div className="flex-1 bg-gray-100 dark:bg-zinc-950 p-4 lg:p-8 overflow-y-auto flex justify-center items-start rounded-lg border">
                <div 
                    id="certificate-template" 
                    className="bg-white text-black shadow-2xl mx-auto"
                    style={{ 
                        width: '210mm', 
                        minHeight: '297mm',
                        padding: '15mm', // Reduced padding
                        fontSize: '10pt', // Reduced font size for better fit
                        lineHeight: '1.35', // Tighter lines
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                    }}
                >
                    {/* Header Title */}
                    <div className="text-center mb-8 mt-4">
                        <h1 className="text-xl font-bold uppercase tracking-widest border-b-2 border-black inline-block pb-2">
                            Acta de Finalización de Obra
                        </h1>
                    </div>

                    {/* Data Box */}
                    <div className="mb-8 border border-black">
                        <div className="flex border-b border-black">
                            <div className="w-1/3 bg-gray-50 p-2 font-bold border-r border-black uppercase text-xs tracking-wider">Nº Expediente</div>
                            <div className="w-2/3 p-2 font-mono font-medium">{certificate.expediente}</div>
                        </div>
                        <div className="flex border-b border-black">
                            <div className="w-1/3 bg-gray-50 p-2 font-bold border-r border-black uppercase text-xs tracking-wider">Centro / Cliente</div>
                            <div className="w-2/3 p-2 font-medium uppercase">{certificate.centro}</div>
                        </div>
                        <div className="flex border-b border-black">
                            <div className="w-1/3 bg-gray-50 p-2 font-bold border-r border-black uppercase text-xs tracking-wider">Objeto de Obra</div>
                            <div className="w-2/3 p-2 italic text-sm">{certificate.objeto}</div>
                        </div>
                        <div className="flex">
                            <div className="w-1/3 bg-gray-50 p-2 font-bold border-r border-black uppercase text-xs tracking-wider">Contratista</div>
                            <div className="w-2/3 p-2 font-bold">{certificate.empresa_contratista}</div>
                        </div>
                    </div>

                    {/* Certification Text */}
                    <div className="space-y-4 text-justify leading-relaxed mb-8 flex-grow">
                        <p>
                            <strong>D./Dña. {certificate.responsable_tecnico}</strong>, en calidad de Responsable Técnico de la empresa contratista <strong>{certificate.empresa_contratista}</strong>,
                        </p>
                        
                        <p className="text-center font-bold text-base my-4 tracking-widest">CERTIFICA:</p>
                        
                        <p>
                            Que las obras y trabajos correspondientes al expediente referenciado han sido ejecutados conforme al proyecto, presupuesto y órdenes de la Dirección Facultativa, habiendo finalizado los mismos a entera satisfacción.
                        </p>
                        
                        <p>Asimismo, se hace constar que:</p>
                        
                        <ul className="list-disc pl-8 space-y-2 ml-4 text-sm">
                            <li>
                                La <strong>fecha de inicio</strong> de los trabajos fue el <strong>{certificate.fecha_inicio ? fmtMadrid(certificate.fecha_inicio, 'date') : '___/___/____'}</strong>.
                            </li>
                            <li>
                                La <strong>fecha de terminación</strong> efectiva ha sido el <strong>{certificate.fecha_fin ? fmtMadrid(certificate.fecha_fin, 'date') : '___/___/____'}</strong>.
                            </li>
                            <li>
                                Las instalaciones quedan en perfecto estado de funcionamiento y operativas.
                            </li>
                            <li>
                                Se establece un periodo de garantía de <strong>{certificate.periodo_garantia}</strong>.
                            </li>
                        </ul>
                        
                        <p className="mt-4 pt-2">
                            Y para que conste a los efectos oportunos, se firma la presente acta por duplicado ejemplar en el lugar y fecha indicados.
                        </p>
                    </div>

                    {/* Date */}
                    <div className="text-right mb-8 text-sm">
                        <p>En Madrid, a {fmtMadrid(new Date(), 'date')}</p>
                    </div>

                    {/* Signatures */}
                    <div className="grid grid-cols-2 gap-12 mt-auto">
                        <div className="text-center">
                            <p className="font-bold text-xs uppercase tracking-wider mb-4">Por la Empresa Contratista</p>
                            <div className="border-t border-black pt-2 mx-4 min-h-[100px] flex flex-col items-center justify-between">
                                {/* Company Signature Image - Using State for Base64 or Fallback */}
                                <div className="flex-1 flex items-center justify-center py-1 w-full">
                                    {companySignatureSrc ? (
                                        <img 
                                            src={companySignatureSrc} 
                                            alt="Firma Empresa" 
                                            className="block mx-auto max-h-[80px] w-auto object-contain" 
                                            // No crossOrigin here if we are using Base64, but if fallback URL, html2canvas handles fetching
                                        />
                                    ) : (
                                        <div className="h-[80px] w-full flex items-center justify-center">
                                            <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
                                        </div>
                                    )}
                                </div>
                                <div className="w-full">
                                    <p className="font-bold text-sm">{certificate.empresa_contratista}</p>
                                    <p className="text-xs text-gray-600 mt-1">Fdo: {certificate.responsable_tecnico}</p>
                                </div>
                            </div>
                        </div>

                        <div className="text-center">
                            <p className="font-bold text-xs uppercase tracking-wider mb-4">Conformidad de la Propiedad</p>
                            <div className="border-t border-black pt-2 mx-4 min-h-[100px] flex flex-col items-center justify-between">
                                {/* Dynamic Signature Image */}
                                {certificate.client_signature_url ? (
                                    <div className="flex-1 flex items-center justify-center py-1 w-full">
                                        <img 
                                            src={certificate.client_signature_url} 
                                            alt="Firma Cliente" 
                                            className="block mx-auto max-h-[60px] w-auto object-contain"
                                            crossOrigin="anonymous"
                                        />
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center">
                                        <span className="text-[10px] text-gray-400 uppercase tracking-tighter">(Firmado Digitalmente)</span>
                                    </div>
                                )}
                                <div className="w-full">
                                    <p className="font-bold text-sm uppercase leading-tight">{certificate.centro}</p>
                                    <p className="text-xs text-gray-600 mt-1">Fdo: {certificate.client_signer_name}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ProjectCompletionCertificateManager = ({ navigate, projectId: propProjectId }) => {
    const [view, setView] = useState(propProjectId ? 'create' : 'list'); 
    const [selectedCert, setSelectedCert] = useState(null);
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchCertificates = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('project_completion_certificates').select('*, proyectos(nombre_proyecto)').order('created_at', { ascending: false });
        if (error) {
            console.error("Error fetching certificates:", error);
            toast({ variant: "destructive", title: "Error", description: "Error al cargar actas." });
        } else {
            setCertificates(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        if (!propProjectId) fetchCertificates();
    }, [propProjectId]);

    const handleCreateSuccess = (newCert) => {
        setSelectedCert(newCert);
        setView('detail');
        if (!propProjectId) fetchCertificates();
    };

    if (view === 'create') return <CreateCertificateForm projectId={propProjectId} onCreated={handleCreateSuccess} onCancel={() => setView('list')} />;
    if (view === 'detail' && selectedCert) return <CertificateViewer certificate={selectedCert} onBack={() => { setView('list'); fetchCertificates(); }} />;

    return (
        <div className="p-4 md:p-8 space-y-6">
            <Helmet>
                <title>Actas de Finalización | OrkaRefor</title>
            </Helmet>
            
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">Actas de Finalización</h1>
                <Button onClick={() => setView('create')}><Plus className="mr-2 h-4 w-4" /> Nueva Acta</Button>
            </div>

            {loading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
            ) : (
                <div className="bg-card rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Proyecto</TableHead>
                                <TableHead>Expediente</TableHead>
                                <TableHead>Centro</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {certificates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No hay actas registradas.</TableCell>
                                </TableRow>
                            ) : (
                                certificates.map(cert => (
                                    <TableRow key={cert.id}>
                                        <TableCell className="font-medium">{cert.proyectos?.nombre_proyecto || 'N/A'}</TableCell>
                                        <TableCell>{cert.expediente}</TableCell>
                                        <TableCell>{cert.centro}</TableCell>
                                        <TableCell>
                                            <Badge variant={cert.status === 'signed' ? 'default' : 'outline'}>
                                                {cert.status === 'signed' ? 'Firmado' : 'Pendiente'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{format(parseISO(cert.created_at), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost" onClick={() => { setSelectedCert(cert); setView('detail'); }}>
                                                {cert.status === 'signed' ? <FileText className="h-4 w-4" /> : <PenTool className="h-4 w-4" />}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
};

export default ProjectCompletionCertificateManager;