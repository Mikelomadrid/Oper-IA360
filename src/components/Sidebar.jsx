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
    Target, Folder, Loader2, BadgeCheck
} from 'lucide-react';

const icons = {
    LayoutDashboard, Briefcase, HardHat, Award, ClipboardList, ShoppingCart,
    ClipboardCheck, Image, Package, Grid, Layers, PackageOpen, Tool,
    ArrowLeftRight, Wrench, Handshake, Users, IdCard, Megaphone, UserPlus,
    Clock, FileText, AlertCircle, Settings, HardDrive, Bug, Home, Inbox, Calendar,
    Building, Truck, Banknote, Receipt, Table2, Ruler, UserX, Target, Folder, BadgeCheck
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

/**
 * Task 5: Helper to auto-detect section from current route.
 * Looks for the deepest matching path in menu items and returns its parent key.
 */
const detectSectionFromRoute = (pathname, items) => {
    if (!items || items.length === 0) return null;

    // Sort items by path length descending so specific paths (/a/b) match before generic ones (/a)
    const sortedItems = [...items].sort((a, b) => (b.path?.length || 0) - (a.path?.length || 0));

    const activeItem = sortedItems.find(item =>
        item.path && (pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path)))
    );

    // Task 6: If active item is a root (no parent), we return null to close other sections
    return activeItem ? activeItem.parent : null;
};

const Sidebar = ({ activeModule, setActiveModule, sessionRole }) => {
    const { appShellData } = useAppShell();
    const [menuItems, setMenuItems] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Task 1: Refactored State Management
    // Previous logic might have allowed multiple sections or relied on complex derivation.
    // New Logic: Single source of truth 'expandedSectionKey' (string | null).
    // - string: The key of the currently open section (e.g., 'gestion', 'personal').
    // - null: All sections are collapsed.
    // This strictly enforces the "at most one section open" rule (Task 3).
    const [expandedSectionKey, setExpandedSectionKey] = useState(null);

    const location = useLocation();
    const { user } = useAuth();

    const [activeLeadsCount, setActiveLeadsCount] = useState(0);

    // --- 1. Fetch Technician Assigned Leads Count ---
    useEffect(() => {
        const fetchLeadsCount = async () => {
            if (sessionRole?.rol === 'tecnico') {
                try {
                    const { count, error } = await supabase
                        .from('leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('estado', 'nuevo')
                        .eq('archivado', false);

                    if (!error) {
                        setActiveLeadsCount(count || 0);
                    }
                } catch (err) {
                    // Silent error handling
                }
            }
        };

        if (user?.id) {
            fetchLeadsCount();
            const interval = setInterval(fetchLeadsCount, 60000);
            return () => clearInterval(interval);
        }
    }, [sessionRole, user?.id]);

    // --- 2. Menu Fetching Logic ---
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
                        orden: 25, // After Obras (usually 20)
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
                if (err.name !== 'AbortError') {
                    // Error handling
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchMenu();
        return () => controller.abort();
    }, [user?.id, sessionRole]);

    // Hierarchical Data Organization
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

    // Task 2 & 3: Single Toggle Function
    const toggleSection = (key) => {
        // If clicking same section -> Close it (null)
        // If clicking new section -> Open it (key)
        // This implicitly closes any other open section because state is a single string.
        setExpandedSectionKey(prev => prev === key ? null : key);
    };

    // Task 5: Auto-expand based on route
    // Replaces previous manual initialization logic.
    // Runs on every route change to keep sidebar in sync.
    useEffect(() => {
        if (menuItems.length > 0) {
            // Task 5: Detect parent section of current route
            const targetSection = detectSectionFromRoute(location.pathname, menuItems);

            // Task 7: Only update state if it differs to avoid redundant renders, 
            // effectively handling auto-close if route belongs to root item (targetSection = null)
            // or auto-expand if route belongs to submenu (targetSection = 'parent_key').
            if (targetSection !== expandedSectionKey) {
                setExpandedSectionKey(targetSection);
            }
        }
        // Task 8: Dependency array ensures this runs on route change (navigation) or menu load.
        // 'expandedSectionKey' is purposefully excluded to avoid cycles, but included in the if check.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [menuItems, location.pathname]);

    // Helper to determine active status and badge
    const getItemProps = (item) => {
        const isInbox = item.key === 'bandeja-entrada';
        const isLeads = item.key === 'mis_leads';

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

                        // --- Case A - Root is a Link (no children) ---
                        // Task 6: Clicking a top-level section with no submenu closes others.
                        if (rootItem.path && typeof rootItem.path === 'string' && !hasChildren) {
                            if (!rootItem.path) return null;

                            return (
                                <div key={rootItem.key} className={containerClass}>
                                    <Link
                                        to={rootItem.path}
                                        onClick={() => {
                                            setActiveModule(rootItem.path);
                                            // Task 6: Close any open accordion when clicking a root link
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

                        // --- Case B - Root is a Section Header (Accordion) ---
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
                                                            // Task 4: Navigation inside subsection does NOT close parent
                                                            // because setActiveModule doesn't touch expandedSectionKey state,
                                                            // and detectSectionFromRoute will re-confirm the parent should be open.
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