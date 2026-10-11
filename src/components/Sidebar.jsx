import React, { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from '@/lib/customSupabaseClient';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { useAppShell } from "@/contexts/AppShellContext";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationBadge } from "@/components/ui/NotificationBadge";
import {
    LayoutDashboard, Briefcase, HardHat, Award, ClipboardList, ShoppingCart,
    ClipboardCheck, Image, Package, Grid, Layers, PackageOpen,
    CircleDotDashed as Tool, ArrowLeftRight, Wrench, HeartHandshake as Handshake,
    Users, WalletCards as IdCard, Megaphone, UserPlus, Clock, FileText,
    AlertCircle, Settings, HardDrive, Bug, Home, Inbox, Calendar,
    ChevronDown, Building, Truck, Banknote, Receipt, Table2, Ruler, UserX,
    Target, Folder, Loader2, BadgeCheck, BrainCircuit
} from 'lucide-react';

const icons = {
    LayoutDashboard, Briefcase, HardHat, Award, ClipboardList, ShoppingCart,
    ClipboardCheck, Image, Package, Grid, Layers, PackageOpen, Tool,
    ArrowLeftRight, Wrench, Handshake, Users, IdCard, Megaphone, UserPlus,
    Clock, FileText, AlertCircle, Settings, HardDrive, Bug, Home, Inbox, Calendar,
    Building, Truck, Banknote, Receipt, Table2, Ruler, UserX, Target, Folder, BadgeCheck, BrainCircuit
};

const SidebarSkeleton = () => (
    <div className="space-y-4 px-3 py-4">
        {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
                <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            </div>
        ))}
    </div>
);

const detectSectionFromRoute = (pathname, items) => {
    if (!items || items.length === 0) return null;
    const sortedItems = [...items].sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));
    const activeItem = sortedItems.find(item =>
        item.path && (pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)))
    );
    return activeItem ? activeItem.parent : null;
};

