
"use client";

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Save, Percent, Clock } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Slider } from "@/components/ui/slider";
import { Checkbox } from '@/components/ui/checkbox';
import type { WithdrawalSettings } from '@/lib/types';
import { useAuth } from '@/hooks/use-auth';

const formSchema = z.object({
    minWithdrawal: z.coerce.number().min(0, "El monto no puede ser negativo."),
    withdrawalFeePercentage: z.coerce.number().min(0, "El porcentaje no puede ser negativo.").max(100, "El porcentaje no puede ser mayor a 100."),
    dailyLimit: z.coerce.number().int().min(0, "El límite debe ser un número entero no negativo."),
    withdrawalTimes: z.array(z.number()).length(2),
    allowedWithdrawalDays: z.array(z.number()).min(1, "Debes seleccionar al menos un día."),
});

const dayOptions = [
    { id: 1, label: "Lunes" },
    { id: 2, label: "Martes" },
    { id: 3, label: "Miércoles" },
    { id: 4, label: "Jueves" },
    { id: 5, label: "Viernes" },
    { id: 6, label: "Sábado" },
    { id: 0, label: "Domingo" },
];

const defaultSettings: WithdrawalSettings = {
    minWithdrawal: 10000,
    dailyLimit: 1,
    withdrawalFeePercentage: 8,
    withdrawalStartTime: 10,
    withdrawalEndTime: 15,
    allowedWithdrawalDays: [1, 2, 3, 4, 5],
};


const WithdrawalSettingsForm = () => {
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            minWithdrawal: defaultSettings.minWithdrawal,
            withdrawalFeePercentage: defaultSettings.withdrawalFeePercentage,
            dailyLimit: defaultSettings.dailyLimit,
            withdrawalTimes: [defaultSettings.withdrawalStartTime, defaultSettings.withdrawalEndTime],
            allowedWithdrawalDays: defaultSettings.allowedWithdrawalDays,
        },
    });

    useEffect(() => {
        const fetchSettings = async () => {
            const configDocRef = doc(db, 'config', 'withdrawals');
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists()) {
                const settings = docSnap.data() as WithdrawalSettings;
                form.reset({
                    minWithdrawal: settings.minWithdrawal,
                    withdrawalFeePercentage: settings.withdrawalFeePercentage,
                    dailyLimit: settings.dailyLimit,
                    withdrawalTimes: [settings.withdrawalStartTime, settings.withdrawalEndTime],
                    allowedWithdrawalDays: settings.allowedWithdrawalDays,
                });
            }
        };
        if (user?.role === 'superadmin') {
            fetchSettings();
        }
    }, [form, user]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        try {
            const configDocRef = doc(db, 'config', 'withdrawals');
            const settingsToSave: WithdrawalSettings = {
                minWithdrawal: values.minWithdrawal,
                withdrawalFeePercentage: values.withdrawalFeePercentage,
                dailyLimit: values.dailyLimit,
                withdrawalStartTime: values.withdrawalTimes[0],
                withdrawalEndTime: values.withdrawalTimes[1],
                allowedWithdrawalDays: values.allowedWithdrawalDays,
            };
            await setDoc(configDocRef, settingsToSave, { merge: true });
            toast({
                title: "Ajustes Guardados",
                description: `La configuración de retiros ha sido actualizada.`,
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "No se pudo guardar la configuración.",
            });
            console.error("Error saving withdrawal settings:", error);
        }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajustes de Retiro</CardTitle>
                <CardDescription>
                    Define las reglas para las solicitudes de retiro de los usuarios.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <FormField control={form.control} name="minWithdrawal" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Monto Mínimo de Retiro</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="withdrawalFeePercentage" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Comisión por Retiro (%)</FormLabel>
                                     <FormControl>
                                        <div className="relative">
                                            <Input type="number" step="0.1" {...field} className="pl-8" />
                                            <Percent className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <FormField control={form.control} name="dailyLimit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Límite de Retiros por Día</FormLabel>
                                    <FormControl><Input type="number" {...field} /></FormControl>
                                    <FormDescription>Número máximo de solicitudes que un usuario puede hacer por día.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                        
                         <FormField control={form.control} name="withdrawalTimes" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Horario de Retiros</FormLabel>
                                <div className="flex items-center gap-4">
                                     <Clock className="h-5 w-5 text-muted-foreground" />
                                     <span className="font-mono text-lg">{String(field.value[0]).padStart(2, '0')}:00</span>
                                     <FormControl>
                                         <Slider
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            max={23}
                                            min={0}
                                            step={1}
                                            className="w-full"
                                        />
                                    </FormControl>
                                    <span className="font-mono text-lg">{String(field.value[1]).padStart(2, '0')}:00</span>
                                </div>
                                <FormDescription>Arrastra los selectores para definir el rango de horas permitido.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />

                         <FormField
                            control={form.control}
                            name="allowedWithdrawalDays"
                            render={() => (
                                <FormItem>
                                <div className="mb-4">
                                    <FormLabel className="text-base">Días de Retiro Permitidos</FormLabel>
                                    <FormDescription>
                                        Selecciona los días de la semana en que los usuarios podrán solicitar retiros.
                                    </FormDescription>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                    {dayOptions.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="allowedWithdrawalDays"
                                            render={({ field }) => {
                                                return (
                                                <FormItem
                                                    key={item.id}
                                                    className="flex flex-row items-start space-x-3 space-y-0"
                                                >
                                                    <FormControl>
                                                    <Checkbox
                                                        checked={field.value?.includes(item.id)}
                                                        onCheckedChange={(checked) => {
                                                        return checked
                                                            ? field.onChange([...field.value, item.id])
                                                            : field.onChange(
                                                                field.value?.filter(
                                                                (value) => value !== item.id
                                                                )
                                                            )
                                                        }}
                                                    />
                                                    </FormControl>
                                                    <FormLabel className="font-normal">
                                                    {item.label}
                                                    </FormLabel>
                                                </FormItem>
                                                )
                                            }}
                                            />
                                        ))}
                                </div>
                                <FormMessage />
                                </FormItem>
                            )}
                        />


                        <Button type="submit" disabled={form.formState.isSubmitting}>
                            <Save className="mr-2 h-4 w-4" />
                            Guardar Ajustes
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export default WithdrawalSettingsForm;
