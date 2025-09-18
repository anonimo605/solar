
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { Transaction } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, orderBy, Timestamp } from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function TransactionsPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    useEffect(() => {
        if (user && !loading) {
            const transQuery = query(
                collection(db, "transactions"), 
                where("userId", "==", user.id)
                // orderBy("date", "desc") // This requires a composite index, sorting client-side instead.
            );

            const unsubscribe = onSnapshot(transQuery, (snapshot) => {
                const transData = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        date: (data.date as Timestamp).toDate(),
                    } as Transaction;
                });
                // Sort transactions by date in descending order on the client side
                transData.sort((a, b) => b.date.getTime() - a.date.getTime());
                setTransactions(transData);
            });

            return () => unsubscribe();
        }
    }, [user, loading]);

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background">
                <p>Cargando historial...</p>
            </main>
        );
    }
    
    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-4xl space-y-8">
                <div className="flex justify-between items-center">
                    <Button variant="outline" onClick={() => router.push('/dashboard')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Button>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Historial de Transacciones</CardTitle>
                        <CardDescription>Aquí puedes ver todos los movimientos de tu saldo.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Descripción</TableHead>
                                        <TableHead className="text-right">Monto</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {transactions.length > 0 ? (
                                        transactions.map((t) => (
                                            <TableRow key={t.id}>
                                                <TableCell>{t.date.toLocaleString('es-CO')}</TableCell>
                                                <TableCell>{t.description}</TableCell>
                                                <TableCell className={cn(
                                                    "text-right font-semibold",
                                                    t.type === 'credit' ? 'text-green-600' : 'text-red-600'
                                                )}>
                                                    {t.type === 'credit' ? '+' : '-'}
                                                    {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(t.amount)}
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center text-muted-foreground py-16">
                                                No tienes transacciones todavía.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </main>
    );
}
