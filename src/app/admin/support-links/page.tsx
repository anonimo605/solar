
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';


const supportLinksFormSchema = z.object({
    whatsappContactUrl: z.string().url("Debe ser una URL válida (ej. https://wa.me/...).").or(z.literal('')),
    whatsappGroupUrl: z.string().url("Debe ser una URL válida (ej. https://chat.whatsapp.com/...).").or(z.literal('')),
    telegramGroupUrl: z.string().url("Debe ser una URL válida (ej. https://t.me/...).").or(z.literal('')),
});

export default function SupportLinksPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof supportLinksFormSchema>>({
        resolver: zodResolver(supportLinksFormSchema),
        defaultValues: {
            whatsappContactUrl: '',
            whatsappGroupUrl: '',
            telegramGroupUrl: '',
        },
    });

    useEffect(() => {
        if (user && user.role !== 'superadmin') {
            router.push('/admin');
        }
        
        const fetchSupportLinks = async () => {
             const docRef = doc(db, 'config', 'supportLinks');
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
                 form.reset(docSnap.data());
             }
        }
        if (user?.role === 'superadmin') {
            fetchSupportLinks();
        }
    }, [form, user, router]);


    const onSubmit = async (values: z.infer<typeof supportLinksFormSchema>) => {
        try {
            const docRef = doc(db, 'config', 'supportLinks');
            await setDoc(docRef, values, { merge: true });
            toast({
                title: "Enlaces Guardados",
                description: "La configuración de los enlaces de soporte ha sido actualizada.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "No se pudo guardar la configuración de los enlaces.",
            });
            console.error("Error saving support links:", error);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-4xl space-y-8">
                 <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Gestionar Enlaces de Soporte</h1>
                    <Button variant="outline" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Button>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Configurar Enlaces de Soporte</CardTitle>
                        <CardDescription>
                            Estos enlaces aparecerán en el panel de los usuarios para que puedan contactarte. Si dejas un campo vacío, el botón correspondiente no se mostrará.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="whatsappContactUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL del Contacto de WhatsApp</FormLabel>
                                             <FormDescription>
                                                Ejemplo: https://wa.me/573001234567
                                            </FormDescription>
                                            <FormControl>
                                                <Input placeholder="https://wa.me/..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="whatsappGroupUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL del Grupo de WhatsApp</FormLabel>
                                            <FormDescription>
                                                Ejemplo: https://chat.whatsapp.com/ABC123XYZ
                                            </FormDescription>
                                            <FormControl>
                                                <Input
                                                    placeholder="https://chat.whatsapp.com/..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="telegramGroupUrl"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>URL del Grupo de Telegram</FormLabel>
                                            <FormDescription>
                                                Ejemplo: https://t.me/MyTelegramGroup
                                            </FormDescription>
                                            <FormControl>
                                                <Input
                                                    placeholder="https://t.me/..."
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                               
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Guardar Enlaces
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
