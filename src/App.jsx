import React, { useState, useEffect, Suspense, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, LogOut, Loader2, AlertTriangle, Palette, Bell } from 'lucide-react';
import { HashRouter, useLocation, useNavigate, Routes, Route, Navigate } from 'react-router-dom';

// Core Utilities
import { Toaster } from '@/components/ui/toaster';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { AuthProvider, useAuth } from '@/contexts/SupabaseAuthContext';
import { NetworkStatusProvider } from '@/contexts/NetworkStatusContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { AppShellProvider, useAppShell } from '@/contexts/AppShellContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import LogoOperIA360 from '@/components/LogoOperIA360';
import { ThemeSelector } from "@/components/ThemeSelector";
import GlobalErrorBanner from '@/components/GlobalErrorBanner';
import { NotificationBadge } from '@/components/ui/NotificationBadge';

// --- LAZY LOAD ALL VIEWS ---
const Login = React.lazy(() => import('@/components/Login'));
const Sidebar = React.lazy(() => import('@/components/Sidebar'));
const Leads = React.lazy(() => import('@/components/Leads.jsx'));
const Employees = React.lazy(() => import('@/components/Employees'));
const Projects = React.lazy(() => import('@/components/Projects'));
const ResetPassword = React.lazy(() => import('@/components/ResetPassword'));
const AuthCallback = React.lazy(() => import('@/components/AuthCallback'));
const MyProfile = React.lazy(() => import('@/components/MyProfile'));
const ControlHorasView = React.lazy(() => import('@/components/HorasExtras2View'));
const HorasExtras2View = React.lazy(() => import('@/components/HorasExtras2View'));

const LeadDetail = React.lazy(() => import('@/components/LeadDetail'));
const SharedProjectSettlementTab = React.lazy(() => import('@/components/SharedProjectSettlementTab'));
const GlobalGanttView = React.lazy(() => import('@/components/GlobalGanttView'));
const ProjectDetail = React.lazy(() => import('@/components/ProjectDetail'));
const ProjectMaterialsView = React.lazy(() => import('@/components/ProjectMaterialsView'));

const ProjectSelectionForCertificate = React.lazy(() => import('@/components/ProjectSelectionForCertificate'));
const ProjectCompletionCertificate = React.lazy(() => import('@/components/ProjectCompletionCertificate'));
const ActaFinalizacion = React.lazy(() => import('@/components/ActaFinalizacion'));

const ClientDetail = React.lazy(() => import('@/components/ClientDetail'));
const Clients = React.lazy(() => import('@/components/Clients'));
const Proveedores = React.lazy(() => import('@/components/Proveedores'));
const ProveedorDetail = React.lazy(() => import('@/components/ProveedorDetail'));
const EmployeeDetail = React.lazy(() => import('@/components/EmployeeDetail'));
const Tareas = React.lazy(() => import('@/components/Tareas'));
const PartesAdminView = React.lazy(() => import('@/components/PartesAdminView'));
const ParteCreateForm = React.lazy(() => import('@/components/ParteCreateForm'));
const ParteDetail = React.lazy(() => import('@/components/ParteDetail'));

const TechnicianDashboard = React.lazy(() => import('@/components/TechnicianDashboard'));
const TechnicianFichajeView = React.lazy(() => import('@/components/TechnicianFichajeView'));
const NotificationsHandler = React.lazy(() => import('@/components/NotificationsHandler'));
const AdminFichajes = React.lazy(() => import('@/components/AdminFichajes'));
const Vehiculos = React.lazy(() => import('@/components/Vehiculos'));
const VehiculoDetail = React.lazy(() => import('@/components/VehiculoDetail'));

const ToolsCatalogView = React.lazy(() => import('@/components/ToolsCatalogView'));
const Materiales = React.lazy(() => import('@/components/Materiales'));
const MaterialDetailView = React.lazy(() => import('@/components/MaterialDetailView'));
const MaterialRequests = React.lazy(() => import('@/components/MaterialRequests'));
const SolicitudesHerramientasView = React.lazy(() => import('@/components/SolicitudesHerramientasView'));
const RepairWorkshopView = React.lazy(() => import('@/views/RepairWorkshopView'));
const MisHerramientas = React.lazy(() => import('@/components/MisHerramientas'));
const ToolDetailView = React.lazy(() => import('@/components/ToolDetailView'));
const ToolTransfersView = React.lazy(() => import('@/components/ToolTransfersView'));

