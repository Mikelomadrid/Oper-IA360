import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, UserPlus, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ClientForm } from '@/components/Clients';

const LeadConversionDetail = ({ lead, onBack, onConversionSuccess }) => {
  const { sessionRole } = useAuth();
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);

  const canManage = useMemo(() => {
    const role = sessionRole.rol;
    return role === 'admin' || role === 'encargado';
  }, [sessionRole.rol]);

  useEffect(() => {
    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('id, nombre, cif')
        .order('nombre', { ascending: true });
      if (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'No se pudieron cargar los clientes.' });
      } else {
        setClients(data);
      }
    };
    fetchClients();
  }, []);

  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    return clients.filter(client =>
      client.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.cif && client.cif.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [clients, searchTerm]);

  const handleConvert = async () => {
    setLoading(true);
    try {
      // Use the new v2 RPC for robust conversion
      const { data, error } = await supabase.rpc('approve_lead_to_proyecto_v2', {
        p_lead_id: lead.id,
        p_proyecto_descripcion: projectDescription || `Proyecto generado desde lead: ${lead.nombre_contacto}`,
        p_cliente_id: selectedClient === 'none' ? null : selectedClient
      });

      if (error) throw error;

      const proyectoId = data?.proyecto_id;

      toast({
        title: '¡Lead convertido!',
        description: `El lead se ha convertido en el proyecto ID: ${proyectoId}`,
      });

      if (proyectoId) {
        onConversionSuccess(proyectoId);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      toast({
        variant: 'destructive',
        title: 'Error en la conversión',
        description: error.message || 'No se pudo convertir el lead.',
      });
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const handleSaveNewClient = async (formData) => {
    const { data, error } = await supabase
      .from('clientes')
      .insert(formData)
      .select()
      .single();

    if (error) {
      let description = error.message;
      if (error.code === '23505') {
        description = 'El CIF/NIF ya existe para otro cliente.';
      }
      toast({
        title: 'Error al crear cliente',
        description,
        variant: 'destructive'
      });
      return; // No cerrar modal si hay error
    }

    // Éxito
    toast({
      title: 'Cliente creado y seleccionado',
      description: `${data.nombre} ha sido guardado y seleccionado.`,
    });

    // Actualizar lista de clientes y seleccionar el nuevo
    const newClient = { id: data.id, nombre: data.nombre, cif: data.cif };
    setClients(prev => [...prev, newClient].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    setSelectedClient(data.id);
    setIsClientModalOpen(false);
  };

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4 text-muted-foreground">Cargando datos del lead...</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      className="p-4 md:p-8"
    >
      <Button variant="ghost" onClick={onBack} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver al Lead
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>Convertir Lead a Proyecto</CardTitle>
          <CardDescription>
            Asocia este lead a un cliente existente o crea uno nuevo para generar un proyecto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold">{lead.nombre_contacto}</h3>
            <p className="text-sm text-muted-foreground">{lead.nombre_empresa}</p>
            <p className="text-sm text-muted-foreground">{lead.email} - {lead.telefono}</p>
          </div>

          <div>
            <Label htmlFor="client-select">Cliente</Label>
            <div className="flex items-center gap-2">
              <Select onValueChange={setSelectedClient} value={selectedClient || 'none'}> {/* Default to 'none' */}
                <SelectTrigger id="client-select" className="flex-1">
                  <SelectValue placeholder="Selecciona un cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Buscar cliente..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                  </div>
                  <SelectItem value="none">Crear nuevo cliente</SelectItem> {/* Option to create new, value 'none' */}
                  {filteredClients.map(client => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.nombre} {client.cif && `(${client.cif})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {canManage && (
                <Button size="icon" variant="outline" onClick={() => setIsClientModalOpen(true)}>
                  <UserPlus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Si el cliente no existe, puedes crearlo. Si no seleccionas ninguno, se creará uno automáticamente.
            </p>
          </div>

          <div>
            <Label htmlFor="project-description">Descripción del Proyecto</Label>
            <Input
              id="project-description"
              placeholder="Descripción inicial del proyecto (opcional)"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
          </div>

          <Button onClick={handleConvert} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {loading ? 'Convirtiendo...' : 'Convertir a Proyecto'}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isClientModalOpen} onOpenChange={setIsClientModalOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Introduce los datos del nuevo cliente. Al guardar, se seleccionará automáticamente.
            </DialogDescription>
          </DialogHeader>
          <ClientForm
            onSave={handleSaveNewClient}
            onCancel={() => setIsClientModalOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </motion.div>
  );
};

export default LeadConversionDetail;