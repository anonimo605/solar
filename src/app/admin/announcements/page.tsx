
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';


const announcementFormSchema = z.object({
    title: z.string().min(1, "El título es requerido.").max(100, "El título no puede tener más de 100 caracteres."),
    message: z.string().min(1, "El mensaje es requerido.").max(500, "El mensaje no puede tener más de 500 caracteres."),
    active: z.boolean().default(false),
});

export default function AnnouncementsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useAuth();

    const form = useForm<z.infer<typeof announcementFormSchema>>({
        resolver: zodResolver(announcementFormSchema),
        defaultValues: {
            title: '',
            message: '',
            active: false,
        },
    });

    useEffect(() => {
        if (user && user.role !== 'superadmin') {
            router.push('/admin');
        }

        const fetchAnnouncement = async () => {
             const docRef = doc(db, 'config', 'announcement');
             const docSnap = await getDoc(docRef);
             if (docSnap.exists()) {
                 form.reset(docSnap.data());
             }
        }
        if (user?.role === 'superadmin') {
            fetchAnnouncement();
        }
    }, [form, user, router]);


    const onSubmit = async (values: z.infer<typeof announcementFormSchema>) => {
        try {
            const docRef = doc(db, 'config', 'announcement');
            await setDoc(docRef, values, { merge: true });
            toast({
                title: "Anuncio Guardado",
                description: "La configuración del anuncio global ha sido actualizada.",
            });
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error al Guardar",
                description: "No se pudo guardar la configuración del anuncio.",
            });
            console.error("Error saving announcement:", error);
        }
    };

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-4xl space-y-8">
                 <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Gestionar Anuncio Global</h1>
                    <Button variant="outline" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Button>
                </div>
                 <Card>
                    <CardHeader>
                        <CardTitle>Configurar Anuncio Global</CardTitle>
                        <CardDescription>
                            Este mensaje aparecerá en el panel de todos los usuarios. Usa el interruptor para activarlo o desactivarlo.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                 <FormField
                                    control={form.control}
                                    name="active"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                                        <div className="space-y-0.5">
                                            <FormLabel>Mostrar Anuncio</FormLabel>
                                            <FormDescription>
                                                Activa este interruptor para que el anuncio sea visible para los usuarios.
                                            </FormDescription>
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
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Título del Anuncio</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ej: Mantenimiento programado" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="message"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Contenido del Anuncio</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Escribe tu mensaje aquí..."
                                                    className="min-h-[100px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                               
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                    <Save className="mr-2 h-4 w-4" />
                                    Guardar Anuncio
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </main>
    )
}
