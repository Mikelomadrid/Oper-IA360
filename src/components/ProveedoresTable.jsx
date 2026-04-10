import React from 'react';
import { MoreHorizontal, Edit, Trash2, ChevronRight, Loader2, User, Phone, Mail, Box } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';

const ProveedoresTable = ({ items, loading, navigate, canManage, onEdit, onDelete, lastElementRef }) => {
    return (
        <div className="overflow-x-auto min-h-[400px]">
            <Table>
                <TableHeader className="bg-muted/50">
                    <TableRow>
                        <TableHead className="w-[30%]">Proveedor</TableHead>
                        <TableHead className="w-[20%] hidden md:table-cell">Contacto</TableHead>
                        <TableHead className="w-[25%] hidden lg:table-cell">Datos de Contacto</TableHead>
                        <TableHead className="w-[15%] hidden sm:table-cell">CIF/NIF</TableHead>
                        <TableHead className="text-right w-[10%]">Acciones</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {loading && items.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-64 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary"/>
                                <p>Cargando proveedores...</p>
                            </div>
                        </TableCell></TableRow>
                    ) : !loading && items.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="h-64 text-center">
                            <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <div className="p-4 bg-muted rounded-full mb-3">
                                    <Box className="h-8 w-8 opacity-50" />
                                </div>
                                <p className="font-medium">No se encontraron proveedores.</p>
                                <p className="text-sm">Intenta ajustar tu búsqueda.</p>
                            </div>
                        </TableCell></TableRow>
                    ) : (
                        items.map((item, index) => (
                            <TableRow 
                                key={item.id} 
                                ref={items.length === index + 1 ? lastElementRef : null}
                                className="group hover:bg-muted/30 cursor-pointer transition-colors"
                                onClick={() => navigate(`/crm/proveedores/${item.id}`)}
                            >
                                <TableCell className="py-4">
                                    <div className="flex flex-col">
                                        <span className="font-semibold text-base text-foreground group-hover:text-primary transition-colors">{item.nombre}</span>
                                        {item.activo === false && <Badge variant="secondary" className="w-fit mt-1 text-[10px]">Inactivo</Badge>}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell align-top py-4">
                                    {item.contacto ? (
                                        <div className="flex items-center gap-2 text-sm">
                                            <User className="w-4 h-4 text-muted-foreground" />
                                            <span className="font-medium">{item.contacto}</span>
                                        </div>
                                    ) : (
                                        <span className="text-muted-foreground text-sm italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="hidden lg:table-cell align-top py-4">
                                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                                        {item.email && (
                                            <div className="flex items-center gap-1.5">
                                                <Mail className="w-3.5 h-3.5" />
                                                <span className="truncate max-w-[200px]">{item.email}</span>
                                            </div>
                                        )}
                                        {item.telefono && (
                                            <div className="flex items-center gap-1.5">
                                                <Phone className="w-3.5 h-3.5" />
                                                <span>{item.telefono}</span>
                                            </div>
                                        )}
                                        {!item.email && !item.telefono && <span className="italic">-</span>}
                                    </div>
                                </TableCell>
                                <TableCell className="hidden sm:table-cell align-top py-4">
                                    {item.cif ? (
                                        <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                                            {item.cif}
                                        </Badge>
                                    ) : (
                                        <span className="text-muted-foreground text-xs italic">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-right align-middle">
                                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                                        <Button 
                                            variant="ghost" 
                                            size="sm"
                                            className="hidden lg:flex" 
                                            onClick={() => navigate(`/crm/proveedores/${item.id}`)}
                                        >
                                            Ver
                                        </Button>

                                        {canManage ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted"><MoreHorizontal className="h-4 w-4"/></Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-48">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem onClick={() => navigate(`/crm/proveedores/${item.id}`)}>
                                                        <Box className="mr-2 h-4 w-4"/> Ver Detalles
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => onEdit(item)}>
                                                        <Edit className="mr-2 h-4 w-4"/> Editar Proveedor
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                                                                <Trash2 className="mr-2 h-4 w-4"/> Eliminar
                                                            </DropdownMenuItem>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Confirmar eliminación</AlertDialogTitle>
                                                            </AlertDialogHeader>
                                                            <AlertDialogDescription>
                                                                ¿Estás seguro de que quieres eliminar a "<strong>{item.nombre}</strong>"?
                                                                <br/><br/>
                                                                Esta acción no se puede deshacer.
                                                            </AlertDialogDescription>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                <AlertDialogAction onClick={() => onDelete(item.id)} className="bg-destructive hover:bg-destructive/90">
                                                                    Eliminar
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : (
                                            <Button variant="ghost" size="icon" onClick={() => navigate(`/crm/proveedores/${item.id}`)}>
                                                <ChevronRight className="h-4 w-4 text-muted-foreground"/>
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

export default ProveedoresTable;