"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Satellite } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { PlusCircle, Trash2, Edit, Clock } from 'lucide-react';
import { Label } from "@/components/ui/label";
import Image from "next/image";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription as DialogDescriptionComponent,
} from "@/components/ui/dialog";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/use-auth';


const satelliteSchema = z.object({
    name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
    price: z.coerce.number().positive("El precio debe ser un número positivo."),
    dailyYield: z.coerce.number().min(0, "El rendimiento no puede ser negativo."),
    purchaseLimit: z.coerce.number().int().positive("El límite de compra debe ser un entero positivo."),
    durationDays: z.coerce.number().int().positive("La duración debe ser un número entero positivo."),
    isTimeLimited: z.boolean().default(false),
    timeLimitHours: z.coerce.number().optional(),
});


export default function EnergyPlantManagement() {
    const { user } = useAuth();
    const [satellites, setSatellites] = useState<Satellite[]>([]);
    const [satelliteImageDataUrl, setSatelliteImageDataUrl] = useState<string | null>(null);
    const [editingSatellite, setEditingSatellite] = useState<Satellite | null>(null);
    const [editingSatelliteImageDataUrl, setEditingSatelliteImageDataUrl] = useState<string | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        if (user?.role !== 'superadmin' && user?.role !== 'admin') return;

        const unsubscribe = onSnapshot(collection(db, "satellites"), (snapshot) => {
            const satellitesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    timeLimitSetAt: data.timeLimitSetAt instanceof Timestamp ? data.timeLimitSetAt.toDate() : undefined,
                    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
                } as Satellite
            });
            setSatellites(satellitesData);
        });
        return () => unsubscribe();
    }, [user]);
    
    const addForm = useForm<z.infer<typeof satelliteSchema>>({
        resolver: zodResolver(satelliteSchema),
        defaultValues: {
            name: "",
            price: 0,
            dailyYield: 0,
            purchaseLimit: 1,
            durationDays: 30,
            isTimeLimited: false,
            timeLimitHours: 24,
        },
    });

    const editForm = useForm<z.infer<typeof satelliteSchema>>({
        resolver: zodResolver(satelliteSchema),
    });

     const isTimeLimitedInAddForm = addForm.watch('isTimeLimited');
     const isTimeLimitedInEditForm = editForm.watch('isTimeLimited');

    useEffect(() => {
        if (editingSatellite) {
            editForm.reset({
                ...editingSatellite,
                timeLimitHours: editingSatellite.timeLimitHours || 24,
            });
            setEditingSatelliteImageDataUrl(editingSatellite.imageUrl);
        } else {
            editForm.reset();
            setEditingSatelliteImageDataUrl(null);
        }
    }, [editingSatellite, editForm]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>, formType: 'add' | 'edit') => {
        const file = event.target.files?.[0];
        if (!file) {
            if (formType === 'edit') {
                 setEditingSatelliteImageDataUrl(editingSatellite?.imageUrl || null);
            } else {
                setSatelliteImageDataUrl(null);
            }
            return;
        }

        if (!file.type.startsWith('image/')) {
            toast({
                variant: "destructive",
                title: "Archivo inválido",
                description: "Por favor, selecciona un archivo de imagen.",
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
             if (formType === 'add') {
                setSatelliteImageDataUrl(reader.result as string);
            } else {
                setEditingSatelliteImageDataUrl(reader.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const onAddSubmit = async (values: z.infer<typeof satelliteSchema>) => {
        try {
            const newSatelliteData: Omit<Satellite, 'id'> = {
                name: values.name,
                price: values.price,
                dailyYield: values.dailyYield,
                purchaseLimit: values.purchaseLimit,
                durationDays: values.durationDays,
                imageUrl: satelliteImageDataUrl || "https://placehold.co/600x400.png",
                isTimeLimited: values.isTimeLimited,
                createdAt: new Date(),
            };

            if (values.isTimeLimited) {
                newSatelliteData.timeLimitHours = values.timeLimitHours;
                newSatelliteData.timeLimitSetAt = new Date();
            }
            
            await addDoc(collection(db, "satellites"), {
                ...newSatelliteData,
                createdAt: Timestamp.fromDate(newSatelliteData.createdAt),
                ...(newSatelliteData.timeLimitSetAt && { timeLimitSetAt: Timestamp.fromDate(newSatelliteData.timeLimitSetAt) })
            });

            toast({ title: "Plataforma Creada", description: `La plataforma "${values.name}" ha sido añadida.` });
            addForm.reset();
            setSatelliteImageDataUrl(null);
            const fileInput = document.getElementById('satellite-image-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
        } catch (error) {
            console.error("Error adding satellite: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo crear la plataforma." });
        }
    };

    const onEditSubmit = async (values: z.infer<typeof satelliteSchema>) => {
        if (!editingSatellite) return;

        try {
            const satelliteDocRef = doc(db, "satellites", editingSatellite.id);
            
            const dataToUpdate: Partial<Satellite> = {
                ...values,
                imageUrl: editingSatelliteImageDataUrl || editingSatellite.imageUrl,
            };

            if (values.isTimeLimited) {
                 dataToUpdate.timeLimitSetAt = new Date();
            } else {
                dataToUpdate.timeLimitHours = undefined;
                dataToUpdate.timeLimitSetAt = undefined;
            }

            const firestoreUpdateData: any = { ...dataToUpdate };
            if (dataToUpdate.timeLimitSetAt) {
                firestoreUpdateData.timeLimitSetAt = Timestamp.fromDate(dataToUpdate.timeLimitSetAt);
            } else {
                 firestoreUpdateData.timeLimitSetAt = null;
            }


            await updateDoc(satelliteDocRef, firestoreUpdateData);
            toast({ title: "Plataforma Actualizada" });
            setEditingSatellite(null);
        } catch (error) {
            console.error("Error updating satellite: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo actualizar la plataforma." });
        }
    };

    const handleDelete = async (satelliteId: string) => {
        try {
            await deleteDoc(doc(db, "satellites", satelliteId));
            toast({ title: "Plataforma Eliminada" });
        } catch (error) {
            console.error("Error deleting satellite: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar la plataforma." });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Añadir Nueva Plataforma</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...addForm}>
                        <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start">
                                <FormField control={addForm.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre de la Plataforma</FormLabel><FormControl><Input placeholder="Plataforma de Minería Básica" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={addForm.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Precio (COP)</FormLabel><FormControl><Input type="number" placeholder="50000" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={addForm.control} name="dailyYield" render={({ field }) => (
                                    <FormItem><FormLabel>Rendimiento Diario (%)</FormLabel><FormControl><Input type="number" step="0.1" placeholder="1.5" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={addForm.control} name="purchaseLimit" render={({ field }) => (
                                    <FormItem><FormLabel>Límite de Compra por Usuario</FormLabel><FormControl><Input type="number" placeholder="3" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={addForm.control} name="durationDays" render={({ field }) => (
                                    <FormItem><FormLabel>Duración (Días)</FormLabel><FormControl><Input type="number" placeholder="30" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>

                             <FormField
                                control={addForm.control}
                                name="isTimeLimited"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                    <div className="space-y-0.5">
                                        <FormLabel>Oferta de Tiempo Limitado</FormLabel>
                                        <FormDescription>Activa un contador para esta plataforma.</FormDescription>
                                    </div>
                                    <FormControl>
                                        <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    </FormItem>
                                )}
                            />

                            {isTimeLimitedInAddForm && (
                                <FormField
                                    control={addForm.control}
                                    name="timeLimitHours"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duración de la Oferta (Horas)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="24" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}
                            
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="satellite-image-upload">Imagen de la Plataforma</Label>
                                    <Input id="satellite-image-upload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'add')} />
                                    <p className="text-xs text-muted-foreground">Sube una imagen para la plataforma. Si no se selecciona una, se usará una por defecto.</p>
                                </div>
                                {satelliteImageDataUrl && (
                                    <div className="space-y-2">
                                        <Label>Vista Previa</Label>
                                        <div className="border rounded-lg p-2 flex justify-center items-center bg-muted/50 w-full max-w-sm aspect-video relative">
                                            <Image
                                                src={satelliteImageDataUrl}
                                                alt="Vista previa de la plataforma"
                                                fill
                                                className="rounded-md object-contain"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Button type="submit" disabled={addForm.formState.isSubmitting}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Añadir Plataforma
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Plataformas Existentes</CardTitle>
                    <CardDescription>Lista de todas las plataformas de minería disponibles.</CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Precio</TableHead>
                                    <TableHead>Rendimiento</TableHead>
                                    <TableHead>Duración</TableHead>
                                    <TableHead>Límite</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {satellites.length > 0 ? (
                                    satellites.map((satellite) => (
                                        <TableRow key={satellite.id}>
                                            <TableCell className="font-medium">
                                                {satellite.name}
                                                {satellite.isTimeLimited && (
                                                    <Badge variant="secondary" className="ml-2">
                                                        <Clock className="mr-1 h-3 w-3" />
                                                        Limitado
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(satellite.price)}</TableCell>
                                            <TableCell>{satellite.dailyYield}%</TableCell>
                                            <TableCell>{satellite.durationDays} días</TableCell>
                                            <TableCell>{satellite.purchaseLimit}</TableCell>
                                            <TableCell className="text-right">
                                                 <Button variant="ghost" size="icon" onClick={() => setEditingSatellite(satellite)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                         <Button variant="ghost" size="icon">
                                                            <Trash2 className="h-4 w-4 text-red-500" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Esta acción no se puede deshacer. Esto eliminará permanentemente la plataforma.
                                                            </AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                        <AlertDialogFooter>
                                                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                            <AlertDialogAction onClick={() => handleDelete(satellite.id)} className="bg-destructive hover:bg-destructive/90">Eliminar</AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No hay plataformas creadas.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={!!editingSatellite} onOpenChange={(isOpen) => !isOpen && setEditingSatellite(null)}>
                <DialogContent className="sm:max-w-3xl">
                     <DialogHeader>
                        <DialogTitle>Editar Plataforma</DialogTitle>
                        <DialogDescriptionComponent>
                           Realiza cambios en la plataforma. Haz clic en guardar cuando termines.
                        </DialogDescriptionComponent>
                    </DialogHeader>
                    <Form {...editForm}>
                        <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4 py-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <FormField control={editForm.control} name="name" render={({ field }) => (
                                    <FormItem><FormLabel>Nombre de la Plataforma</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={editForm.control} name="price" render={({ field }) => (
                                    <FormItem><FormLabel>Precio (COP)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={editForm.control} name="dailyYield" render={({ field }) => (
                                    <FormItem><FormLabel>Rendimiento Diario (%)</FormLabel><FormControl><Input type="number" step="0.1" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={editForm.control} name="purchaseLimit" render={({ field }) => (
                                    <FormItem><FormLabel>Límite de Compra</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={editForm.control} name="durationDays" render={({ field }) => (
                                    <FormItem><FormLabel>Duración (Días)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                            
                             <FormField
                                control={editForm.control}
                                name="isTimeLimited"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel>Oferta de Tiempo Limitado</FormLabel>
                                            <FormDescription>Activa un contador para esta plataforma.</FormDescription>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {isTimeLimitedInEditForm && (
                                <FormField
                                    control={editForm.control}
                                    name="timeLimitHours"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Duración de la Oferta (Horas)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="24" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            )}

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="edit-satellite-image-upload">Imagen de la Plataforma</Label>
                                    <Input id="edit-satellite-image-upload" type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'edit')} />
                                </div>
                                {editingSatelliteImageDataUrl && (
                                    <div className="space-y-2">
                                        <Label>Vista Previa</Label>
                                        <div className="border rounded-lg p-2 flex justify-center items-center bg-muted/50 w-full max-w-sm aspect-video relative">
                                            <Image
                                                src={editingSatelliteImageDataUrl}
                                                alt="Vista previa de la plataforma"
                                                fill
                                                className="rounded-md object-contain"
                                                key={editingSatelliteImageDataUrl} 
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div>
                                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                                    Guardar Cambios
                                </Button>
                            </div>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