const Sidebar = ({ activeModule, setActiveModule, sessionRole }) => {
    const { appShellData } = useAppShell();
    const [menuItems, setMenuItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedSectionKey, setExpandedSectionKey] = useState(null);

    const location = useLocation();
    const { user } = useAuth();

    const [activeLeadsCount, setActiveLeadsCount] = useState(0);
    const [ausenciasPendientesCount, setAusenciasPendientesCount] = useState(0);

    useEffect(() => {
        const fetchLeadsCount = async () => {
            if (sessionRole?.rol === 'tecnico') {
                try {
                    const { count, error } = await supabase
                        .from('leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('estado', 'nuevo')
                        .eq('archivado', false);
                    if (!error) setActiveLeadsCount(count || 0);
                } catch (err) {}
            }
        };
        if (user?.id) {
            fetchLeadsCount();
            const interval = setInterval(fetchLeadsCount, 60000);
            return () => clearInterval(interval);
        }
    }, [sessionRole, user?.id]);

    // Contador ausencias pendientes (solo admin/encargado)
    useEffect(() => {
        if (!user?.id) return;
        const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';
        if (!isAdminOrEncargado) return;

        const fetchAusencias = async () => {
            try {
                const { count } = await supabase
                    .from('vacaciones_solicitudes')
                    .select('*', { count: 'exact', head: true })
                    .eq('estado', 'pendiente');
                setAusenciasPendientesCount(count || 0);
            } catch (err) {}
        };

        fetchAusencias();
        const interval = setInterval(fetchAusencias, 60000);

        // Realtime
        const channelName = 'sidebar-ausencias-pendientes';

        // Si ya existe un canal con este nombre (doble montaje, remount rápido, etc.),
        // lo quitamos primero para evitar "cannot add postgres_changes callbacks after subscribe()"
        const existingChannel = supabase.getChannels().find(ch => ch.topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'vacaciones_solicitudes' }, fetchAusencias)
            .subscribe();

        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
        };
    }, [user?.id, sessionRole]);

    useEffect(() => {
        if (!user?.id) {
            setMenuItems([]);
            setIsLoading(false);
            return;
        }

        const controller = new AbortController();

        const fetchMenu = async () => {
            setIsLoading(true);
            try {
                const { data, error } = await supabase
                    .rpc('menu_sections')
                    .abortSignal(controller.signal);

                if (error) throw error;

                let normalizedItems = [];
                if (Array.isArray(data)) {
                    normalizedItems = data;
                } else if (data?.data?.menu && Array.isArray(data.data.menu)) {
                    normalizedItems = data.data.menu;
                } else if (data?.data && Array.isArray(data.data)) {
                    normalizedItems = data.data;
                }

                let items = [...normalizedItems];

                // Filters
                items = items.filter(item =>
                    item.key !== 'partes_historico' &&
                    item.key !== 'adjuntos' &&
                    item.key !== 'invitar_colaboradores' &&
                    item.key !== 'sistema' &&
                    item.parent !== 'sistema'
                );

                // Role specific tweaks
                if (sessionRole?.rol === 'colaborador') {
                    items = items.map(item => {
                        if (item.key === 'leads') return { ...item, parent: 'crm' };
                        return item;
                    });
                }

                // Injections
                const hasPersonalSection = items.some(i => i.key === 'personal');
                if (hasPersonalSection) {
                    items = items.filter(item => item.key !== 'horas_extras');
                    items.push({
                        key: 'horas_extras',
                        label: 'HORAS EXTRAS',
                        path: '/personal/horas-extras',
                        parent: 'personal',
                        orden: 63,
                        icon: 'Clock'
                    });

                    // ── NÓMINAS: solo visible para admin ──
                    if (sessionRole?.rol === 'admin') {
                        items = items.filter(item => item.key !== 'nominas');
                        items.push({
                            key: 'nominas',
                            label: 'NÓMINAS',
                            path: '/personal/nominas',
                            parent: 'personal',
                            orden: 70,
                            icon: 'Banknote'
                        });
                    }
                }

                // ── MI FICHAJE: reutiliza la pantalla de fichaje de técnicos para el admin ──
                if (sessionRole?.rol === 'admin' && !items.some(i => i.path === '/personal/fichajes')) {
                    items.push({
                        key: 'mi_fichaje',
                        label: 'MI FICHAJE',
                        path: '/personal/fichajes',
                        parent: null,
                        orden: 9,
                        icon: 'Clock'
                    });
                }

                if (['admin', 'encargado'].includes(sessionRole?.rol) && !items.some(i => i.key === 'control_ia')) {
                    items.push({
                        key: 'control_ia',
                        label: 'CONTROL IA360',
                        path: '/control-ia',
                        parent: null,
                        orden: 7,
                        icon: 'BrainCircuit'
                    });
                }

                if (['admin', 'encargado'].includes(sessionRole?.rol)) {
                    // Forzamos una única entrada canónica: algunas configuraciones antiguas
                    // contienen la clave con otro padre y eso la oculta en el menú.
                    items = items.filter(item =>
                        item.key !== 'sistemas_rendimiento' && item.path !== '/inventario/rendimientos'
                    );
                    items.push({
                        key: 'sistemas_rendimiento',
                        label: 'PARTIDAS Y RENDIMIENTOS',
                        path: '/inventario/rendimientos',
                        parent: 'inventario',
                        orden: 47,
                        icon: 'Ruler'
                    });
                }

                items = items.map(item => {
                    if (item.key === 'empleados' && item.parent === 'personal') {
                        return { ...item, icon: 'Users' };
                    }
                    return item;
                });

                // Inject Global Gantt under Management (Gestión)
                const hasGestionSection = items.some(i => i.key === 'gestion');
                if (hasGestionSection && !items.some(i => i.key === 'cronograma_global')) {
                    items.push({
                        key: 'cronograma_global',
                        label: 'CRONOGRAMA GLOBAL',
                        path: '/gestion/cronograma-global',
                        parent: 'gestion',
                        orden: 25,
                        icon: 'Calendar'
                    });
                }

                if (sessionRole?.rol === 'tecnico') {
                    if (!items.some(i => i.key === 'mis_leads')) {
                        items.push({
                            key: 'mis_leads',
                            label: 'Mis Leads',
                            path: '/gestion/leads',
                            parent: null,
                            orden: 8,
                            icon: 'Megaphone'
                        });
                    }
                    if (!items.some(i => i.key === 'vehiculos')) {
                        items.push({
                            key: 'vehiculos',
                            label: 'VEHICULOS',
                            path: '/inventario/vehiculos',
                            parent: 'inventario',
                            orden: 48,
                            icon: 'Truck'
                        });
                    }
                }

                if (sessionRole?.rol === 'finca_admin') {
                    items = items.map(item => {
                        if (item.key === 'leads') return { ...item, parent: null, orden: 5 };
                        return item;
                    });

                    if (!items.some(i => i.key === 'leads')) {
                        items.push({
                            key: 'leads',
                            label: 'LEADS',
                            path: '/crm/leads',
                            parent: null,
                            orden: 5,
                            icon: 'Megaphone'
                        });
                    }

                    if (!items.some(i => i.key === 'carpetas')) {
                        items.push({
                            key: 'carpetas',
                            label: 'CARPETAS',
                            path: '/carpetas',
                            parent: null,
                            orden: 26,
                            icon: 'Folder'
                        });
                    }
                }

                items.sort((a, b) => (a.orden || 9999) - (b.orden || 9999));
                setMenuItems(items);

            } catch (err) {
                if (err.name !== 'AbortError') {}
            } finally {
                setIsLoading(false);
            }
        };

        fetchMenu();
        return () => controller.abort();
    }, [user?.id, sessionRole]);

    const { roots, childrenByParent } = useMemo(() => {
        const sortedItems = [...menuItems].sort((a, b) => (a.orden || 9999) - (b.orden || 9999));
        const roots = sortedItems.filter(item => !item.parent && item.key !== 'dashboard');
        const childrenByParent = new Map();
        sortedItems.forEach(item => {
            if (item.parent) {
                if (!childrenByParent.has(item.parent)) {
                    childrenByParent.set(item.parent, []);
                }
                childrenByParent.get(item.parent).push(item);
            }
        });
        childrenByParent.forEach((children) => {
            children.sort((a, b) => (a.orden || 9999) - (b.orden || 9999));
        });
        return { roots, childrenByParent };
    }, [menuItems]);

    const toggleSection = (key) => {
        setExpandedSectionKey(prev => prev === key ? null : key);
    };

    useEffect(() => {
        if (menuItems.length > 0) {
            const targetSection = detectSectionFromRoute(location.pathname, menuItems);
            if (targetSection !== expandedSectionKey) {
                setExpandedSectionKey(targetSection);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menuItems, location.pathname]);

    const getItemProps = (item) => {
        const isInbox = item.key === 'bandeja-entrada';
        const isLeads = item.key === 'mis_leads';
        const isAusencias = item.key === 'ausencias' || item.path === '/gestion/ausencias';

        const isActive = item.path && (
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path))
        );

        let badgeCount = 0;
        let badgeVariant = 'destructive';

        if (isInbox) {
            badgeCount = appShellData?.notificaciones?.total_no_leidas || 0;
            badgeVariant = 'destructive';
        } else if (isLeads) {
            badgeCount = activeLeadsCount;
            badgeVariant = 'secondary';
        } else if (isAusencias) {
            badgeCount = ausenciasPendientesCount;
            badgeVariant = 'destructive';
        }

        return { isActive, badgeCount, badgeVariant };
    };

    return (
        <ScrollArea className="h-full py-4 px-3">
            {isLoading && menuItems.length === 0 ? (
                <SidebarSkeleton />
            ) : (
                <nav className="space-y-1">
                    {roots.map((rootItem) => {
                        const Icon = icons[rootItem.icon] || Folder;
                        const { isActive, badgeCount, badgeVariant } = getItemProps(rootItem);

                        const isAdminOrEncargado = sessionRole?.rol === 'admin' || sessionRole?.rol === 'encargado';
                        const isDesktopOnly = rootItem.key === 'administracion' && !isAdminOrEncargado;
                        const containerClass = isDesktopOnly ? "hidden lg:block" : "";

                        const children = childrenByParent.get(rootItem.key) || [];
                        const hasChildren = children.length > 0;
                        const isExpanded = expandedSectionKey === rootItem.key;

                        if (rootItem.path && typeof rootItem.path === 'string' && !hasChildren) {
                            if (!rootItem.path) return null;
                            return (
                                <div key={rootItem.key} className={containerClass}>
                                    <Link
                                        to={rootItem.path}
                                        onClick={() => {
                                            setActiveModule(rootItem.path);
                                            setExpandedSectionKey(null);
                                        }}
                                        className={cn(
                                            "flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted/50 hover:text-primary relative",
                                            isActive ? "bg-muted text-primary" : "text-muted-foreground"
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <NotificationBadge count={badgeCount} variant={badgeVariant}>
                                                <Icon className="h-4 w-4" />
                                            </NotificationBadge>
                                            {rootItem.label}
                                        </div>
                                    </Link>
                                </div>
                            );
                        }

                        return (
                            <div key={rootItem.key} className={cn("space-y-1", containerClass)}>
                                <button
                                    onClick={() => toggleSection(rootItem.key)}
                                    className={cn(
                                        "w-full flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-bold transition-all hover:bg-muted/50 hover:text-primary relative select-none",
                                        isExpanded ? "text-primary" : "text-muted-foreground"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Icon className="h-4 w-4" />
                                        {rootItem.label}
                                    </div>
                                    <ChevronDown
                                        className={cn(
                                            "h-4 w-4 transition-transform duration-200 opacity-50",
                                            isExpanded ? "rotate-180 opacity-100" : ""
                                        )}
                                    />
                                </button>

                                <AnimatePresence initial={false}>
                                    {isExpanded && hasChildren && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: "auto", opacity: 1 }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.2, ease: "easeInOut" }}
                                            className="overflow-hidden"
                                        >
                                            <div className="space-y-1 mt-1 mb-2">
                                                {children.map((childItem) => {
                                                    const SubIcon = icons[childItem.icon] || Target;
                                                    const childProps = getItemProps(childItem);
                                                    if (!childItem.path) return null;
                                                    return (
                                                        <Link
                                                            key={childItem.key}
                                                            to={childItem.path}
                                                            onClick={() => setActiveModule(childItem.path)}
                                                            className={cn(
                                                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all hover:bg-muted/50 hover:text-primary ml-4",
                                                                childProps.isActive
                                                                    ? "bg-muted text-primary"
                                                                    : "text-muted-foreground"
                                                            )}
                                                        >
                                                            <SubIcon className="h-4 w-4 opacity-70" />
                                                            {childItem.label}
                                                        </Link>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                </nav>
            )}
        </ScrollArea>
    );
};

export default Sidebar;
