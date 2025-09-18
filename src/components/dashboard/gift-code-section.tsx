
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Gift } from "lucide-react";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { GiftCode, Transaction, User } from "@/lib/types";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, runTransaction, doc, Timestamp, updateDoc, arrayUnion } from 'firebase/firestore';


const formSchema = z.object({
  code: z.string().min(1, "El código no puede estar vacío."),
});

const GiftCodeSection = () => {
    const { user } = useAuth();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: { code: "" },
    });

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!user) {
            toast({ variant: "destructive", title: "Error", description: "Debes iniciar sesión para canjear un código." });
            return;
        }

        const normalizedCode = values.code.toUpperCase();
        const giftCodeQuery = query(collection(db, "giftCodes"), where("code", "==", normalizedCode));

        try {
            await runTransaction(db, async (transaction) => {
                const querySnapshot = await getDocs(giftCodeQuery);

                if (querySnapshot.empty) {
                    throw new Error("El código de regalo que ingresaste no existe.");
                }

                const giftCodeDoc = querySnapshot.docs[0];
                const giftCode = { ...giftCodeDoc.data(), id: giftCodeDoc.id } as GiftCode;
                giftCode.createdAt = (giftCodeDoc.data().createdAt as Timestamp).toDate();
                
                // --- Validations ---
                const now = new Date();
                const expirationDate = new Date(giftCode.createdAt.getTime() + giftCode.expiresInMinutes * 60 * 1000);
                if (now > expirationDate) {
                    throw new Error("Este código de regalo ya no es válido.");
                }

                if (giftCode.redeemedBy.length >= giftCode.usageLimit) {
                    throw new Error("Este código de regalo ha alcanzado su límite de usos.");
                }

                if (giftCode.redeemedBy.includes(user.id)) {
                    throw new Error("Ya has canjeado este código de regalo anteriormente.");
                }
                
                // --- Atomic Transaction ---
                const userDocRef = doc(db, "users", user.id);
                const codeDocRef = doc(db, "giftCodes", giftCode.id);
                
                const userDoc = await transaction.get(userDocRef);
                if (!userDoc.exists()) {
                    throw new Error("Usuario no encontrado.");
                }

                const newTransactionData = {
                    userId: user.id,
                    type: 'credit',
                    amount: giftCode.amount,
                    description: `Código de regalo: ${giftCode.code}`,
                    date: Timestamp.now(),
                };
                const newTransRef = doc(collection(db, "transactions"));
                transaction.set(newTransRef, newTransactionData);

                const newBalance = userDoc.data().balance + giftCode.amount;
                transaction.update(userDocRef, { 
                    balance: newBalance,
                    version: (user.version || 0) + 1
                });
                transaction.update(codeDocRef, {
                    redeemedBy: arrayUnion(user.id)
                });
                
                toast({ title: "¡Código Canjeado!", description: `Has recibido ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(giftCode.amount)} en tu saldo.` });
                form.reset();
            });

        } catch (error: any) {
            console.error("Error redeeming gift code:", error);
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo canjear el código. Inténtalo de nuevo." });
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>Código de Regalo</CardTitle>
                <CardDescription>¿Tienes un código de regalo? Ingrésalo aquí para canjear tu recompensa.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-start space-x-2">
                         <FormField
                            control={form.control}
                            name="code"
                            render={({ field }) => (
                            <FormItem className="flex-grow">
                                <FormControl>
                                <Input placeholder="Tu código aquí" {...field} className="uppercase" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                         <Button type="submit" disabled={form.formState.isSubmitting || !user}>
                            <Gift className="mr-2 h-4 w-4" />
                            Canjear
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};

export default GiftCodeSection;

    