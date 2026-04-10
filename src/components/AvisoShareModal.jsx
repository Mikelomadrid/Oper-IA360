import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, Mail, MessageCircle, Share2, FileText, MapPin, User, Calendar, CheckCircle2 } from "lucide-react";
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { fmtMadrid } from '@/lib/utils';

const AvisoShareModal = ({ isOpen, onClose, aviso, files = [], comments = [] }) => {
  const [email, setEmail] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setPublicUrl] = useState(null);
  const printRef = useRef(null);

  const generatePDF = async (upload = false) => {
    if (!printRef.current) return null;
    setIsGenerating(true);

    try {
      // 1. Capture DOM
      const canvas = await html2canvas(printRef.current, {
        scale: 2, // Higher resolution
        useCORS: true, // Allow loading external images (Supabase)
        logging: false,
        backgroundColor: '#ffffff'
      });

      // 2. Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      // Calculate scaling to fit width nicely with margins if needed, or just simple fit
      const imgX = 0;
      const imgY = 0;
      const finalWidth = pdfWidth; 
      const finalHeight = (imgHeight * pdfWidth) / imgWidth;

      // If content is very long, we might need multi-page logic, but for now single page scaled or simple separate pages
      // Simple approach: Add image. If it's too long, jsPDF cuts it off. 
      // Robust approach: Split into pages.
      
      let heightLeft = finalHeight;
      let position = 0;
      let pageHeight = pdfHeight;

      pdf.addImage(imgData, 'PNG', 0, position, finalWidth, finalHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - finalHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, finalWidth, finalHeight);
        heightLeft -= pageHeight;
      }

      if (!upload) {
        // Download directly
        pdf.save(`Aviso_${aviso.id.substring(0,8)}.pdf`);
        toast({ title: "PDF Descargado", description: "El reporte se ha guardado en tu dispositivo." });
        setIsGenerating(false);
        return null;
      } else {
        // Return Blob for upload
        return pdf.output('blob');
      }

    } catch (err) {
      console.error("Error generating PDF:", err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo generar el PDF." });
      setIsGenerating(false);
      return null;
    }
  };

  const handleUploadAndShare = async (platform) => {
    if (platform === 'email' && !email) {
      toast({ variant: "destructive", title: "Falta email", description: "Por favor ingresa un correo electrónico." });
      return;
    }

    setIsGenerating(true);
    try {
      // Check if we already uploaded this specific version? No, regenerate to be safe/fresh.
      const pdfBlob = await generatePDF(true);
      if (!pdfBlob) return;

      const fileName = `reports/aviso_${aviso.id}_${Date.now()}.pdf`;
      
      // Upload
      const { error: uploadError } = await supabase.storage
        .from('avisos-files') // Using existing bucket
        .upload(fileName, pdfBlob, { contentType: 'application/pdf', upsert: true });

      if (uploadError) throw uploadError;

      // Get URL
      const { data: urlData } = supabase.storage.from('avisos-files').getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;
      setPublicUrl(publicUrl);

      // Open Share Link
      if (platform === 'email') {
        const subject = encodeURIComponent(`Reporte de Aviso: ${aviso.proyecto?.nombre_proyecto || 'Orden de Servicio'}`);
        const body = encodeURIComponent(`Hola,\n\nAdjunto encontrarás el reporte detallado del aviso de servicio.\n\nPuedes verlo y descargarlo aquí:\n${publicUrl}\n\nUn saludo,\nEl equipo.`);
        window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
      } else if (platform === 'whatsapp') {
        const text = encodeURIComponent(`Hola, aquí tienes el reporte del aviso finalizado: ${publicUrl}`);
        window.open(`https://wa.me/?text=${text}`, '_blank');
      }

      toast({ title: "Enlace Generado", description: "El reporte está listo para compartir." });

    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Error", description: "No se pudo compartir el reporte." });
    } finally {
      setIsGenerating(false);
    }
  };

  // Filter images for the report
  const images = files.filter(f => f.tipo_archivo?.includes('image'));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir Reporte de Aviso</DialogTitle>
          <DialogDescription>Genera un PDF con todos los detalles, fotos y firma.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Enviar por Email</Label>
            <div className="flex gap-2">
              <Input 
                placeholder="cliente@ejemplo.com" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
              />
              <Button onClick={() => handleUploadAndShare('email')} disabled={isGenerating} variant="secondary">
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white" onClick={() => handleUploadAndShare('whatsapp')} disabled={isGenerating}>
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4 mr-2" />}
              WhatsApp
            </Button>
            <Button className="w-full" onClick={() => generatePDF(false)} disabled={isGenerating} variant="outline">
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Descargar PDF
            </Button>
          </div>
        </div>

        {/* HIDDEN PRINT TEMPLATE */}
        <div className="fixed left-[-9999px] top-[-9999px]">
          <div ref={printRef} className="w-[794px] min-h-[1123px] bg-white p-12 text-black font-sans relative" style={{ margin: '0 auto' }}>
            
            {/* Header */}
            <div className="flex justify-between items-end border-b-2 border-gray-200 pb-4 mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Reporte de Servicio</h1>
                <p className="text-gray-500 text-sm mt-1">Ref: {aviso?.id?.split('-')[0].toUpperCase()}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-gray-800">OrkaRefor</div>
                <div className="text-sm text-gray-500">{fmtMadrid(new Date(), 'date')}</div>
              </div>
            </div>

            {/* Status & Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div className="space-y-3">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">Información del Cliente</h3>
                <div className="text-sm">
                  <div className="font-semibold text-gray-900 text-lg">{aviso?.cliente_nombre || 'Cliente General'}</div>
                  <div className="text-gray-600 flex items-start gap-2 mt-1">
                    <MapPin className="w-4 h-4 mt-0.5 text-gray-400" />
                    {aviso?.direccion_servicio}
                  </div>
                  {aviso?.proyecto && (
                    <div className="mt-2 inline-block bg-gray-100 px-2 py-1 rounded text-xs font-medium">
                      Proyecto: {aviso.proyecto.nombre_proyecto}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-3 text-right">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider">Estado del Servicio</h3>
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
                    {aviso?.estado?.toUpperCase().replace('_', ' ')}
                  </span>
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  <div className="font-medium">Técnico Asignado:</div>
                  <div>{aviso?.tecnico?.nombre || aviso?.tecnico_asignado_id} {aviso?.tecnico?.apellidos}</div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <h3 className="text-sm font-bold uppercase text-gray-500 tracking-wider mb-2">Solicitud Original</h3>
              <p className="text-gray-800 text-sm leading-relaxed">{aviso?.descripcion_solicitud}</p>
            </div>

            {/* Resolution */}
            {aviso?.estado === 'cerrado' && (
              <div className="mb-8">
                <h3 className="text-sm font-bold uppercase text-green-600 tracking-wider mb-3 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Resolución del Técnico
                </h3>
                <div className="border-l-4 border-green-500 pl-4 py-1">
                  <p className="text-gray-800 text-sm italic">"{aviso?.descripcion_tecnico}"</p>
                  <div className="text-xs text-gray-500 mt-2">Completado el: {fmtMadrid(aviso?.fecha_cierre)}</div>
                </div>
              </div>
            )}

            {/* Photos */}
            {images.length > 0 && (
              <div className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 border-b pb-2">Evidencias Fotográficas</h3>
                <div className="grid grid-cols-3 gap-4">
                  {images.map((file, i) => (
                    <div key={i} className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative">
                      <img 
                        src={file.archivo_url} 
                        className="w-full h-full object-cover" 
                        alt="Evidencia"
                        crossOrigin="anonymous" // Crucial for html2canvas
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments */}
            {comments.length > 0 && (
              <div className="mb-8 break-inside-avoid">
                <h3 className="text-sm font-bold uppercase text-gray-400 tracking-wider mb-4 border-b pb-2">Historial de Comentarios</h3>
                <div className="space-y-3">
                  {comments.map((c, i) => (
                    <div key={i} className="text-xs">
                      <div className="flex justify-between text-gray-500 mb-0.5">
                        <span className="font-semibold">{c.empleado?.nombre || 'Usuario'}</span>
                        <span>{fmtMadrid(c.fecha_creacion)}</span>
                      </div>
                      <div className="bg-gray-50 p-2 rounded text-gray-700">{c.contenido}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signature */}
            {aviso?.firma_url && (
              <div className="mt-12 break-inside-avoid border-t-2 border-dashed border-gray-200 pt-8">
                <div className="w-64">
                  <img src={aviso.firma_url} className="w-full h-32 object-contain mb-2 border bg-white" alt="Firma" crossOrigin="anonymous" />
                  <div className="border-t border-gray-400 pt-1 text-center">
                    <p className="font-bold text-sm text-gray-900">{aviso.cliente_acepta_nombre}</p>
                    <p className="text-xs text-gray-500">Firma de Conformidad</p>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="absolute bottom-12 left-12 right-12 text-center text-xs text-gray-400 border-t pt-4">
              Reporte generado automáticamente por OrkaRefor ERP el {new Date().toLocaleString()}
            </div>

          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvisoShareModal;