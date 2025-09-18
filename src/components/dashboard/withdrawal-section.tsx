
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { WithdrawalRequest, Transaction, WithdrawalSettings } from "@/lib/types";
import Link from "next/link";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, Timestamp, doc, getDoc, updateDoc, runTransaction } from "firebase/firestore";
import { createTransaction } from "@/services/transactionService";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Info, AlertCircle, UserCog, Clock, ShoppingCart, ShieldCheck, ShieldAlert, CalendarDays } from "lucide-react";

const getStatusVariant = (status: "approved" | "pending" | "rejected") => {
    switch (status) {
        case "approved": return "default";
        case "pending": return "secondary";
        case "rejected": return "destructive";
        default: return "outline";
    }
};

const defaultSettings: WithdrawalSettings = {
    minWithdrawal: 10000,
    dailyLimit: 1,
    withdrawalFeePercentage: 8,
    withdrawalStartTime: 10,
    withdrawalEndTime: 15,
    allowedWithdrawalDays: [1, 2, 3, 4, 5],
};

const dayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const WithdrawalSection = () => {
    const { user, purchasedEnergyPlants } = useAuth();
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
    const [isWithinWithdrawalWindow, setIsWithinWithdrawalWindow] = useState(false);
    const [isAllowedDay, setIsAllowedDay] = useState(false);
    const [settings, setSettings] = useState(defaultSettings);
    const [withdrawalsToday, setWithdrawalsToday] = useState(0);
    const { toast } = useToast();

    const formSchema = z.object({
        amount: z.coerce
            .number()
            .positive("El monto debe ser mayor que cero.")
            .min(settings.minWithdrawal, `El retiro mínimo es de ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(settings.minWithdrawal)}.`),
    });

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: settings.minWithdrawal,
        },
    });
     
    useEffect(() => {
        form.reset({ amount: settings.minWithdrawal });
    }, [settings.minWithdrawal, form]);


    const amountValue = form.watch('amount');
    const withdrawalFee = Math.floor((amountValue || 0) * (settings.withdrawalFeePercentage / 100));
    const amountToReceive = (amountValue || 0) - withdrawalFee;
    const hasPurchasedItems = purchasedEnergyPlants.length > 0;
    const hasReachedDailyLimit = withdrawalsToday >= settings.dailyLimit;


    useEffect(() => {
        const fetchSettings = async () => {
            const configDocRef = doc(db, "config", "withdrawals");
            const docSnap = await getDoc(configDocRef);
            if (docSnap.exists()) {
                 const newSettings: WithdrawalSettings = { ...defaultSettings, ...docSnap.data() };
                 setSettings(newSettings);
                 checkWithdrawalWindow(newSettings);
            } else {
                 checkWithdrawalWindow(defaultSettings);
            }
        };

        const checkWithdrawalWindow = (currentSettings: WithdrawalSettings) => {
            const now = new Date();
            const currentHour = now.getHours();
            const currentDay = now.getDay(); // 0 for Sunday, 1 for Monday, etc.
            const isTimeOk = currentHour >= currentSettings.withdrawalStartTime && currentHour < currentSettings.withdrawalEndTime;
            const isDayOk = currentSettings.allowedWithdrawalDays.includes(currentDay);
            setIsWithinWithdrawalWindow(isTimeOk);
            setIsAllowedDay(isDayOk);
        };

        fetchSettings();
        const intervalId = setInterval(() => fetchSettings(), 60000); // Re-check every minute

        return () => clearInterval(intervalId);
    }, []);

    useEffect(() => {
        if (!user) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const q = query(
            collection(db, "withdrawalRequests"),
            where("userId", "==", user.id)
        );

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const userWithdrawals: WithdrawalRequest[] = [];
             querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.requestedAt) { // Check if requestedAt is not null
                    userWithdrawals.push({
                        ...data,
                        id: doc.id,
                        requestedAt: (data.requestedAt as Timestamp).toDate(),
                    } as WithdrawalRequest);
                }
            });
            
            const sortedWithdrawals = userWithdrawals.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
            setWithdrawals(sortedWithdrawals);

            const todayCount = userWithdrawals.filter(w => new Date(w.requestedAt) >= today && (w.status === 'pending' || w.status === 'approved')).length;
            setWithdrawalsToday(todayCount);
        });

        return () => unsubscribe();
    }, [user]);

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user || !user.withdrawalInfo) {
            toast({ variant: "destructive", title: "Error", description: "Falta información de retiro." });
            return;
        };

        if (user.balance < values.amount) {
            toast({ variant: "destructive", title: "Saldo insuficiente." });
            return;
        }

        if(hasReachedDailyLimit) {
            toast({ variant: "destructive", title: "Límite alcanzado", description: `Ya has alcanzado el límite de ${settings.dailyLimit} retiro(s) por día.` });
            return;
        }

        const newRequest: Omit<WithdrawalRequest, 'id' | 'requestedAt'> = {
            userId: user.id,
            userPhone: user.phoneNumber,
            amount: values.amount,
            nequiAccount: user.withdrawalInfo.nequiAccount,
            fullName: user.withdrawalInfo.fullName,
            idNumber: user.withdrawalInfo.idNumber,
            status: 'pending',
        };

        const newTransaction: Omit<Transaction, 'id'> = {
            userId: user.id,
            type: 'debit',
            amount: values.amount,
            description: `Solicitud de retiro a Nequi`,
            date: new Date(),
        };

        try {
            await addDoc(collection(db, "withdrawalRequests"), {
                ...newRequest,
                requestedAt: serverTimestamp()
            });

            const userDocRef = doc(db, "users", user.id);
            await runTransaction(db, async (transactionRunner) => {
                const userDoc = await transactionRunner.get(userDocRef);
                if (!userDoc.exists()) {
                    throw "El usuario no existe.";
                }

                const newBalance = userDoc.data().balance - values.amount;
                if (newBalance < 0) {
                    throw "Saldo insuficiente.";
                }

                await createTransaction(newTransaction);
                
                transactionRunner.update(userDocRef, { 
                    balance: newBalance,
                    version: (userDoc.data().version || 0) + 1
                });
            });
            
            toast({ title: "Solicitud de retiro enviada." });
            form.reset();
        } catch (error) {
            console.error("Error creating withdrawal request:", error);
            toast({ variant: "destructive", title: "Error", description: "No se pudo enviar la solicitud de retiro." });
        }
    };

    const canWithdraw = user?.withdrawalInfo && hasPurchasedItems && isWithinWithdrawalWindow && !hasReachedDailyLimit && isAllowedDay;
    const allowedDaysString = settings.allowedWithdrawalDays.map(d => dayLabels[d]).join(', ');


    return (
        <Card>
            <CardHeader>
                <CardTitle>Retirar Saldo</CardTitle>
                <CardDescription>Solicita un retiro de tu saldo a tu cuenta Nequi guardada. Se aplicará una comisión del {settings.withdrawalFeePercentage}% sobre el monto retirado.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                 {!user?.withdrawalInfo ? (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Falta Información de Retiro</AlertTitle>
                        <AlertDescription>
                            Debes configurar tu cuenta de retiro antes de poder solicitar un pago.
                            <Button asChild variant="link" className="p-0 h-auto ml-1">
                                <Link href="/dashboard/cuenta-retiro">Haz clic aquí para configurarla.</Link>
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : (
                    <Card className="bg-muted/50">
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-lg">Tu Cuenta de Retiro</CardTitle>
                                <Button asChild variant="outline" size="sm">
                                    <Link href="/dashboard/cuenta-retiro">
                                        <UserCog className="mr-2 h-4 w-4" />
                                        Editar
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                            <div>
                                <p className="font-semibold">Cuenta Nequi</p>
                                <p className="font-mono">{user.withdrawalInfo.nequiAccount}</p>
                            </div>
                             <div>
                                <p className="font-semibold">Nombre Completo</p>
                                <p>{user.withdrawalInfo.fullName}</p>
                            </div>
                             <div>
                                <p className="font-semibold">Cédula</p>
                                <p>{user.withdrawalInfo.idNumber}</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                     <Alert variant={hasPurchasedItems ? "default" : "destructive"} className="border-l-4">
                        {hasPurchasedItems ? <ShoppingCart className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                        <AlertTitle>{hasPurchasedItems ? "Requisito cumplido" : "Requisito pendiente"}</AlertTitle>
                        <AlertDescription>
                            {hasPurchasedItems ? "Ya has comprado productos." : "Debes comprar al menos una planta de energía para retirar."}
                        </AlertDescription>
                    </Alert>

                     <Alert variant={!hasReachedDailyLimit ? "default" : "destructive"} className="border-l-4">
                        {!hasReachedDailyLimit ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                        <AlertTitle>{!hasReachedDailyLimit ? "Límite disponible" : "Límite alcanzado"}</AlertTitle>
                        <AlertDescription>
                             {`Retiros hoy: ${withdrawalsToday}/${settings.dailyLimit}.`}
                        </AlertDescription>
                    </Alert>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <Alert variant={isAllowedDay ? "default" : "destructive"} className="border-l-4">
                        <CalendarDays className="h-4 w-4" />
                        <AlertTitle>{isAllowedDay ? "Día habilitado" : "Día no habilitado"}</AlertTitle>
                        <AlertDescription>
                           {isAllowedDay ? "Hoy es un día permitido para retiros." : `Días permitidos: ${allowedDaysString}.`}
                        </AlertDescription>
                    </Alert>
                     <Alert variant={isWithinWithdrawalWindow ? "default" : "destructive"} className="border-l-4">
                         <Clock className="h-4 w-4" />
                        <AlertTitle>{isWithinWithdrawalWindow ? "En horario" : "Fuera de horario"}</AlertTitle>
                        <AlertDescription>
                           {isWithinWithdrawalWindow ? "El sistema de retiros está disponible." : `Disponible de ${settings.withdrawalStartTime}:00 a ${settings.withdrawalEndTime}:00.`}
                        </AlertDescription>
                    </Alert>
                 </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="p-4 border rounded-lg space-y-4">
                        <h3 className="font-semibold">Nueva solicitud de retiro</h3>
                         <FormField control={form.control} name="amount" render={({ field }) => (
                            <FormItem className="flex-grow">
                                <FormLabel>Monto a retirar (COP)</FormLabel>
                                <FormControl>
                                    <Input 
                                        type="number" 
                                        placeholder={settings.minWithdrawal.toString()} 
                                        {...field} 
                                        disabled={!canWithdraw || !user} 
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        
                        <div className="p-3 border rounded-lg bg-background text-sm space-y-1">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Comisión ({settings.withdrawalFeePercentage}%):</span>
                                <span className="font-medium">
                                    - {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(withdrawalFee)}
                                </span>
                            </div>
                            <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                                <span>Total a recibir:</span>
                                <span className="text-primary">
                                    {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(amountToReceive)}
                                </span>
                            </div>
                        </div>

                        <Alert>
                            <Info className="h-4 w-4" />
                            <AlertTitle>Importante</AlertTitle>
                            <AlertDescription>
                                El monto total solicitado se descontará de tu saldo. Recibirás el monto neto (menos la comisión) en tu cuenta Nequi.
                            </AlertDescription>
                        </Alert>
                        <Button type="submit" className="w-full sm:w-auto" disabled={form.formState.isSubmitting || !canWithdraw || !user}>
                           {form.formState.isSubmitting ? "Procesando..." : "Solicitar Retiro"}
                        </Button>
                    </form>
                </Form>

                <div>
                    <h3 className="font-semibold mb-4">Historial de Retiros</h3>
                    {/* Mobile View - Cards */}
                    <div className="md:hidden space-y-3">
                        {withdrawals.length > 0 ? (
                             withdrawals.map(w => (
                                <Card key={w.id} className="p-4">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <p className="font-bold text-lg">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(w.amount)}</p>
                                            <p className="text-sm text-muted-foreground">{new Date(w.requestedAt).toLocaleString('es-CO')}</p>
                                            <p className="text-sm text-muted-foreground font-mono">{w.nequiAccount}</p>
                                        </div>
                                        <Badge variant={getStatusVariant(w.status)}>{w.status}</Badge>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-8">
                                No tienes un historial de retiros.
                            </div>
                        )}
                    </div>
                    {/* Desktop View - Table */}
                    <div className="hidden md:block border rounded-lg">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Monto Solicitado</TableHead>
                                    <TableHead>Cuenta Nequi</TableHead>
                                    <TableHead className="text-right">Estado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {withdrawals.length > 0 ? (
                                    withdrawals.map(w => (
                                        <TableRow key={w.id}>
                                            <TableCell>{new Date(w.requestedAt).toLocaleDateString('es-CO')}</TableCell>
                                            <TableCell>{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(w.amount)}</TableCell>
                                            <TableCell className="font-mono">{w.nequiAccount}</TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={getStatusVariant(w.status)}>{w.status}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                     <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                            No tienes un historial de retiros.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
export default WithdrawalSection;

    