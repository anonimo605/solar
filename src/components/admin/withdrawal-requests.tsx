

"use client";

import { useState, useEffect } from 'react';
import type { WithdrawalRequest, User, Transaction } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, runTransaction, Timestamp, updateDoc, getDoc, orderBy } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { createTransaction } from '@/services/transactionService';
import { useAuth } from '@/hooks/use-auth';

const WithdrawalRequests = () => {
    const [loading, setLoading] = useState(true);
    const [pendingRequests, setPendingRequests] = useState<WithdrawalRequest[]>([]);
    const [approvedRequests, setApprovedRequests] = useState<WithdrawalRequest[]>([]);
    const [rejectedRequests, setRejectedRequests] = useState<WithdrawalRequest[]>([]);
    const [withdrawalFeePercentage, setWithdrawalFeePercentage] = useState(0.08); // Default 8%
    const { toast } = useToast();
    const { user } = useAuth();


    useEffect(() => {
        if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
            setLoading(false);
            return;
        }
        
        setLoading(true);

        const fetchSettings = async () => {
            const configDocRef = doc(db, 'config', 'withdrawals');
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists() && docSnap.data().withdrawalFeePercentage) {
                setWithdrawalFeePercentage(docSnap.data().withdrawalFeePercentage / 100);
            }
        };
        fetchSettings();

        const q = query(collection(db, 'withdrawalRequests'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allRequests = snapshot.docs.map(doc => {
                const data = doc.data();
                return { 
                    ...doc.data(), 
                    id: doc.id, 
                    requestedAt: (data.requestedAt as Timestamp).toDate(),
                    processedAt: data.processedAt ? (data.processedAt as Timestamp).toDate() : undefined
                } as WithdrawalRequest
            });

            const pending = allRequests
                .filter(r => r.status === 'pending')
                .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());

            const approved = allRequests
                .filter(r => r.status === 'approved')
                .sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));

            const rejected = allRequests
                .filter(r => r.status === 'rejected')
                .sort((a, b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0));

            setPendingRequests(pending);
            setApprovedRequests(approved);
            setRejectedRequests(rejected);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching withdrawals:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleAction = async (requestId: string, action: 'approve' | 'reject') => {
        if (!user) return;
        const requestToProcess = pendingRequests.find(r => r.id === requestId);
        if (!requestToProcess) {
            toast({ variant: "destructive", title: "Error", description: "No se encontró la solicitud." });
            return;
        }

        const adminInfo = {
            adminId: user.id,
            adminPhone: user.phoneNumber
        };

        try {
            if (action === 'approve') {
                const requestDocRef = doc(db, "withdrawalRequests", requestId);
                await updateDoc(requestDocRef, {
                    status: 'approved',
                    processedAt: Timestamp.now(),
                    processedBy: adminInfo,
                });
                toast({
                    title: `Retiro Aprobado`,
                    description: `La solicitud para ${requestToProcess.userPhone} ha sido marcada como aprobada.`,
                });
            } else { // 'reject'
                await runTransaction(db, async (transactionRunner) => {
                    const requestDocRef = doc(db, "withdrawalRequests", requestId);
                    const userDocRef = doc(db, "users", requestToProcess.userId);
                    
                    const requestDoc = await transactionRunner.get(requestDocRef);
                    const userDoc = await transactionRunner.get(userDocRef);

                    if (!requestDoc.exists() || requestDoc.data().status !== 'pending') {
                        throw new Error("La solicitud ya fue procesada.");
                    }

                    if (!userDoc.exists()) {
                         // If user doesn't exist, we can't refund, but we can still reject the request.
                        transactionRunner.update(requestDocRef, { status: 'rejected', processedAt: Timestamp.now(), processedBy: adminInfo });
                        throw new Error("Usuario no encontrado, no se pudo reembolsar el saldo.");
                    }

                    const userData = userDoc.data() as User;
                    const newBalance = userData.balance + requestToProcess.amount;

                    // Update user's balance
                    transactionRunner.update(userDocRef, {
                        balance: newBalance,
                        version: (userData.version || 0) + 1
                    });

                    // Update the request status
                    transactionRunner.update(requestDocRef, {
                        status: 'rejected',
                        processedAt: Timestamp.now(),
                        processedBy: adminInfo,
                    });
                     // Create transaction record after the atomic operation succeeds
                    await createTransaction({
                        userId: requestToProcess.userId,
                        type: 'credit',
                        amount: requestToProcess.amount,
                        description: `Reembolso por retiro rechazado`,
                    });
                });

                 toast({
                    title: `Retiro Rechazado`,
                    description: `El saldo de ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(requestToProcess.amount)} ha sido devuelto a ${requestToProcess.userPhone}.`,
                });
            }
        } catch (error: any) {
             toast({
                variant: "destructive",
                title: "Error al procesar",
                description: error.message || "No se pudo completar la operación.",
            });
        }
    };
    
    if (loading) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Solicitudes de Retiro Pendientes</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>Cargando solicitudes...</p>
                </CardContent>
            </Card>
        )
    }


    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Solicitudes de Retiro Pendientes</CardTitle>
                    <CardDescription>
                        Envía el dinero a la cuenta Nequi indicada (el monto neto a pagar). Una vez completado, aprueba la solicitud. Si la rechazas, el saldo se devolverá al usuario.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Teléfono Usuario</TableHead>
                                    <TableHead>Datos del Destinatario</TableHead>
                                    <TableHead className="text-right">Monto Solicitado</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {pendingRequests.length > 0 ? (
                                    pendingRequests.map((req) => (
                                        <TableRow key={req.id}>
                                            <TableCell>{new Date(req.requestedAt).toLocaleString('es-CO')}</TableCell>
                                            <TableCell>{req.userPhone}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{req.fullName}</div>
                                                <div className="text-sm text-muted-foreground">C.C. {req.idNumber}</div>
                                                <div className="text-sm text-muted-foreground font-mono">Nequi: {req.nequiAccount}</div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="font-semibold">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(req.amount)}</div>
                                                <div className="text-xs text-primary font-bold">Neto a pagar: {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(req.amount * (1 - withdrawalFeePercentage))}</div>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="outline" size="sm" onClick={() => handleAction(req.id, 'approve')}>
                                                    <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                                                    Aprobar
                                                </Button>
                                                <Button variant="outline" size="sm" onClick={() => handleAction(req.id, 'reject')}>
                                                    <XCircle className="mr-2 h-4 w-4 text-red-500" />
                                                    Rechazar
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                            No hay solicitudes de retiro pendientes.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Historial de Retiros Procesados</CardTitle>
                    <CardDescription>
                        Lista de todos los retiros que han sido aprobados o rechazados.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha Procesado</TableHead>
                                    <TableHead>Teléfono Usuario</TableHead>
                                    <TableHead>Datos del Destinatario</TableHead>
                                    <TableHead>Monto</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Procesado por</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {[...approvedRequests, ...rejectedRequests].sort((a,b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0)).length > 0 ? (
                                    [...approvedRequests, ...rejectedRequests].sort((a,b) => (b.processedAt?.getTime() || 0) - (a.processedAt?.getTime() || 0)).map((req) => (
                                        <TableRow key={req.id}>
                                            <TableCell>{req.processedAt ? new Date(req.processedAt).toLocaleString('es-CO') : 'N/A'}</TableCell>
                                            <TableCell>{req.userPhone}</TableCell>
                                            <TableCell>
                                                <div className="font-medium">{req.fullName}</div>
                                                <div className="text-sm text-muted-foreground font-mono">Nequi: {req.nequiAccount}</div>
                                            </TableCell>
                                            <TableCell className="font-semibold">
                                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(req.amount)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={req.status === 'approved' ? 'default' : 'destructive'}>{req.status === 'approved' ? "Aprobado" : "Rechazado"}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">{req.processedBy?.adminPhone || 'N/A'}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            No hay retiros procesados.
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
export default WithdrawalRequests;
