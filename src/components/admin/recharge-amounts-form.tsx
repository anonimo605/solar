
"use client";

import { useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save, DollarSign } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import type { RechargeSettings } from '@/lib/types';


const DEFAULT_AMOUNTS = [20000, 48000, 100000, 150000, 350000, 500000];

const formSchema = z.object({
  amounts: z.array(z.coerce.number().positive("El monto debe ser un número positivo.")).length(6, "Debe haber exactamente 6 montos."),
});

const RechargeAmountsForm = () => {
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amounts: DEFAULT_AMOUNTS,
        },
    });
    
    const { fields } = useFieldArray({
        control: form.control,
        name: "amounts",
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const configDocRef = doc(db, 'config', 'rechargeSettings');
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as RechargeSettings;
                if (data.suggestedAmounts && data.suggestedAmounts.length === 6) {
                    form.setValue('amounts', data.suggestedAmounts);
                }
            }
        };
        if (user?.role === 'superadmin') {
            fetchSettings();
        }
    }, [form, user]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const configDocRef = doc(db, 'config', 'rechargeSettings');
            await setDoc(configDocRef, { 
                suggestedAmounts: values.amounts
             }, { merge: true });
            toast({
                title: "Configuración Guardada",
                description: `Los montos de recarga sugeridos han sido actualizados.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "No se pudo guardar la configuración.",
            });
            console.error("Error saving recharge settings:", error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Montos de Recarga Sugeridos</CardTitle>
                <CardDescription>
                    Define los montos que aparecerán como botones de recarga rápida para los usuarios.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            {fields.map((field, index) => (
                                <FormField
                                    key={field.id}
                                    control={form.control}
                                    name={`amounts.${index}`}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Monto {index + 1}</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <Input type="number" step="1000" {...field} className="pl-8" />
                                                    <DollarSign className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Montos
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default RechargeAmountsForm;
