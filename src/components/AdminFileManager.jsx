import React, { useState, useEffect } from 'react';
    import { motion } from 'framer-motion';
    import { supabase } from '@/lib/customSupabaseClient';
    import { toast } from '@/components/ui/use-toast';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
    import { Label } from '@/components/ui/label';
    import FileManager from '@/components/FileManager';
    import { HardDrive } from 'lucide-react';
    import { useAuth } from '@/contexts/SupabaseAuthContext';

    const AdminFileManager = () => {
        const { sessionRole } = useAuth();
        const [buckets, setBuckets] = useState([]);
        const [selectedBucket, setSelectedBucket] = useState('');
        const [prefix, setPrefix] = useState('');
        const [activePrefix, setActivePrefix] = useState('');

        useEffect(() => {
            const fetchBuckets = async () => {
                const { data, error } = await supabase.storage.listBuckets();
                if (error) {
                    toast({ variant: 'destructive', title: 'Error al cargar buckets', description: error.message });
                } else {
                    const filteredBuckets = data.filter(b => b.name !== 'migrations'); // Exclude internal buckets
                    setBuckets(filteredBuckets);
                    if (filteredBuckets.length > 0) {
                        setSelectedBucket(filteredBuckets[0].name);
                    }
                }
            };
            fetchBuckets();
        }, []);
        
        const handleSearch = () => {
            setActivePrefix(prefix);
        };

        if (sessionRole.rol !== 'admin') {
            return (
                <div className="p-8 text-center text-destructive">
                    <h1 className="text-2xl font-bold">Acceso Denegado</h1>
                    <p>Esta sección es solo para administradores.</p>
                </div>
            );
        }

        return (
            <div className="p-4 md:p-8">
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                    <div className="flex items-center gap-3 mb-6">
                        <HardDrive className="w-8 h-8 text-primary" />
                        <div>
                            <h1 className="text-3xl font-bold text-foreground">Gestor de Archivos (Admin)</h1>
                            <p className="text-muted-foreground">Explora y gestiona todos los archivos de la aplicación.</p>
                        </div>
                    </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card p-5 rounded-xl border shadow-sm mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div>
                            <Label htmlFor="bucket-select">Bucket</Label>
                            <Select value={selectedBucket} onValueChange={setSelectedBucket}>
                                <SelectTrigger id="bucket-select">
                                    <SelectValue placeholder="Selecciona un bucket..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {buckets.map(b => (
                                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="prefix-input">Carpeta / Prefijo (Opcional)</Label>
                            <Input id="prefix-input" placeholder="Ej: ID de lead o proyecto" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
                        </div>
                        <Button onClick={handleSearch} className="w-full md:w-auto">Buscar</Button>
                    </div>
                </motion.div>
                
                {selectedBucket && (
                    <FileManager
                        bucketName={selectedBucket}
                        prefix={activePrefix}
                        canEdit={true}
                    />
                )}
            </div>
        );
    };

    export default AdminFileManager;