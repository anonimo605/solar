
"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Save, Percent, Gift } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';


const DEFAULT_PERCENTAGE = 10;
const DEFAULT_BONUS = 5000;

const formSchema = z.object({
    percentage: z.coerce.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede ser mayor a 100."),
    registrationBonus: z.coerce.number().min(0, "El bono de registro no puede ser negativo."),
});

const ReferralSettingsForm = () => {
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            percentage: DEFAULT_PERCENTAGE,
            registrationBonus: DEFAULT_BONUS,
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const configDocRef = doc(db, 'config', 'referrals');
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                form.setValue('percentage', data.commissionPercentage ?? DEFAULT_PERCENTAGE);
                form.setValue('registrationBonus', data.registrationBonus ?? DEFAULT_BONUS);
            }
        };
        if (user?.role === 'superadmin') {
            fetchSettings();
        }
    }, [form, user]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const configDocRef = doc(db, 'config', 'referrals');
            await setDoc(configDocRef, { 
                commissionPercentage: values.percentage,
                registrationBonus: values.registrationBonus,
             }, { merge: true });
            toast({
                title: "Configuración Guardada",
                description: `La configuración de referidos ha sido actualizada.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "No se pudo guardar la configuración.",
            });
            console.error("Error saving referral settings:", error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Configuración de Referidos y Bonos</CardTitle>
                <CardDescription>
                    Define las comisiones por referido y el bono que reciben los nuevos usuarios al registrarse.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="percentage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Porcentaje de Comisión</FormLabel>
                                        <FormDescription>
                                            Porcentaje de la primera recarga de un referido que se pagará como comisión.
                                        </FormDescription>
                                        <FormControl>
                                            <div className="relative">
                                                <Input type="number" step="0.1" placeholder="10" {...field} className="pl-8" />
                                                <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="registrationBonus"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Bono de Registro (COP)</FormLabel>
                                        <FormDescription>
                                            Cantidad de saldo que recibe un usuario nuevo al registrarse en la plataforma.
                                        </FormDescription>
                                        <FormControl>
                                            <div className="relative">
                                                <Input type="number" step="100" placeholder="5000" {...field} className="pl-8" />
                                                <Gift className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Configuración
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default ReferralSettingsForm;
