import React from 'react';
import { MoreHorizontal, Edit, Trash2, Users, ChevronRight, Loader2, MapPin, Mail, Phone, UserCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

const ClientesTable = ({ 
    items, 
    loading, 
    navigate, 
    canEdit,
    canDelete,
    onEdit, 
    onDelete, 
    lastElementRef 
}) => {
    return (
        <div className="overflow-x-auto min-h-[400px]">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[30%]">Cliente</TableHead>
                        <TableHead className="w-[20%] hidden md:table-cell">Contacto</TableHead>
                        <TableHead className="w-[25%] hidden lg:table-cell">Ubicación</TableHead>
                        <TableHead className="w-[15%] hidden sm:table-cell">CIF/NIF</TableHead>
                        <TableHead className="text-right w-[10%]">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-64">
                                <div className="flex flex-col items-center justify-center text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
                                    <p>Cargando cartera de clientes...</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : !loading && items.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={5} className="text-center h-64">
                                <div className="flex flex-col items-center justify-center text-muted-foreground">
                                    <div className="p-4 bg-muted rounded-full mb-3">
                                        <Users className="h-8 w-8 opacity-50" />
                                    </div>
                                    <p className="font-medium">No se encontraron clientes.</p>
                                    <p className="text-sm">Prueba a crear uno nuevo o a cambiar los filtros.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((client, index) => (
                            <TableRow 
                                key={client.id} 
                                ref={items.length === index + 1 ? lastElementRef : null}
                                className="group hover:bg-muted/30 transition-colors"
                            >
                                <TableCell className="py-4">
                                    <div className="flex flex-col">
                                        <span 
                                            className="font-semibold text-base text-foreground cursor-pointer hover:text-primary transition-colors hover:underline underline-offset-4"
                                            onClick={() => navigate(`/crm/clientes/${client.id}`)}
                                        >
                                            {client.nombre}
                                        </span>
                                        <div className="flex flex-col gap-1 mt-1 text-sm text-muted-foreground">
                                            {client.email && (
                                                <div className="flex items-center gap-1.5">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    <span className="truncate max-w-[200px]">{client.email}</span>
                                                </div>
                                            )}
                                            {client.telefono && (
                                                <div className="flex items-center gap-1.5">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    <span>{client.telefono}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell align-top py-4">
                                    {client.contacto ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <UserCircle className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{client.contacto}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-sm italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell align-top py-4">
                                    {(client.municipio || client.provincia) ? (
                                        <div className="flex items-start gap-2 text-sm">
                                            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                                            <span>
                                                {[client.municipio, client.provincia].filter(Boolean).join(', ')}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-sm italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="hidden sm:table-cell align-top py-4">
                                    {client.cif ? (
                                        <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                                            {client.cif}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right align-middle">
                                    <div className="flex items-center justify-end gap-2">
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="hidden lg:flex" 
                                            onClick={() => navigate(`/crm/clientes/${client.id}`)}
                                        >
                                            Ver
                                        </Button>
                                        
                                        {(canEdit || canDelete) ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                                        <span className="sr-only">Acciones</span>
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => navigate(`/crm/clientes/${client.id}`)}>
                                                        <Users className="mr-2 h-4 w-4" /> Ver Detalles
                                                    </DropdownMenuItem>
                                                    
                                                    {canEdit && (
                                                        <DropdownMenuItem onClick={() => onEdit(client)}>
                                                            <Edit className="mr-2 h-4 w-4" /> Editar Cliente
                                                        </DropdownMenuItem>
                                                    )}
                                                    
                                                    {canDelete && (
                                                        <>
                                                            <DropdownMenuSeparator />
                                                            <AlertDialog>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                                        Eliminar
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                                <AlertDialogContent>
                                                                    <AlertDialogHeader>
                                                                        <AlertDialogTitle>¿Eliminar cliente?</AlertDialogTitle>
                                                                        <AlertDialogDescription>
                                                                            Estás a punto de eliminar a <strong>{client.nombre}</strong>.
                                                                            <br/><br/>
                                                                            Esta acción no se puede deshacer y podría afectar a proyectos históricos.
                                                                        </AlertDialogDescription>
                                                                    </AlertDialogHeader>
                                                                    <AlertDialogFooter>
                                                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                        <AlertDialogAction onClick={() => onDelete(client.id)} className="bg-destructive hover:bg-destructive/90">
                                                                            Eliminar
                                                                        </AlertDialogAction>
                                                                    </AlertDialogFooter>
                                                                </AlertDialogContent>
                                                            </AlertDialog>
                                                        </>
                                                    )}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => navigate(`/crm/clientes/${client.id}`)}>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
};

export default ClientesTable;