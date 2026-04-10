import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { Mail, Send } from 'lucide-react';

const InviteCollaborator = () => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'Por favor, introduce una dirección de email.',
            });
            return;
        }
        setIsSubmitting(true);

        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (error) {
            toast({
                variant: 'destructive',
                title: 'Error al enviar la invitación',
                description: error.message,
            });
        } else {
            toast({
                title: '¡Invitación enviada!',
                description: `Se ha enviado un enlace de acceso a ${email}.`,
            });
            setEmail('');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="p-4 md:p-8 flex items-center justify-center min-h-full bg-background">
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md"
            >
                <Card className="shadow-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">Invitar Colaborador</CardTitle>
                        <CardDescription>
                            Envía un enlace mágico para que un nuevo colaborador se una a la plataforma.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="flex items-center">
                                    <Mail className="mr-2 h-4 w-4" />
                                    Email del Colaborador
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="ejemplo@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                            <Button type="submit" className="w-full" disabled={isSubmitting}>
                                <Send className="mr-2 h-4 w-4" />
                                {isSubmitting ? 'Enviando...' : 'Enviar Invitación'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
};

export default InviteCollaborator;