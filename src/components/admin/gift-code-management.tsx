
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { GiftCode } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PlusCircle, Trash2, Copy } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

const giftCodeSchema = z.object({
    amount: z.coerce.number().positive("El monto debe ser un número positivo."),
    usageLimit: z.coerce.number().int().positive("El límite de usos debe ser un entero positivo."),
    expiresInMinutes: z.coerce.number().int().positive("La duración en minutos debe ser un entero positivo."),
});


const GiftCodeManagement = () => {
    const { user } = useAuth();
    const [codes, setCodes] = useState<GiftCode[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        if (user?.role !== 'superadmin') {
            setLoading(false);
            return;
        }
        const q = query(collection(db, 'giftCodes'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const codesData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: (data.createdAt as Timestamp).toDate(),
                } as GiftCode;
            });
            setCodes(codesData);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching gift codes:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudieron cargar los códigos." });
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user, toast]);

    const form = useForm<z.infer<typeof giftCodeSchema>>({
        resolver: zodResolver(giftCodeSchema),
        defaultValues: {
            amount: 1000,
            usageLimit: 1,
            expiresInMinutes: 60,
        },
    });

    const generateCode = () => `SY-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
        toast({ title: "Copiado", description: "Código copiado al portapapeles." });
    };

    const onSubmit = async (values: z.infer<typeof giftCodeSchema>) => {
        const newCodeData: Omit<GiftCode, 'id'> = {
            code: generateCode(),
            amount: values.amount,
            usageLimit: values.usageLimit,
            expiresInMinutes: values.expiresInMinutes,
            createdAt: new Date(),
            redeemedBy: [],
        };

        try {
            await addDoc(collection(db, 'giftCodes'), {
                ...newCodeData,
                createdAt: Timestamp.fromDate(newCodeData.createdAt)
            });
            toast({ title: "Código Creado", description: `Se ha creado el código "${newCodeData.code}".` });
            form.reset();
        } catch (error) {
            console.error("Error creating gift code: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo crear el código." });
        }
    };

    const handleDelete = async (codeId: string) => {
        try {
            await deleteDoc(doc(db, 'giftCodes', codeId));
            toast({ title: "Código Eliminado" });
        } catch (error) {
            console.error("Error deleting gift code: ", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo eliminar el código." });
        }
    };

    const getCodeStatus = (code: GiftCode): { text: string; variant: "default" | "secondary" | "destructive" } => {
        const now = new Date();
        const expirationDate = new Date(new Date(code.createdAt).getTime() + code.expiresInMinutes * 60 * 1000);
        
        if (now > expirationDate) {
            return { text: "Expirado", variant: "destructive" };
        }
        if (code.redeemedBy.length >= code.usageLimit) {
            return { text: "Agotado", variant: "secondary" };
        }
        return { text: "Activo", variant: "default" };
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Crear Código de Regalo</CardTitle>
                    <CardDescription>Genera un nuevo código para que los usuarios canjeen por saldo.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                            <FormField control={form.control} name="amount" render={({ field }) => (
                                <FormItem><FormLabel>Monto (COP)</FormLabel><FormControl><Input type="number" placeholder="5000" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="usageLimit" render={({ field }) => (
                                <FormItem><FormLabel>Límite de Usos</FormLabel><FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="expiresInMinutes" render={({ field }) => (
                                <FormItem><FormLabel>Duración (Minutos)</FormLabel><FormControl><Input type="number" placeholder="60" {...field} /></FormControl><FormMessage /></FormItem>
                            )} />
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Crear Código
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Códigos Existentes</CardTitle>
                    <CardDescription>Lista de todos los códigos de regalo generados.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Usos</TableHead>
                                    <TableHead>Creación</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            Cargando códigos...
                                        </TableCell>
                                    </TableRow>
                                ) : codes.length > 0 ? (
                                    codes.map((code) => {
                                        const status = getCodeStatus(code);
                                        return (
                                            <TableRow key={code.id}>
                                                <TableCell className="font-mono">{code.code}</TableCell>
                                                <TableCell>{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(code.amount)}</TableCell>
                                                <TableCell>{code.redeemedBy.length} / {code.usageLimit}</TableCell>
                                                <TableCell>{code.createdAt.toLocaleString('es-CO')}</TableCell>
                                                <TableCell><Badge variant={status.variant}>{status.text}</Badge></TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="icon" onClick={() => handleCopy(code.code)}><Copy className="h-4 w-4" /></Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDelete(code.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No hay códigos creados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default GiftCodeManagement;