const HistoricoFichajes = React.lazy(() => import('@/components/HistoricoFichajes'));
const EmployeeCalendarView = React.lazy(() => import('@/components/EmployeeCalendarView'));
const AdminCalendarView = React.lazy(() => import('@/components/AdminCalendarView'));
const Anticipos = React.lazy(() => import('@/components/Anticipos'));
const Embargos = React.lazy(() => import('@/components/Embargos'));
const EmbargoDetail = React.lazy(() => import('@/components/EmbargoDetail'));
const AdminIncidencias = React.lazy(() => import('@/components/AdminIncidencias'));
const PersonalDocuments = React.lazy(() => import('@/components/PersonalDocuments'));

const AdminAusencias = React.lazy(() => import('@/components/AdminAusencias'));
const EmployeeAusencias = React.lazy(() => import('@/components/EmployeeAusencias'));

const GastosView = React.lazy(() => import('@/views/GastosView'));
const GastosScanner = React.lazy(() => import('@/components/GastosScanner'));
const AdminDocumentacion = React.lazy(() => import('@/components/AdminDocumentacion'));
const GlobalAttachments = React.lazy(() => import('@/components/GlobalAttachments'));

const MedicionesPage = React.lazy(() => import('@/components/MedicionesPage'));

const InicioView = React.lazy(() => import('@/components/private/InicioView'));
const BandejaEntradaView = React.lazy(() => import('@/components/private/BandejaEntradaView'));
const CalendarioPrivadoView = React.lazy(() => import('@/components/private/CalendarioPrivadoView'));

// --- New Finca Admin Components ---
const CarpetasPage = React.lazy(() => import('@/components/finca/CarpetasPage'));

// --- TEMPORARY TEST SCREENS ---
const TestControlHorarioExtras = React.lazy(() => import('@/components/TestControlHorarioExtras'));

// --- LAYOUT COMPONENTS ---

