import React, { useState, useEffect, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/customSupabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Loader2, ArrowLeft, FileDown, Eraser, PenTool, CheckCircle2, User, Calendar as CalendarIcon, FileText } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { fmtMadrid } from '@/lib/utils';
import html2pdf from 'html2pdf.js';

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
        <div className="relative border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 dark:bg-gray-900/50 touch-none select-none overflow-hidden">
            <canvas
                ref={canvasRef}
                className="w-full h-40 cursor-crosshair block touch-none"
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

// --- Main Component ---
const ProjectCompletionCertificate = ({ navigate, projectId: propProjectId }) => {
    const params = useParams();
    // Use prop if available (manual router), otherwise fallback to params (standard router)
    const projectId = propProjectId || params.projectId;

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [project, setProject] = useState(null);
    const signatureRef = useRef(null);
    
    const [signatureUrl, setSignatureUrl] = useState(null);
    const [companySignatureSrc, setCompanySignatureSrc] = useState(null);

    // Load company signature as blob/base64 to avoid CORS issues in PDF generation
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

    // Form State
    const [formData, setFormData] = useState({
        expediente: '',
        centro: '',
        objeto: '',
        fecha_inicio: '',
        fecha_fin: '',
        responsable: 'Miguel Ángel',
        empresa: 'ORKALED INSTALACIONES S.L.U.',
        garantia: '12 meses desde la fecha de finalización'
    });

    // Redirect if no projectId
    useEffect(() => {
        if (loading) return; // Wait until loading attempt finishes
        if (!projectId) {
            navigate('/gestion/actas-finalizacion');
        }
    }, [projectId, navigate, loading]);

    // Fetch Project Data
    useEffect(() => {
        const fetchProject = async () => {
            if (!projectId) {
                setLoading(false);
                return;
            }

            try {
                const { data: proj, error } = await supabase
                    .from('proyectos')
                    .select(`*, cliente:clientes(nombre)`)
                    .eq('id', projectId)
                    .single();

                if (error) throw error;

                if (proj) {
                    setProject(proj);
                    setFormData(prev => ({
                        ...prev,
                        expediente: proj.id.substring(0, 8).toUpperCase(), // Short ID as ref
                        centro: proj.cliente?.nombre || 'Cliente Final',
                        objeto: proj.nombre_proyecto || 'Reforma General',
                        fecha_inicio: proj.fecha_inicio ? proj.fecha_inicio.split('T')[0] : '',
                        fecha_fin: proj.fecha_fin_real ? proj.fecha_fin_real.split('T')[0] : new Date().toISOString().split('T')[0]
                    }));
                }
            } catch (err) {
                console.error("Error loading project:", err);
                toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los datos del proyecto." });
            } finally {
                setLoading(false);
            }
        };

        fetchProject();
    }, [projectId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
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

    const generatePDF = async () => {
        if (!signatureUrl) {
            toast({ variant: "warning", title: "Falta firma", description: "Por favor, firme el documento antes de generar el PDF." });
            return;
        }

        setGenerating(true);
        // We use a specific ID for the printable area
        const element = document.getElementById('certificate-template');
        
        // Wait for images to be ready/rendered if needed
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Configure PDF options for optimal A4 fit without cutting off content
        const opt = {
            margin: 0, // Set margin to 0 to allow full control via CSS padding
            filename: `Acta_Final_${formData.expediente}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { 
                scale: 2, 
                useCORS: true, 
                logging: false,
                scrollY: 0, // Ensure capture starts from top
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(element).save();
            toast({ title: "PDF Generado", description: "El documento se ha descargado correctamente." });
        } catch (error) {
            console.error("PDF Generation Error:", error);
            toast({ variant: "destructive", title: "Error", description: "Fallo al generar el PDF. Inténtelo de nuevo." });
        } finally {
            setGenerating(false);
        }
    };

    if (loading) {
        return <div className="flex h-screen w-full items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (!projectId) return null;

    return (
        <div className="flex flex-col h-screen bg-gray-50/50 dark:bg-background">
            <Helmet>
                <title>Acta de Finalización | OrkaRefor</title>
            </Helmet>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-card border-b sticky top-0 z-20 shadow-sm">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/gestion/obras')}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-bold text-gray-900 dark:text-foreground leading-tight">Acta de Finalización</h1>
                        <p className="text-xs text-muted-foreground hidden sm:block">Proyecto: {project?.nombre_proyecto}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        onClick={generatePDF} 
                        disabled={generating || !signatureUrl} 
                        className="bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-all"
                    >
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                        {generating ? 'Generando...' : 'Descargar PDF'}
                    </Button>
                </div>
            </div>

            {/* Content Split */}
            <div className="flex-1 overflow-hidden">
                <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
                    
                    {/* LEFT: Editor & Signature Input */}
                    <div className="lg:col-span-4 p-4 sm:p-6 overflow-y-auto bg-white dark:bg-card border-r custom-scrollbar">
                        <div className="space-y-6 max-w-lg mx-auto lg:mx-0">
                            
                            {/* Signature Section */}
                            <Card className="border-2 border-blue-100 dark:border-blue-900 overflow-hidden">
                                <CardContent className="p-4 space-y-3 bg-blue-50/30 dark:bg-blue-950/10">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-base font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                                            <PenTool className="w-4 h-4" /> Firma del Cliente / Centro
                                        </Label>
                                        {signatureUrl && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                    </div>
                                    <SignaturePad 
                                        canvasRef={signatureRef} 
                                        onClear={handleClearSignature} 
                                        onEnd={handleSignatureEnd}
                                    />
                                    <p className="text-xs text-muted-foreground text-center">
                                        Por favor, firme en el recuadro superior. Esta firma aparecerá en el documento final.
                                    </p>
                                </CardContent>
                            </Card>

                            <Separator className="my-6" />

                            <div className="space-y-4">
                                <h2 className="text-sm font-semibold uppercase text-muted-foreground flex items-center gap-2 mb-4">
                                    <FileText className="w-4 h-4" /> Datos del Documento
                                </h2>
                                
                                <div className="grid gap-2">
                                    <Label htmlFor="expediente">Nº Expediente / Ref.</Label>
                                    <Input id="expediente" name="expediente" value={formData.expediente} onChange={handleChange} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="centro">Centro / Ubicación</Label>
                                    <Input id="centro" name="centro" value={formData.centro} onChange={handleChange} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="objeto">Objeto de la Obra</Label>
                                    <Textarea id="objeto" name="objeto" value={formData.objeto} onChange={handleChange} className="min-h-[80px]" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="fecha_inicio">Fecha Inicio</Label>
                                        <div className="relative">
                                            <Input id="fecha_inicio" type="date" name="fecha_inicio" value={formData.fecha_inicio} onChange={handleChange} className="pl-9" />
                                            <CalendarIcon className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="fecha_fin">Fecha Fin</Label>
                                        <div className="relative">
                                            <Input id="fecha_fin" type="date" name="fecha_fin" value={formData.fecha_fin} onChange={handleChange} className="pl-9" />
                                            <CalendarIcon className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="responsable">Responsable Técnico</Label>
                                    <div className="relative">
                                        <Input id="responsable" name="responsable" value={formData.responsable} onChange={handleChange} className="pl-9" />
                                        <User className="w-4 h-4 text-muted-foreground absolute left-3 top-3 pointer-events-none" />
                                    </div>
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="garantia">Periodo de Garantía</Label>
                                    <Input id="garantia" name="garantia" value={formData.garantia} onChange={handleChange} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT: Live Preview (A4 simulation) */}
                    <div className="lg:col-span-8 p-8 bg-gray-100 dark:bg-zinc-950 overflow-y-auto flex justify-center items-start custom-scrollbar">
                        
                        {/* A4 Page */}
                        <div 
                            id="certificate-template" 
                            className="bg-white text-black shadow-2xl p-[15mm] relative box-border mx-auto transition-transform origin-top"
                            style={{ 
                                width: '210mm', 
                                minHeight: '297mm',
                                fontSize: '11pt',
                                lineHeight: '1.5',
                                boxSizing: 'border-box' // Important for accurate width calculation including padding
                            }}
                        >
                            {/* REMOVED LOGOS HEADER TO SAVE SPACE */}
                            
                            {/* Title */}
                            <div className="text-center mb-8 mt-4">
                                <h1 className="text-2xl font-bold uppercase tracking-wide border-b-2 border-black inline-block pb-2 px-8">
                                    Acta de Finalización de Obra
                                </h1>
                            </div>

                            {/* Info Table */}
                            <div className="mb-8 border border-black text-sm">
                                <div className="flex border-b border-black">
                                    <div className="w-1/3 bg-gray-100 p-2 font-bold border-r border-black uppercase flex items-center">Nº Expediente:</div>
                                    <div className="w-2/3 p-2 font-mono text-base">{formData.expediente}</div>
                                </div>
                                <div className="flex border-b border-black">
                                    <div className="w-1/3 bg-gray-100 p-2 font-bold border-r border-black uppercase flex items-center">Centro:</div>
                                    <div className="w-2/3 p-2 uppercase">{formData.centro}</div>
                                </div>
                                <div className="flex border-b border-black">
                                    <div className="w-1/3 bg-gray-100 p-2 font-bold border-r border-black uppercase flex items-center">Objeto:</div>
                                    <div className="w-2/3 p-2">{formData.objeto}</div>
                                </div>
                                <div className="flex">
                                    <div className="w-1/3 bg-gray-100 p-2 font-bold border-r border-black uppercase flex items-center">Contratista:</div>
                                    <div className="w-2/3 p-2 font-bold">{formData.empresa}</div>
                                </div>
                            </div>

                            {/* Body Text - Reduced spacing */}
                            <div className="space-y-4 text-justify mb-8 leading-relaxed">
                                <p>
                                    <strong>D./Dña. {formData.responsable}</strong>, en calidad de Responsable Técnico de la empresa contratista <strong>{formData.empresa}</strong>,
                                </p>
                                <p className="text-center font-bold text-lg my-4">CERTIFICA:</p>
                                <p>
                                    Que las obras y trabajos correspondientes al expediente referenciado han sido ejecutados conforme al proyecto, presupuesto y órdenes de la Dirección Facultativa, habiendo finalizado los mismos a entera satisfacción.
                                </p>
                                <p>
                                    Asimismo, se hace constar que:
                                </p>
                                <ul className="list-disc pl-12 space-y-1">
                                    <li>La <strong>fecha de inicio</strong> de los trabajos fue el <strong>{formData.fecha_inicio ? fmtMadrid(formData.fecha_inicio, 'date') : '___/___/____'}</strong>.</li>
                                    <li>La <strong>fecha de terminación</strong> efectiva ha sido el <strong>{formData.fecha_fin ? fmtMadrid(formData.fecha_fin, 'date') : '___/___/____'}</strong>.</li>
                                    <li>Las instalaciones quedan en perfecto estado de funcionamiento y operativas.</li>
                                    <li>Se establece un periodo de garantía de <strong>{formData.garantia}</strong>.</li>
                                </ul>
                                <p className="mt-4">
                                    Y para que conste a los efectos oportunos, se firma la presente acta por duplicado ejemplar en el lugar y fecha indicados.
                                </p>
                            </div>

                            {/* Location Date */}
                            <div className="text-right mb-12">
                                <p>En Madrid, a {fmtMadrid(new Date(), 'date')}</p>
                            </div>

                            {/* Signatures - Reduced gap */}
                            <div className="grid grid-cols-2 gap-8 items-end">
                                {/* Left: Company */}
                                <div className="text-center">
                                    <p className="font-bold mb-4 uppercase text-xs tracking-wider">Por la Empresa Contratista</p>
                                    <div className="h-32 flex items-end justify-center relative border-b border-black mx-4 pb-2">
                                        {/* Static Seal Image - Base64 preferred */}
                                        {companySignatureSrc ? (
                                            <img 
                                                alt="Sello y Firma ORKALED" 
                                                className="h-28 w-auto object-contain absolute bottom-0 opacity-90" 
                                                src={companySignatureSrc}
                                                // No crossOrigin if base64
                                            />
                                        ) : (
                                            <Loader2 className="animate-spin h-6 w-6 text-gray-400" />
                                        )}
                                    </div>
                                    <p className="mt-2 font-bold text-xs">{formData.empresa}</p>
                                </div>

                                {/* Right: Client (Dynamic) */}
                                <div className="text-center">
                                    <p className="font-bold mb-4 uppercase text-xs tracking-wider">Por el Centro / Conformidad</p>
                                    <div className="h-32 flex items-end justify-center relative border-b border-black mx-4 pb-2">
                                        {signatureUrl ? (
                                            <img src={signatureUrl} className="h-24 w-auto object-contain" alt="Firma digital" />
                                        ) : (
                                            <span className="text-xs text-gray-300 italic mb-4">Pendiente de firma...</span>
                                        )}
                                    </div>
                                    <p className="mt-2 font-bold text-xs uppercase">{formData.centro}</p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectCompletionCertificate;