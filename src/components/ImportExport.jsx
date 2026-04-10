import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, Upload, FileText, FileUp, Database, ArrowRight, UserPlus, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Label } from '@/components/ui/label'; // Importación añadida
import { Input } from '@/components/ui/input'; // Importación añadida


const N8NIntegrationCard = () => {
    const n8nWebhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-lead-from-n8n`;
    const n8nApiKey = "n8n-orkarefor-secret-key-live-Jd8fS9hV3kL6gN2p";

    const copyToClipboard = (text, label) => {
        navigator.clipboard.writeText(text);
        toast({ title: `${label} copiado`, description: 'El valor se ha copiado al portapapeles.' });
    };

    return (
        <Card className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-700">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <img className="w-6 h-6" alt="Logo de N8N" src="https://images.unsplash.com/photo-1663813116840-cef0040331fe" />
                    Integración con N8N
                </CardTitle>
                <CardDescription className="text-indigo-200">
                    Conecta N8N para crear leads automáticamente en tu ERP.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-white">
                <p className="text-sm">
                    Usa los siguientes datos para configurar un nodo <code className="bg-black/30 text-yellow-300 px-1.5 py-0.5 rounded">HTTP Request</code> en tu workflow de N8N.
                </p>

                <div className="space-y-2">
                    <Label className="text-indigo-200 font-semibold">URL del Webhook (POST)</Label>
                    <div className="flex items-center gap-2">
                        <Input type="text" readOnly value={n8nWebhookUrl} className="bg-black/30 border-indigo-700 text-white truncate"/>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(n8nWebhookUrl, 'URL')}>Copiar</Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-indigo-200 font-semibold">API Key (Authorization Header)</Label>
                    <p className="text-xs text-indigo-300">
                        En N8N, añade una cabecera <code className="bg-black/30 text-yellow-300 p-1 rounded">Authorization</code> con el valor <code className="bg-black/30 text-yellow-300 p-1 rounded">Bearer TU_API_KEY</code>.
                    </p>
                    <div className="flex items-center gap-2">
                        <Input type="password" readOnly value={n8nApiKey} className="bg-black/30 border-indigo-700 text-white"/>
                        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(n8nApiKey, 'API Key')}>Copiar</Button>
                    </div>
                </div>

                 <div className="space-y-2 pt-2">
                    <Label className="text-indigo-200 font-semibold">Ejemplo de cuerpo JSON (Body)</Label>
                     <pre className="bg-black/50 p-3 rounded-md text-xs overflow-x-auto text-green-300 border border-indigo-800">
{`{
  "nombre_contacto": "Lead desde N8N",
  "telefono": "600112233",
  "email": "lead.n8n@ejemplo.com",
  "nombre_empresa": "Empresa Automática",
  "comentario": "Este lead fue creado por un workflow de N8N.",
  "partida": "reforma",
  "owner_email": "admin@orkarefor.com" 
}`}
                    </pre>
                     <p className="text-xs text-indigo-300">
                        <span className="font-bold">Importante:</span> <code className="bg-black/30 text-yellow-300 p-1 rounded">nombre_contacto</code> es obligatorio. Debes incluir al menos <code className="bg-black/30 text-yellow-300 p-1 rounded">telefono</code> o <code className="bg-black/30 text-yellow-300 p-1 rounded">email</code>. El campo <code className="bg-black/30 text-yellow-300 p-1 rounded">owner_email</code> asignará el lead a un usuario existente; si no se encuentra, se asignará a un admin.
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};


const CSVUploader = ({ rpcName, template, onResults }) => {
    const fileInputRef = useRef(null);
    const [fileName, setFileName] = useState('');
    const [loading, setLoading] = useState(false);
    const [validation, setValidation] = useState(null);

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setFileName(file.name);
        setLoading(true);
        setValidation(null);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const { data: validationResult, error: validationError } = await supabase.rpc(
                    `validate_${rpcName}`, { rows: results.data }
                );

                if (validationError) {
                    toast({ variant: 'destructive', title: `Error de validación RPC: ${validationError.message}` });
                    setValidation({ errors: [{id:0, error:'RPC Error'}], total: results.data.length });
                } else {
                    setValidation({
                        errors: validationResult.filter(r => !r.ok),
                        total: validationResult.length
                    });
                }
                setLoading(false);
            }
        });
    };

    const handleImport = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc(`import_stage_${rpcName}`);
        if(error) {
            toast({ variant: 'destructive', title: 'Error en la importación', description: error.message });
        } else {
            toast({ title: 'Importación completada', description: `${data.inserted} filas nuevas, ${data.updated} actualizadas.` });
            onResults(data);
        }
        setFileName('');
        setValidation(null);
        setLoading(false);
    };

    const canImport = validation && validation.errors.length === 0 && validation.total > 0;

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Button onClick={() => fileInputRef.current.click()} disabled={loading}>
                    <FileUp className="mr-2 h-4 w-4" /> Subir CSV
                </Button>
                <a href={template} download={`plantilla_${rpcName}.csv`}>
                    <Button variant="outline"><Download className="mr-2 h-4 w-4" /> Plantilla</Button>
                </a>
            </div>

            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".csv"
                onChange={handleFileChange}
            />

            {fileName && (
                <div className="bg-muted p-3 rounded-md">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{fileName}</p>
                        {loading && <Loader2 className="animate-spin h-5 w-5" />}
                    </div>

                    {validation && (
                        <div className="mt-2 text-sm">
                            {validation.errors.length === 0 ? (
                                <p className="text-green-600 flex items-center gap-2"><CheckCircle /> {validation.total} filas validadas y listas para importar.</p>
                            ) : (
                                <p className="text-destructive flex items-center gap-2"><AlertCircle /> {validation.errors.length} de {validation.total} filas tienen errores.</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {canImport && (
                 <Button onClick={handleImport} disabled={loading} className="w-full">
                    <Database className="mr-2 h-4 w-4" /> Importar {validation.total} filas
                </Button>
            )}
        </div>
    );
};


const ImportExport = () => {
    return (
        <div className="p-4 md:p-8">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">Importar, Exportar y Conectar</h1>
                <p className="text-muted-foreground mt-2">Gestiona tus datos y conecta servicios externos.</p>
            </motion.div>
            
            <Tabs defaultValue="n8n" className="mt-6">
                <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                    <TabsTrigger value="n8n">N8N</TabsTrigger>
                    <TabsTrigger value="leads">Leads</TabsTrigger>
                    <TabsTrigger value="clientes">Clientes</TabsTrigger>
                    <TabsTrigger value="proveedores">Proveedores</TabsTrigger>
                </TabsList>
                <TabsContent value="n8n" className="mt-4">
                    <N8NIntegrationCard />
                </TabsContent>
                <TabsContent value="leads" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Leads</CardTitle>
                            <CardDescription>Importa nuevos leads desde un archivo CSV.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <CSVUploader rpcName="leads" template="/plantillas/plantilla_leads.csv" onResults={() => {}}/>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="clientes" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Clientes</CardTitle>
                             <CardDescription>Importa nuevos clientes desde un archivo CSV.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <CSVUploader rpcName="clientes" template="/plantillas/plantilla_clientes.csv" onResults={() => {}}/>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="proveedores" className="mt-4">
                     <Card>
                        <CardHeader>
                            <CardTitle>Proveedores</CardTitle>
                             <CardDescription>Importa nuevos proveedores desde un archivo CSV.</CardDescription>
                        </CardHeader>
                        <CardContent>
                           <CSVUploader rpcName="proveedores" template="/plantillas/plantilla_proveedores.csv" onResults={() => {}}/>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default ImportExport;