const AppHeader = ({ onMenuClick, navigate }) => {
  const { signOut } = useAuth();
  const { appShellData } = useAppShell();
  const [openTheme, setOpenTheme] = useState(false);

  // Use data from AppShellContext
  const unreadCount = appShellData?.notificaciones?.total_no_leidas || 0;

  const handleLogout = async () => {
    toast({ title: 'Cerrando sesión...' });
    await signOut();
    navigate('/login');
  };

  const handleLogoClick = () => {
    navigate('/inicio');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center px-4 md:px-6 justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenuClick}>
            <Menu className="w-5 h-5" />
          </Button>
          <div onClick={handleLogoClick} className="cursor-pointer">
            <LogoOperIA360 size="md" />
          </div>
        </div>
        <div className="flex items-center gap-2 relative">

          {/* Inbox Icon with Badge from Shell Data */}
          <Button variant="ghost" size="icon" onClick={() => navigate('/inbox')} className="relative">
            <NotificationBadge count={unreadCount} variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 text-[10px]">
              <Bell className="w-5 h-5" />
            </NotificationBadge>
          </Button>

          <button
            onClick={() => setOpenTheme(!openTheme)}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-white/10 transition"
          >
            <Palette className="w-5 h-5" />
          </button>

          {openTheme && (
            <div className="absolute top-full right-0 mt-2 z-50 bg-background border rounded-lg shadow-lg overflow-hidden w-[320px]">
              <ThemeSelector />
            </div>
          )}

          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

const TechnicianWrapper = ({ children }) => {
  return <div className="w-full h-full">{children}</div>;
};

const ModuleLoader = () => (
  <div className="flex h-full w-full items-center justify-center bg-background/50">
    <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
  </div>
);

const ModuleError = ({ error }) => (
  <div className="p-8 text-center">
    <div className="inline-flex items-center justify-center p-4 bg-red-50 rounded-full mb-4">
      <AlertTriangle className="w-8 h-8 text-red-500" />
    </div>
    <h3 className="text-lg font-bold text-red-700 mb-2">Error al cargar el módulo</h3>
    <p className="text-sm text-muted-foreground mb-4">Hubo un problema al cargar este componente.</p>
    <Button variant="outline" onClick={() => window.location.reload()}>Recargar página</Button>
  </div>
);

// --- HELPER FOR ACTIVE MODULE ---
const getActiveModule = (path, user) => {
  if (path === '/login') return { name: 'login' };
  if (path === '/auth/reset') return { name: 'reset-password' };
  if (path === '/auth/callback') return { name: 'auth-callback' };

  if (!user) return { name: 'login' };

  const routes = [
    { regex: /^\/crm\/leads\/([a-fA-F0-9-]+)/, name: 'crm/leads/detail' },
    { regex: /^\/gestion\/leads\/([a-fA-F0-9-]+)/, name: 'crm/leads/detail' },
    { regex: /^\/gestion\/obras\/([a-fA-F0-9-]+)\/acta-final/, name: 'gestion/acta-final' },
    { regex: /^\/gestion\/obras\/([a-fA-F0-9-]+)\/materiales/, name: 'project-materials' },
    { regex: /^\/gestion\/obras\/([a-fA-F0-9-]+)/, name: 'project-detail' },
    { regex: /^\/crm\/clientes\/([a-fA-F0-9-]+)/, name: 'client-detail' },
    { regex: /^\/gestion\/clientes\/([a-fA-F0-9-]+)/, name: 'client-detail' },
    { regex: /^\/crm\/proveedores\/([a-fA-F0-9-]+)/, name: 'proveedor-detail' },
    { regex: /^\/personal\/empleados\/([a-fA-F0-9-]+)/, name: 'personal/empleados/detail' },
    { regex: /^\/gestion\/partes\/editar\/([a-fA-F0-9-]+)/, name: 'gestion/partes/editar' },
    { regex: /^\/gestion\/partes\/detail\/([a-fA-F0-9-]+)/, name: 'gestion/partes/detail' },
    { regex: /^\/inventario\/vehiculos\/([a-fA-F0-9-]+)/, name: 'inventario/vehiculos/detail' },
    { regex: /^\/personal\/embargos\/([a-fA-F0-9-]+)/, name: 'personal/embargos/detail' },
    { regex: /^\/inventario\/herramientas\/([a-fA-F0-9-]+)/, name: 'inventario/herramientas/detail' },
    { regex: /^\/inventario\/materiales\/([a-fA-F0-9-]+)/, name: 'inventario/materiales/detail' },
    { regex: /^\/personal\/fichajes-admin\/([a-fA-F0-9-]+)/, name: 'personal/fichajes-admin/detail' },
  ];

  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) return { name: route.name, id: match[1] };
  }

  const staticRoutes = {
    '/inicio': 'inicio',
    '/crm/leads': 'crm/leads',
    '/gestion/leads': 'crm/leads',
    '/crm/clientes': 'crm/clientes',
    '/crm/proveedores': 'crm/proveedores',
    '/gestion/obras': 'gestion/obras',
    '/gestion/cronograma-global': 'cronograma-global',
    '/gestion/presupuestos': 'presupuestos',
    '/gestion/tareas': 'gestion/tareas',
    '/gestion/partes': 'gestion/partes',
    '/gestion/partes/nuevo': 'gestion/partes/nuevo',
    '/gestion/actas-finalizacion': 'gestion/actas-finalizacion',
    '/gestion/acta-finalizacion': 'gestion/acta-finalizacion',

    '/inventario/pedidos': 'inventario/pedidos',

    '/gestion/adjuntos': 'gestion/adjuntos',
    '/personal/empleados': 'personal/empleados',
    '/perfil': 'perfil',
    '/personal/fichajes': 'personal/fichajes',
    '/personal/fichajes-admin': 'personal/fichajes-admin',
    '/inventario/vehiculos': 'inventario/vehiculos',

    '/inventario/catalogo': 'inventario/catalogo',
    '/inventario/herramientas': 'inventario/catalogo',
    '/inventario/materiales': 'inventario/materiales',
    '/gestion/solicitudes': 'gestion/solicitudes',

    '/inventario/solicitudes-devoluciones': 'inventario/solicitudes',
    '/inventario/solicitudes': 'inventario/solicitudes',

    '/inventario/mis-herramientas': 'inventario/mis-herramientas',
    '/inventario/traspasos': 'inventario/traspasos',
    '/inventario/taller': 'inventario/taller',

    '/personal/historico': 'personal/historico',
    '/personal/calendario': 'personal/calendario',
    '/personal/gestion-calendario': 'personal/gestion-calendario',
    '/personal/anticipos': 'personal/anticipos',
    '/personal/embargos': 'personal/embargos',
    '/personal/embargos/detail': 'personal/embargos/detail',
    '/personal/incidencias': 'personal/incidencias',
    '/gestion/incidencias': 'gestion/incidencias',

    '/personal/documentacion': 'personal/documentacion',

    '/administracion/documentacion': 'administracion/documentacion',
    '/administracion/gastos': 'administracion/gastos',
    '/administracion/gastos/scanner': 'administracion/gastos/scanner',
    '/finanzas/gastos': 'administracion/gastos',

    '/gestion/ausencias': 'gestion/ausencias',
    '/personal/ausencias': 'personal/ausencias',
    '/personal/horas-extras': 'personal/horas-extras',
    '/personal/horas-extras-2': 'personal/horas-extras-2',

    '/mediciones': 'mediciones',

    '/estado-sistema': 'inicio',
    '/bandeja-entrada': 'bandeja-entrada',
    '/inbox': 'bandeja-entrada',
    '/calendario-privado': 'calendario-privado',

    '/prueba-extras': 'prueba-extras',

    '/carpetas': 'carpetas',
  };

  if (staticRoutes[path]) return { name: staticRoutes[path] };

  if (path === '/' || path === '/dashboard') return { name: 'inicio' };
  if (path.startsWith('/gestion/partes')) return { name: 'gestion/partes' };
  if (path.startsWith('/crm/leads')) return { name: 'crm/leads' };
  if (path.startsWith('/inventario/herramientas')) return { name: 'inventario/catalogo' };
  if (path.startsWith('/inventario/solicitudes')) return { name: 'inventario/solicitudes' };

  return { name: 'inicio' };
};

