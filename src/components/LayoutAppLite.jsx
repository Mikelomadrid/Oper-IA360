import React from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { LogOut, LayoutDashboard, HardHat, Users, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { supabase } from '@/lib/customSupabaseClient';

const Sidebar = ({ navigate }) => {
    const { sessionRole } = useAuth();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/LoginSafe');
    };

    const allNavItems = [
      { path: '/DashboardSafe', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'encargado', 'tecnico', 'colaborador'] },
      { path: '/proyectos', label: 'Obras', icon: HardHat, roles: ['admin', 'encargado', 'tecnico'] },
      { path: '/personal', label: 'Personal', icon: Users, roles: ['admin', 'encargado'] },
      { path: '/sistema/configuracion', label: 'Config', icon: Settings, roles: ['admin'] },
    ];
    
    const userRole = sessionRole?.rol || 'colaborador';
    const navItems = allNavItems.filter(item => item.roles.includes(userRole));

    return (
        <aside className="w-64 bg-card h-screen flex flex-col border-r fixed top-0 left-0 z-50">
            <div className="p-4 border-b h-[65px] flex items-center">
                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/DashboardSafe'); }} className="text-2xl font-bold text-foreground">
                    Horizons ERP
                </a>
            </div>
            <nav className="flex-1 p-2 space-y-2">
                {navItems.map(item => (
                  <Button key={item.path} variant="ghost" className="w-full justify-start" onClick={() => navigate(item.path)}>
                      <item.icon className="mr-2 h-4 w-4" /> {item.label}
                  </Button>
                ))}
            </nav>
            <div className="p-2 border-t">
                <Button variant="ghost" className="w-full justify-start" onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" /> Cerrar sesión
                </Button>
            </div>
        </aside>
    );
};

const Topbar = () => {
    const { session } = useAuth();
    const userEmail = session?.user?.email || 'anon';
    return (
        <header className="fixed top-0 left-64 right-0 h-[65px] bg-card/80 backdrop-blur-sm border-b flex items-center px-6 z-40">
            <div className="text-sm text-muted-foreground ml-auto">
                Usuario: <span className="font-mono">{userEmail}</span>
            </div>
        </header>
    );
};

const LayoutAppLite = ({ children, navigate }) => {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <Sidebar navigate={navigate} />
            <div className="pl-64">
                <Topbar />
                <main className="pt-[65px]">
                    <motion.div
                        key={window.location.pathname}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                        className="p-8"
                    >
                        {children}
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default LayoutAppLite;