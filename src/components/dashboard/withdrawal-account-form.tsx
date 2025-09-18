
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { WithdrawalInfo } from "@/lib/types";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Save } from "lucide-react";
import { useEffect } from "react";

const formSchema = z.object({
  nequiAccount: z.string().length(10, "El número de Nequi debe tener 10 dígitos."),
  fullName: z.string().min(3, "El nombre completo es requerido."),
  idNumber: z.string().min(5, "El número de cédula es requerido."),
});

const WithdrawalAccountForm = () => {
    const { user, updateUser } = useAuth();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            nequiAccount: "",
            fullName: "",
            idNumber: "",
        },
    });

    useEffect(() => {
        if (user?.withdrawalInfo) {
            form.reset(user.withdrawalInfo);
        }
    }, [user, form]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user) return;
        
        try {
            await updateUser({ withdrawalInfo: values });
            toast({ title: "¡Cuenta guardada!", description: "Tu información de retiro ha sido actualizada." });
        } catch(error) {
             toast({ variant: "destructive", title: "Error", description: "No se pudo guardar tu información." });
             console.error(error);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Datos para Retiros</CardTitle>
                <CardDescription>
                    Ingresa y guarda la información de tu cuenta Nequi para poder solicitar retiros. Estos datos deben ser correctos para que podamos procesar tus pagos.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField control={form.control} name="nequiAccount" render={({ field }) => (
                            <FormItem><FormLabel>Número de Cuenta Nequi (Celular)</FormLabel><FormControl><Input type="tel" placeholder="3001234567" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="fullName" render={({ field }) => (
                            <FormItem><FormLabel>Nombre Completo del Titular</FormLabel><FormControl><Input placeholder="Juan Pérez" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                         <FormField control={form.control} name="idNumber" render={({ field }) => (
                            <FormItem><FormLabel>Número de Cédula del Titular</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        
                        <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting || !user}>
                           <Save className="mr-2 h-4 w-4" />
                           {form.formState.isSubmitting ? "Guardando..." : "Guardar Información"}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};
export default WithdrawalAccountForm;