// --- MAIN CONTENT COMPONENT ---

const AppContent = () => {
  const { user, loadingAuth, sessionRole } = useAuth();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const isMounted = useRef(true);

  const location = useLocation();
  const navigateRouter = useNavigate();
  const currentPath = location.pathname;

  const activeModule = useMemo(() => getActiveModule(currentPath, user), [currentPath, user]);
  const isPublic = ['login', 'reset-password', 'auth-callback'].includes(activeModule.name);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (loadingAuth) return;

    if (!user) {
      if (!isPublic && !currentPath.startsWith('/auth')) {
        navigateRouter('/login');
      }
      return;
    }

    if (isPublic) {
      navigateRouter('/inicio');
      return;
    }

    const restrictedEmails = ['vanesa@delbrioyblanco.es', 'administracion@atcfincas.es'];
    const isRestrictedUser = restrictedEmails.includes(user.email) || sessionRole?.rol === 'finca_admin';

    if (isRestrictedUser) {
      const allowedPaths = [
        '/gestion/partes',
        '/perfil',
        '/inicio',
        '/inbox',
        '/bandeja-entrada',
        '/crm/leads',
        '/carpetas'
      ];
      const isAllowed = allowedPaths.some(p => currentPath.startsWith(p));
      if (!isAllowed) {
        navigateRouter('/gestion/partes');
      }
    }

  }, [user, loadingAuth, currentPath, isPublic, sessionRole, navigateRouter]);

  if (loadingAuth) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">Cargando sesión...</p>
        </div>
      </div>
    );
  }

  const navigate = (path) => {
    if (path === -1) {
      navigateRouter(-1);
      return;
    }
    navigateRouter(path);
    if (window.scrollY > 0) window.scrollTo(0, 0);
  };

  return (
    <>
      <Helmet>
        <title>OrkaRefor ERP</title>
      </Helmet>

      <div className="flex bg-background text-foreground flex-col" style={{ paddingTop: '56px' }}>
        <GlobalErrorBanner />

        <div className="flex flex-1 w-full relative" style={{ minHeight: 'calc(100vh - 56px)' }}>
          {!isPublic && user && (
            <>
              <div className="hidden md:flex w-64 flex-col border-r bg-card shrink-0 fixed left-0 overflow-y-auto" style={{ top: '56px', height: 'calc(100vh - 56px)', zIndex: 30 }}>
                <Suspense fallback={<div className="p-4"><Loader2 className="animate-spin w-6 h-6" /></div>}>
                  <Sidebar activeModule={activeModule.name} setActiveModule={navigate} sessionRole={sessionRole} />
                </Suspense>
              </div>

              <AnimatePresence>
                {isSidebarOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
                      onClick={() => setSidebarOpen(false)}
                    />

                    <motion.div
                      initial={{ x: "-100%" }}
                      animate={{ x: 0 }}
                      exit={{ x: "-100%" }}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      className="fixed inset-y-0 left-0 z-50 h-full w-[85%] max-w-sm border-r bg-background p-0 shadow-xl md:hidden overflow-y-auto"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex flex-col h-full">
                        <div className="p-4 border-b flex justify-between items-center bg-muted/20">
                          <span className="font-bold text-lg">Menú</span>
                          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
                            <LogOut className="w-5 h-5 rotate-180" />
                          </Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                          <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}>
                            <Sidebar
                              activeModule={activeModule.name}
                              setActiveModule={(path) => {
                                setSidebarOpen(false);
                                setTimeout(() => navigate(path), 10);
                              }}
                              sessionRole={sessionRole}
                            />
                          </Suspense>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </>
          )}

          <div className="flex flex-1 flex-col w-full relative min-h-screen min-w-0 md:ml-64">
            {!isPublic && user && (
              <AppHeader onMenuClick={() => setSidebarOpen(true)} navigate={navigate} sessionRole={sessionRole} />
            )}

            <main className="flex-1 p-0 w-full relative">
              <ErrorBoundary>
                <Suspense fallback={<ModuleLoader />}>
                  {user && (
                    <Suspense fallback={null}>
                      <NotificationsHandler />
                    </Suspense>
                  )}

                  {(() => {
                    try {
                      switch (activeModule.name) {
                        case 'login': return <Login navigate={navigate} />;
                        case 'reset-password': return <ResetPassword navigate={navigate} />;
                        case 'auth-callback': return <AuthCallback navigate={navigate} />;

                        case 'crm/leads': return <Leads navigate={navigate} />;
                        case 'crm/leads/detail': return <LeadDetail leadId={activeModule.id} navigate={navigate} />;
                        case 'crm/clientes': return <Clients navigate={navigate} />;
                        case 'client-detail': return <ClientDetail clientId={activeModule.id} navigate={navigate} />;
                        case 'crm/proveedores': return <Proveedores navigate={navigate} />;
                        case 'proveedor-detail': return <ProveedorDetail proveedorId={activeModule.id} navigate={navigate} />;

                        case 'gestion/obras': return <Projects navigate={navigate} />;
                        case 'cronograma-global': return <GlobalGanttView />;
                        case 'project-detail': return <ProjectDetail projectId={activeModule.id} navigate={navigate} />;
                        case 'project-materials': return <ProjectMaterialsView />;
                        case 'gestion/actas-finalizacion': return <ProjectSelectionForCertificate navigate={navigate} />;
                        case 'gestion/acta-final': return <ProjectCompletionCertificate projectId={activeModule.id} navigate={navigate} />;
                        case 'gestion/acta-finalizacion': return <ActaFinalizacion navigate={navigate} />;
                        case 'gestion/tareas': return <Tareas navigate={navigate} />;
                        case 'gestion/partes': return <PartesAdminView navigate={navigate} />;
                        case 'gestion/partes/nuevo': return <ParteCreateForm navigate={navigate} />;

                        case 'gestion/partes/editar': return <ParteCreateForm navigate={navigate} parteId={activeModule.id} isEdit={true} />;
                        case 'gestion/partes/detail': return <ParteDetail navigate={navigate} parteId={activeModule.id} />;

                        case 'gestion/solicitudes':
                        case 'inventario/pedidos':
                          return <MaterialRequests navigate={navigate} />;
                        case 'gestion/ausencias': return <AdminAusencias />;
                        case 'gestion/incidencias': return <TechnicianWrapper><TechnicianDashboard navigate={navigate} view="incidencias" /></TechnicianWrapper>;
                        case 'gestion/adjuntos': return <GlobalAttachments />;

                        case 'personal/empleados': return <Employees navigate={navigate} />;
                        case 'personal/empleados/detail': return <EmployeeDetail employeeId={activeModule.id} navigate={navigate} />;
                        case 'perfil': return <MyProfile navigate={navigate} />;
                        case 'personal/horas-extras': return <ControlHorasView />;
                        case 'personal/horas-extras-2': return <ControlHorasView />;
                        case 'personal/fichajes': return <TechnicianWrapper><TechnicianFichajeView navigate={navigate} /></TechnicianWrapper>;
                        case 'personal/fichajes-admin': return <AdminFichajes />;
                        case 'personal/fichajes-admin/detail': return <AdminFichajes fichajeId={activeModule.id} />;

                        case 'personal/historico': return <HistoricoFichajes />;
                        case 'personal/calendario': return <EmployeeCalendarView navigate={navigate} />;
                        case 'personal/gestion-calendario': return <AdminCalendarView />;
                        case 'personal/anticipos': return <Anticipos />;
                        case 'personal/embargos': return <Embargos navigate={navigate} />;
                        case 'personal/embargos/detail': return <EmbargoDetail embargoId={activeModule.id} navigate={navigate} />;
                        case 'personal/incidencias': return <AdminIncidencias />;
                        case 'personal/documentacion': return <PersonalDocuments />;
                        case 'personal/ausencias': return <EmployeeAusencias />;

                        case 'inventario/vehiculos': return <Vehiculos navigate={navigate} />;
                        case 'inventario/vehiculos/detail': return <VehiculoDetail vehiculoId={activeModule.id} navigate={navigate} />;
                        case 'inventario/catalogo': return <ToolsCatalogView navigate={navigate} />;
                        case 'inventario/herramientas/detail': return <ToolDetailView toolId={activeModule.id} navigate={navigate} />;
                        case 'inventario/materiales': return <Materiales navigate={navigate} />;
                        case 'inventario/materiales/detail': return <MaterialDetailView materialId={activeModule.id} navigate={navigate} />;

                        case 'inventario/solicitudes': return <SolicitudesHerramientasView navigate={navigate} />;

                        case 'inventario/mis-herramientas': return <MisHerramientas navigate={navigate} />;
                        case 'inventario/traspasos': return <ToolTransfersView navigate={navigate} />;
                        case 'inventario/taller': return <RepairWorkshopView navigate={navigate} />;

                        case 'administracion/documentacion': return <AdminDocumentacion />;
                        case 'administracion/gastos': return <GastosView navigate={navigate} />;
                        case 'administracion/gastos/scanner': return <GastosScanner navigate={navigate} />;

                        case 'mediciones': return <MedicionesPage />;

                        case 'inicio': return <InicioView />;
                        case 'estado-sistema': return <InicioView />;
                        case 'bandeja-entrada': return <BandejaEntradaView />;
                        case 'calendario-privado': return <CalendarioPrivadoView />;

                        case 'prueba-extras': return <TestControlHorarioExtras />;

                        case 'carpetas':
                          if (sessionRole?.rol !== 'finca_admin') return <Navigate to="/inicio" />;
                          return <CarpetasPage />;

                        default: return <div className="p-8 text-center text-muted-foreground">Módulo no encontrado o en construcción: {currentPath}</div>;
                      }
                    } catch (e) {
                      return <ModuleError error={e} />;
                    }
                  })()}
                </Suspense>
              </ErrorBoundary>
            </main>
          </div>
        </div>
      </div>
    </>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <NetworkStatusProvider>
          <AuthProvider>
            <NotificationProvider>
              <AppShellProvider>
                <ThemeProvider>
                  <AppContent />
                  <Toaster />
                </ThemeProvider>
              </AppShellProvider>
            </NotificationProvider>
          </AuthProvider>
        </NetworkStatusProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}