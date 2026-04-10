import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Loader2, 
    FileText, 
    Search, 
    Download, 
    Ban, 
    Plus, 
    Pencil, 
    Trash2, 
    Save, 
    X,
    Building2,
    CalendarDays
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fmtMadrid } from '@/lib/utils';
import html2pdf from 'html2pdf.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const ActaFinalizacion = ({ navigate }) => {
    const { sessionRole } = useAuth();
    const [certificates, setCertificates] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [projects, setProjects] = useState([]);
    
    // CRUD State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
    const [currentCert, setCurrentCert] = useState(null); // Form data
    const [certToDelete, setCertToDelete] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // PDF Generation State
    const [previewOpen, setPreviewOpen] = useState(false);
    const [selectedCertForPdf, setSelectedCertForPdf] = useState(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

    const isAdminOrEncargado = ['admin', 'encargado'].includes(sessionRole?.rol);

    // Initial Data Fetch
    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch Certificates
            let query = supabase
                .from('project_completion_certificates')
                .select(`
                    *,
                    proyecto:proyectos(id, nombre_proyecto, clientes(nombre))
                `)
                .order('created_at', { ascending: false });

            const { data: certsData, error: certsError } = await query;
            if (certsError) throw certsError;

            // Fetch Projects for Selector (Active only or all? Let's get recent ones)
            const { data: projData, error: projError } = await supabase
                .from('proyectos')
                .select('id, nombre_proyecto')
                .order('fecha_creacion', { ascending: false }) // FIXED: created_at -> fecha_creacion
                .limit(100);
            
            if (projError) throw projError;

            setCertificates(certsData || []);
            setProjects(projData || []);

        } catch (error) {
            console.error("Error fetching data:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los datos.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isAdminOrEncargado) {
            fetchData();
        }
    }, [isAdminOrEncargado, fetchData]);

    // Filtering
    const filteredCertificates = certificates.filter(cert => 
        cert.expediente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.proyecto?.nombre_proyecto?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cert.objeto?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // CRUD Handlers
    const handleCreate = () => {
        setCurrentCert({
            project_id: '',
            expediente: '',
            centro: '',
            objeto: '',
            fecha_inicio: '',
            fecha_fin: '',
            responsable_tecnico: '',
            empresa_contratista: 'ORKALED INSTALACIONES S.L.', // Default
            periodo_garantia: '1 año',
            status: 'borrador'
        });
        setIsModalOpen(true);
    };

    const handleEdit = (cert) => {
        setCurrentCert({
            id: cert.id,
            project_id: cert.project_id,
            expediente: cert.expediente || '',
            centro: cert.centro || '',
            objeto: cert.objeto || '',
            fecha_inicio: cert.fecha_inicio || '',
            fecha_fin: cert.fecha_fin || '',
            responsable_tecnico: cert.responsable_tecnico || '',
            empresa_contratista: cert.empresa_contratista || 'ORKALED INSTALACIONES S.L.',
            periodo_garantia: cert.periodo_garantia || '1 año',
            status: cert.status || 'borrador'
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = (cert) => {
        setCertToDelete(cert);
        setIsDeleteAlertOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!certToDelete) return;
        try {
            const { error, count } = await supabase
                .from('project_completion_certificates')
                .delete()
                .eq('id', certToDelete.id)
                .select('*', { count: 'exact' });

            if (error) throw error;

            if (count === 0) {
                throw new Error("No se pudo eliminar el registro. Verifique sus permisos o si el elemento ya fue eliminado.");
            }

            toast({ title: 'Eliminado', description: 'El acta ha sido eliminada correctamente.' });
            setCertificates(prev => prev.filter(c => c.id !== certToDelete.id));
        } catch (error) {
            console.error('Error deleting:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el acta. ' + (error.message || '') });
        } finally {
            setIsDeleteAlertOpen(false);
            setCertToDelete(null);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const isUpdate = !!currentCert.id;
            const payload = { ...currentCert };
            delete payload.id; // Don't send ID in body for update if not needed, or handled by supabase
            
            // Validate required
            if (!payload.project_id) {
                toast({ variant: 'destructive', title: 'Falta Proyecto', description: 'Debes seleccionar un proyecto.' });
                setIsSaving(false);
                return;
            }

            let result;
            if (isUpdate) {
                result = await supabase
                    .from('project_completion_certificates')
                    .update(payload)
                    .eq('id', currentCert.id)
                    .select('*, proyecto:proyectos(id, nombre_proyecto, clientes(nombre))')
                    .single();
            } else {
                payload.created_by = (await supabase.auth.getUser()).data.user?.id; // Fallback handled by DB usually, but good practice
                result = await supabase
                    .from('project_completion_certificates')
                    .insert([payload])
                    .select('*, proyecto:proyectos(id, nombre_proyecto, clientes(nombre))')
                    .single();
            }

            if (result.error) throw result.error;

            const savedCert = result.data;
            
            if (isUpdate) {
                setCertificates(prev => prev.map(c => c.id === savedCert.id ? savedCert : c));
                toast({ title: 'Actualizado', description: 'Acta actualizada correctamente.' });
            } else {
                setCertificates(prev => [savedCert, ...prev]);
                toast({ title: 'Creado', description: 'Nueva acta creada correctamente.' });
            }
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving:', error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo guardar el acta.' });
        } finally {
            setIsSaving(false);
        }
    };

    // PDF Handlers
    const handlePreviewPdf = (cert) => {
        setSelectedCertForPdf(cert);
        setPreviewOpen(true);
    };

    const handleDownloadPdf = async () => {
        if (!selectedCertForPdf) return;
        setIsGeneratingPdf(true);
        const element = document.getElementById('certificate-template');
        const opt = {
            margin: [10, 10, 10, 10],
            filename: `Acta_Final_${selectedCertForPdf.expediente || 'SinExp'}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        try {
            await html2pdf().set(opt).from(element).save();
            toast({ title: "PDF Descargado", description: "El documento se ha generado correctamente." });
        } catch (error) {
            console.error("PDF Error:", error);
            toast({ variant: "destructive", title: "Error", description: "Error al generar PDF." });
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Render Logic
    if (!isAdminOrEncargado) {
        return (
            <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] p-8 text-center text-muted-foreground">
                <Ban className="w-16 h-16 mb-4 text-red-200" />
                <h2 className="text-xl font-bold text-foreground">Acceso Restringido</h2>
                <p>Solo administradores y encargados pueden gestionar actas de finalización.</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
            <Helmet>
                <title>Actas de Finalización | OrkaRefor</title>
            </Helmet>

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Actas de Finalización de Servicio</h1>
                    <p className="text-sm text-muted-foreground mt-1">Gestión y emisión de certificados oficiales de fin de obra.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={handleCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Acta
                    </Button>
                </div>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2 w-full md:w-96">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por expediente, proyecto u objeto..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Table */}
            <Card>
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                        Historial de Actas ({filteredCertificates.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Expediente</TableHead>
                                <TableHead>Proyecto</TableHead>
                                <TableHead className="hidden md:table-cell">Objeto</TableHead>
                                <TableHead className="hidden md:table-cell">Fecha Fin</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead className="text-right">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredCertificates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                                        No se encontraron actas.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredCertificates.map((cert) => (
                                    <TableRow key={cert.id}>
                                        <TableCell className="font-mono font-medium">
                                            {cert.expediente || '-'}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-medium truncate max-w-[200px]" title={cert.proyecto?.nombre_proyecto}>
                                                    {cert.proyecto?.nombre_proyecto || 'Sin Proyecto'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {cert.proyecto?.clientes?.nombre || 'Cliente Desconocido'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell truncate max-w-[200px]">
                                            {cert.objeto || '-'}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {cert.fecha_fin ? fmtMadrid(cert.fecha_fin, 'date') : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={cert.status === 'firmada' ? 'success' : 'secondary'} className="capitalize">
                                                {cert.status || 'Borrador'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" title="Vista Previa PDF" onClick={() => handlePreviewPdf(cert)}>
                                                    <FileText className="w-4 h-4 text-blue-600" />
                                                </Button>
                                                <Button size="icon" variant="ghost" title="Editar" onClick={() => handleEdit(cert)}>
                                                    <Pencil className="w-4 h-4 text-amber-600" />
                                                </Button>
                                                <Button size="icon" variant="ghost" title="Eliminar" onClick={() => handleDeleteClick(cert)}>
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{currentCert?.id ? 'Editar Acta' : 'Nueva Acta de Finalización'}</DialogTitle>
                        <DialogDescription>Rellena los datos para generar el certificado oficial.</DialogDescription>
                    </DialogHeader>
                    
                    {currentCert && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Proyecto *</Label>
                                    <Select 
                                        value={currentCert.project_id} 
                                        onValueChange={(val) => setCurrentCert({...currentCert, project_id: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Seleccionar Proyecto..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {projects.map(p => (
                                                <SelectItem key={p.id} value={p.id}>
                                                    {p.nombre_proyecto}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Expediente</Label>
                                    <Input 
                                        value={currentCert.expediente} 
                                        onChange={e => setCurrentCert({...currentCert, expediente: e.target.value})}
                                        placeholder="Ej: 2024/001"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Objeto del Contrato</Label>
                                <Textarea 
                                    value={currentCert.objeto} 
                                    onChange={e => setCurrentCert({...currentCert, objeto: e.target.value})}
                                    placeholder="Descripción breve de los trabajos..."
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Centro / Ubicación</Label>
                                    <Input 
                                        value={currentCert.centro} 
                                        onChange={e => setCurrentCert({...currentCert, centro: e.target.value})}
                                        placeholder="Nombre del centro o dirección"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Empresa Contratista</Label>
                                    <Input 
                                        value={currentCert.empresa_contratista} 
                                        onChange={e => setCurrentCert({...currentCert, empresa_contratista: e.target.value})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Fecha Inicio</Label>
                                    <Input 
                                        type="date"
                                        value={currentCert.fecha_inicio} 
                                        onChange={e => setCurrentCert({...currentCert, fecha_inicio: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Fecha Fin</Label>
                                    <Input 
                                        type="date"
                                        value={currentCert.fecha_fin} 
                                        onChange={e => setCurrentCert({...currentCert, fecha_fin: e.target.value})}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Periodo Garantía</Label>
                                    <Input 
                                        value={currentCert.periodo_garantia} 
                                        onChange={e => setCurrentCert({...currentCert, periodo_garantia: e.target.value})}
                                        placeholder="Ej: 1 año"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Responsable Técnico</Label>
                                    <Input 
                                        value={currentCert.responsable_tecnico} 
                                        onChange={e => setCurrentCert({...currentCert, responsable_tecnico: e.target.value})}
                                        placeholder="Nombre del técnico firmante"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Estado</Label>
                                    <Select 
                                        value={currentCert.status} 
                                        onValueChange={(val) => setCurrentCert({...currentCert, status: val})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="borrador">Borrador</SelectItem>
                                            <SelectItem value="pendiente_firma">Pendiente Firma</SelectItem>
                                            <SelectItem value="firmada">Firmada</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="bg-primary">
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Alert */}
            <Dialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>¿Estás seguro?</DialogTitle>
                        <DialogDescription>
                            Esta acción eliminará permanentemente el acta de finalización. No se puede deshacer.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteAlertOpen(false)}>Cancelar</Button>
                        <Button variant="destructive" onClick={handleConfirmDelete}>Eliminar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PDF Preview Dialog */}
            <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0">
                    <DialogHeader className="px-6 py-4 border-b shrink-0 bg-background z-10">
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5" /> Vista Previa del Certificado
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="flex-1 overflow-y-auto bg-gray-100 p-8 flex justify-center">
                        {/* THE CERTIFICATE TEMPLATE */}
                        <div 
                            id="certificate-template" 
                            className="bg-white shadow-xl p-[20mm] w-[210mm] min-h-[297mm] mx-auto text-black relative box-border"
                            style={{ fontFamily: 'Times New Roman, serif' }}
                        >
                            {selectedCertForPdf && (
                                <div className="flex flex-col h-full justify-between">
                                    {/* Top Section */}
                                    <div>
                                        <div className="text-center mb-12">
                                            <h1 className="text-2xl font-bold uppercase mb-2 border-b-2 border-black inline-block pb-1">Acta de Finalización de Servicio</h1>
                                            <p className="text-sm mt-4 font-bold">EXPEDIENTE: {selectedCertForPdf.expediente || '________'}</p>
                                        </div>

                                        <div className="space-y-6 text-justify leading-relaxed text-base">
                                            <p>
                                                En <strong>Madrid</strong>, a <strong>{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric'})}</strong>.
                                            </p>

                                            <div className="space-y-2">
                                                <p><span className="font-bold inline-block w-48">OBRA/PROYECTO:</span> {selectedCertForPdf.proyecto?.nombre_proyecto}</p>
                                                <p><span className="font-bold inline-block w-48">CENTRO:</span> {selectedCertForPdf.centro || '___________________'}</p>
                                                <p><span className="font-bold inline-block w-48">OBJETO:</span> {selectedCertForPdf.objeto || '___________________'}</p>
                                                <p><span className="font-bold inline-block w-48">EMPRESA CONTRATISTA:</span> {selectedCertForPdf.empresa_contratista}</p>
                                            </div>

                                            <p className="mt-8">
                                                Reunidos en el lugar de la prestación del servicio, el Responsable Técnico de la empresa contratista y el representante del Cliente, proceden a la formalización de la presente <strong>ACTA DE FINALIZACIÓN</strong>.
                                            </p>

                                            <p>
                                                Se hace constar que los trabajos contratados, con fecha de inicio <strong>{selectedCertForPdf.fecha_inicio ? new Date(selectedCertForPdf.fecha_inicio).toLocaleDateString() : '___/___/___'}</strong>, 
                                                han sido completados en su totalidad con fecha <strong>{selectedCertForPdf.fecha_fin ? new Date(selectedCertForPdf.fecha_fin).toLocaleDateString() : '___/___/___'}</strong>, 
                                                cumpliendo con las especificaciones técnicas y condiciones estipuladas.
                                            </p>

                                            <p>
                                                El periodo de garantía de los trabajos realizados será de <strong>{selectedCertForPdf.periodo_garantia}</strong> a partir de la fecha de firma del presente acta.
                                            </p>

                                            <p>
                                                Y para que conste a los efectos oportunos, se firma la presente acta por duplicado ejemplar.
                                            </p>
                                        </div>
                                    </div>

                                    {/* Signatures Section */}
                                    <div className="grid grid-cols-2 gap-16 mt-20 mb-10">
                                        <div className="text-center">
                                            <p className="font-bold text-sm mb-16 border-t pt-4 border-black w-3/4 mx-auto">POR LA EMPRESA CONTRATISTA</p>
                                            <p className="text-sm">{selectedCertForPdf.responsable_tecnico || 'Fdo: Responsable Técnico'}</p>
                                            {selectedCertForPdf.firma_tecnico_url && (
                                                <div className="mt-[-4rem] mb-2 opacity-80">
                                                    {/* Signature image placeholder if available */}
                                                    <span className="text-xs text-gray-400">[Firma Digital]</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <p className="font-bold text-sm mb-16 border-t pt-4 border-black w-3/4 mx-auto">CONFORMIDAD DEL CLIENTE</p>
                                            <p className="text-sm">Fdo: _______________________</p>
                                        </div>
                                    </div>
                                    
                                    <div className="text-center text-xs text-gray-400 mt-auto pt-8 border-t">
                                        Documento generado automáticamente por sistema ERP de Orkaled Instalaciones.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="px-6 py-4 border-t bg-background shrink-0 gap-2">
                        <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cerrar</Button>
                        <Button onClick={handleDownloadPdf} disabled={isGeneratingPdf} className="bg-blue-600 hover:bg-blue-700 text-white">
                            {isGeneratingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Download className="w-4 h-4 mr-2" />}
                            Descargar PDF
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ActaFinalizacion;