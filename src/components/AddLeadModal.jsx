import React, { useState, useEffect } from 'react';
    import { motion, AnimatePresence } from 'framer-motion';
    import { X, User, Building, Phone, Mail, MapPin, Hash, Briefcase } from 'lucide-react';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Label } from '@/components/ui/label';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { supabase } from '@/lib/customSupabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const AddLeadModal = ({ isOpen, onClose, onAdd }) => {
      const { user } = useAuth();
      const [formData, setFormData] = useState({
        p_nombre_contacto: '',
        p_email: '',
        p_telefono: '',
        p_nombre_empresa: '',
        p_direccion: '',
        p_cif: '',
        p_estado: 'nuevo',
        p_empleado_asignado: null,
      });
      const [employees, setEmployees] = useState([]);
      const [isSubmitting, setIsSubmitting] = useState(false);

      useEffect(() => {
        if (isOpen) {
          const fetchEmployees = async () => {
            const { data, error } = await supabase
              .from('empleados')
              .select('id, nombre, apellidos')
              .eq('activo', true);

            if (error) {
              toast({ variant: 'destructive', title: 'Error al cargar empleados' });
            } else {
              setEmployees(data);
            }
          };
          fetchEmployees();
        }
      }, [isOpen]);

      const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.p_nombre_contacto || (!formData.p_email && !formData.p_telefono)) {
          toast({
            variant: 'destructive',
            title: 'Campos requeridos incompletos',
            description: 'Debes proporcionar el nombre de contacto y al menos un email o teléfono.',
          });
          return;
        }

        setIsSubmitting(true);

        const rpcParams = {
            ...formData,
            p_colaborador_id: user?.id,
            p_empleado_asignado: formData.p_empleado_asignado === 'null' ? null : formData.p_empleado_asignado,
        };
        
        const { data, error } = await supabase.rpc('create_lead', rpcParams);

        if (error) {
          toast({
            variant: 'destructive',
            title: 'Error al crear el lead',
            description: error.message,
          });
        } else {
          toast({
            title: '¡Lead creado con éxito!',
            description: 'El nuevo prospecto ha sido añadido a la lista.',
          });
          onAdd(data[0]);
          handleClose();
        }
        setIsSubmitting(false);
      };

      const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
      };

      const handleSelectChange = (name, value) => {
        setFormData({ ...formData, [name]: value });
      };

      const handleClose = () => {
        setFormData({
            p_nombre_contacto: '',
            p_email: '',
            p_telefono: '',
            p_nombre_empresa: '',
            p_direccion: '',
            p_cif: '',
            p_estado: 'nuevo',
            p_empleado_asignado: null,
        });
        onClose();
      }

      return (
        <AnimatePresence>
          {isOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleClose}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
              >
                <div className="glass-effect rounded-2xl p-6 border border-white/20">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold gradient-text">Antiguo Modal de Lead</h2>
                    <button
                      onClick={handleClose}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                   <p className="text-center text-yellow-400">Este componente ya no se usa. Será eliminado.</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      );
    };

    export default AddLeadModal;