import { supabase } from '@/lib/customSupabaseClient';
import ClaudeScanner from './ClaudeScanner';

const PresupuestoScanner = ({ proyectoId, onClose, onSaved }) => {
  const handleGuardar = async (resultado) => {
    if (!resultado?.partidas?.length) {
      throw new Error('No se encontraron partidas en el presupuesto');
    }

    // Insertar cada partida en obras_partidas
    const partidas = resultado.partidas.map((p, idx) => ({
      obra_id: proyectoId,
      codigo: p.codigo || null,
      descripcion: p.descripcion || p.capitulo || 'Sin descripción',
      unidad: p.unidad || 'ud',
      cantidad_total: parseFloat(p.cantidad) || 0,
      precio_unitario: parseFloat(p.precio_unitario) || 0,
      orden: idx,
      activa: true,
    }));

    const { error } = await supabase
      .from('obras_partidas')
      .insert(partidas);

    if (error) throw new Error('Error guardando partidas: ' + error.message);

    onSaved?.();
    onClose?.();
  };

  return (
    <ClaudeScanner
      modo="presupuesto"
      onGuardar={handleGuardar}
    />
  );
};

export default PresupuestoScanner;
