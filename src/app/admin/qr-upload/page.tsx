

"use client";

import { useState, useEffect, ChangeEvent } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from '@/components/ui/skeleton';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, Timestamp, collection, addDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { QrCodeUpdateLog } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import RechargeAmountsForm from '@/components/admin/recharge-amounts-form';


const QR_CONFIG_DOC_ID = 'qrCode';
const DEFAULT_QR_URL = "https://placehold.co/300x300.png";

interface QrUpdateInfo {
    userId: string;
    phoneNumber: string;
    timestamp: Date;
}

const QrUploadPage = () => {
    const [qrUrl, setQrUrl] = useState<string | null>(null);
    const [newQrDataUrl, setNewQrDataUrl] = useState<string | null>(null);
    const [lastUpdateInfo, setLastUpdateInfo] = useState<QrUpdateInfo | null>(null);
    const [history, setHistory] = useState<QrCodeUpdateLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const router = useRouter();
    const { user: adminUser } = useAuth();

    useEffect(() => {
        if (adminUser && adminUser.role !== 'superadmin') {
            router.push('/admin');
        }
    }, [adminUser, router]);

    useEffect(() => {
        const fetchQrUrl = async () => {
            setIsLoading(true);
            try {
                const docRef = doc(db, 'config', QR_CONFIG_DOC_ID);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setQrUrl(data.url || DEFAULT_QR_URL);
                    if (data.updatedBy && data.updatedBy.timestamp) {
                        setLastUpdateInfo({
                            ...data.updatedBy,
                            timestamp: (data.updatedBy.timestamp as Timestamp).toDate(),
                        });
                    }
                } else {
                    setQrUrl(DEFAULT_QR_URL);
                }
            } catch (error) {
                console.error("Error fetching QR code:", error);
                setQrUrl(DEFAULT_QR_URL);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQrUrl();

        const historyQuery = query(collection(db, "qrCodeHistory"), orderBy("timestamp", "desc"));
        const unsubscribe = onSnapshot(historyQuery, (snapshot) => {
            const historyData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    url: data.url,
                    updatedBy: data.updatedBy,
                    timestamp: (data.timestamp as Timestamp).toDate(),
                } as QrCodeUpdateLog
            });
            setHistory(historyData);
        });

        return () => unsubscribe();
    }, []);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

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
            const dataUrl = reader.result as string;
            setNewQrDataUrl(dataUrl);
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        if (!newQrDataUrl || !adminUser) return;
        setIsSaving(true);
        const timestamp = Timestamp.now();
        try {
            const updateInfoPayload = {
                userId: adminUser.id,
                phoneNumber: adminUser.phoneNumber,
            };

            // 1. Create a log in the history collection
            const historyLog = {
                url: newQrDataUrl,
                updatedBy: updateInfoPayload,
                timestamp: timestamp
            };
            await addDoc(collection(db, 'qrCodeHistory'), historyLog);

            // 2. Update the main config document
            const docRef = doc(db, 'config', QR_CONFIG_DOC_ID);
            const updateData = {
                url: newQrDataUrl,
                updatedBy: {
                    ...updateInfoPayload,
                    timestamp: timestamp
                }
            };
            await setDoc(docRef, updateData, { merge: true });

            // 3. Update local state
            setQrUrl(newQrDataUrl);
            setLastUpdateInfo({
                ...updateInfoPayload,
                timestamp: timestamp.toDate()
            });
            setNewQrDataUrl(null); // Clear the pending change
            toast({ title: "Imagen Guardada", description: "El nuevo código QR ha sido guardado y el historial ha sido actualizado." });
        } catch (error) {
            console.error("Error saving QR code:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo guardar el nuevo código QR." });
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-4xl space-y-8">
                <div className="flex justify-between items-center">
                    <CardTitle>Configuración de Recargas</CardTitle>
                    <Button variant="outline" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                </div>
                
                <RechargeAmountsForm />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Cambiar Imagen del QR</CardTitle>
                                <CardDescription>Sube una nueva imagen del código QR para los pagos. El cambio se guardará en la base de datos y será visible para todos los usuarios.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="qr-upload">Subir nueva imagen QR</Label>
                                    <Input id="qr-upload" type="file" accept="image/*" onChange={handleFileChange} disabled={isSaving} />
                                </div>
                                
                                {newQrDataUrl && (
                                    <Card className="border-primary">
                                        <CardHeader>
                                            <CardTitle>Vista Previa del Nuevo QR</CardTitle>
                                        </CardHeader>
                                        <CardContent className="flex flex-col items-center gap-4">
                                            <Image
                                                src={newQrDataUrl}
                                                width={250}
                                                height={250}
                                                alt="Vista previa del nuevo código QR"
                                                className="rounded-lg"
                                                data-ai-hint="qr code"
                                            />
                                            <Button onClick={handleSave} disabled={isSaving || !adminUser}>
                                                {isSaving ? "Guardando..." : "Guardar Nuevo QR"}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                )}
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader>
                                <CardTitle>QR Actual en el Sistema</CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col items-center justify-center bg-muted/50 rounded-lg p-4">
                                {isLoading ? (
                                    <Skeleton className="h-[250px] w-[250px]" />
                                ) : (
                                    <Image
                                        src={qrUrl || DEFAULT_QR_URL}
                                        width={250}
                                        height={250}
                                        alt="Vista previa del código QR actual"
                                        className="rounded-lg"
                                        data-ai-hint="qr code"
                                        key={qrUrl}
                                    />
                                )}
                                {lastUpdateInfo && (
                                     <div className="mt-4 text-sm text-muted-foreground border-t w-full pt-4 space-y-2">
                                         <h5 className="font-semibold text-center text-foreground">Última Actualización</h5>
                                         <div className="flex items-center gap-2">
                                             <User className="h-4 w-4" />
                                             <span>Admin: {lastUpdateInfo.phoneNumber}</span>
                                         </div>
                                         <div className="flex items-center gap-2">
                                             <Calendar className="h-4 w-4" />
                                             <span>Fecha: {lastUpdateInfo.timestamp.toLocaleString('es-CO')}</span>
                                         </div>
                                     </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="lg:col-span-1">
                        <CardHeader>
                            <CardTitle>Historial de Cambios</CardTitle>
                            <CardDescription>Aquí puedes ver todos los códigos QR que se han subido.</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="border rounded-lg max-h-[60vh] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Fecha</TableHead>
                                            <TableHead>Admin</TableHead>
                                            <TableHead>Imagen</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.length > 0 ? (
                                            history.map((log) => (
                                                <TableRow key={log.id}>
                                                    <TableCell className="text-xs">{log.timestamp.toLocaleString('es-CO')}</TableCell>
                                                    <TableCell className="text-xs">{log.updatedBy.phoneNumber}</TableCell>
                                                    <TableCell>
                                                        <Image src={log.url} alt="QR Histórico" width={40} height={40} className="rounded-md" />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                                                    No hay historial de cambios.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </main>
    );
}

export default QrUploadPage;
