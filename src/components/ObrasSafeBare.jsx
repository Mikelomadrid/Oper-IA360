import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/customSupabaseClient';
import LayoutSafeEmpty from '@/components/LayoutSafeEmpty';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, RefreshCw, ArrowLeft } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Helmet } from 'react-helmet';

const ObrasSafeBare = ({ navigate }) => {
  const { toast } = useToast();

  const fetchObras = async () => {
    const { data, error } = await supabase
      .from('v_obras_list_v1')
      .select('id,nombre,direccion,estado')
      .order('created_at', { ascending: false, nulls: 'last' });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error al cargar obras',
        description: error.message,
      });
      throw error;
    }
    return data;
  };

  const { data, isFetching, refetch } = useQuery({
    queryKey: ['ds_obras_bare'],
    queryFn: fetchObras,
    enabled: false,
  });
  
  const obras = Array.isArray(data) ? data : [];

  return (
    <>
      <Helmet>
        <title>Obras (Bare)</title>
      </Helmet>
      <LayoutSafeEmpty>
        <div className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Obras (bare)</h1>
            <div className='flex gap-2'>
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refrescar
              </Button>
              <Button variant="outline" onClick={() => navigate('/RecoverySafe')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Volver
              </Button>
            </div>
          </div>
          
          <div className="bg-card p-4 rounded-lg shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isFetching ? (
                  <TableRow><TableCell colSpan={3} className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" /></TableCell></TableRow>
                ) : obras.length > 0 ? (
                  obras.map((obra) => (
                    <TableRow key={obra.id}>
                      <TableCell className="font-medium">{obra.nombre}</TableCell>
                      <TableCell>{obra.direccion || 'N/A'}</TableCell>
                      <TableCell>{obra.estado}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={3} className="text-center p-8 text-muted-foreground">No hay obras o no se han cargado datos.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </LayoutSafeEmpty>
    </>
  );
};

export default ObrasSafeBare;