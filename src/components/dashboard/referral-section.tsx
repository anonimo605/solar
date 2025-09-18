
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Copy, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import type { User, Transaction, PurchasedEnergyPlant } from "@/lib/types";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, documentId, onSnapshot, Timestamp } from "firebase/firestore";

type ReferredUserWithEnergyPlants = User & { purchasedEnergyPlants: PurchasedEnergyPlant[] };

const ReferralSection = () => {
    const { user } = useAuth();
    const [referredUsers, setReferredUsers] = useState<ReferredUserWithEnergyPlants[]>([]);
    const [referralEarnings, setReferralEarnings] = useState(0);
    const [referralLink, setReferralLink] = useState('');
    const { toast } = useToast();
    
    useEffect(() => {
        if (user?.ownReferralCode) {
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            setReferralLink(`${baseUrl}/?ref=${user.ownReferralCode}`);
        }
    }, [user?.ownReferralCode]);

    useEffect(() => {
        if (user && user.referredUsers && user.referredUsers.length > 0) {
            const usersRef = collection(db, "users");
            // Firestore 'in' query has a limit of 30 elements in its value array.
            const q = query(usersRef, where(documentId(), "in", user.referredUsers.slice(0, 30)));
            
            const unsubscribe = onSnapshot(q, async (querySnapshot) => {
                const referralsDataPromises = querySnapshot.docs.map(async (doc) => {
                    const userData = { id: doc.id, ...doc.data() } as User;
                    
                    const energyPlantsColRef = collection(db, `users/${userData.id}/purchasedEnergyPlants`);
                    const energyPlantsSnapshot = await getDocs(energyPlantsColRef);
                    const purchasedEnergyPlants = energyPlantsSnapshot.docs.map(plantDoc => {
                         const plantData = plantDoc.data();
                         return {
                            id: plantDoc.id,
                            ...plantData,
                            purchaseDate: (plantData.purchaseDate as Timestamp).toDate(),
                         } as PurchasedEnergyPlant
                    });

                    return { ...userData, purchasedEnergyPlants };
                });
                
                const referralsData = await Promise.all(referralsDataPromises);
                setReferredUsers(referralsData);
            });

            return () => unsubscribe();
        } else {
            setReferredUsers([]);
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        
        const commissionQuery = query(
            collection(db, "transactions"),
            where("userId", "==", user.id)
        );

        const unsubscribe = onSnapshot(commissionQuery, (snapshot) => {
             const totalEarnings = snapshot.docs
                .map(doc => doc.data() as Transaction)
                .filter(t => t.description && t.description.startsWith("Comisión por referido"))
                .reduce((sum, t) => sum + t.amount, 0);

            setReferralEarnings(totalEarnings);
        });

        return () => unsubscribe();
    }, [user]);

    const handleCopy = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        toast({ title: "¡Copiado!", description: "Tu enlace de referido ha sido copiado." });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Programa de Referidos</CardTitle>
                <CardDescription>Invita a tus amigos compartiendo tu enlace único y visualiza tus referidos aquí.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div>
                    <p className="text-sm font-medium mb-2">Tu enlace de referido:</p>
                    <div className="flex w-full items-center space-x-2">
                        <Input value={referralLink} readOnly placeholder="Generando enlace..." />
                        <Button variant="secondary" size="icon" onClick={handleCopy} disabled={!referralLink}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-semibold mb-2">Mis Referidos ({referredUsers.length})</h3>
                    {referredUsers.length > 0 ? (
                         <Accordion type="single" collapsible className="w-full border rounded-lg">
                             {referredUsers.map((ref) => (
                                <AccordionItem value={ref.id} key={ref.id}>
                                    <AccordionTrigger className="px-4 py-3 hover:no-underline">
                                        <div className="flex justify-between items-center w-full">
                                            <div className="flex flex-col text-left">
                                                <span className="font-medium">{ref.phoneNumber}</span>
                                                <span className="text-sm text-muted-foreground">
                                                    Saldo: {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(ref.balance)}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <ShoppingCart className="h-4 w-4" />
                                                <span>{ref.purchasedEnergyPlants.length} Compras</span>
                                            </div>
                                        </div>
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-3">
                                        {ref.purchasedEnergyPlants.length > 0 ? (
                                             <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Producto</TableHead>
                                                        <TableHead>Fecha</TableHead>
                                                        <TableHead className="text-right">Precio</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {ref.purchasedEnergyPlants.map(plant => (
                                                        <TableRow key={plant.id}>
                                                            <TableCell>{plant.name}</TableCell>
                                                            <TableCell>{plant.purchaseDate.toLocaleDateString('es-CO')}</TableCell>
                                                            <TableCell className="text-right">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(plant.price)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-4">Este referido aún no ha comprado plantas de energía.</p>
                                        )}
                                    </AccordionContent>
                                </AccordionItem>
                             ))}
                         </Accordion>
                    ) : (
                         <div className="text-center text-muted-foreground py-16 border rounded-lg">
                            <h3 className="text-lg font-semibold">Aún no tienes referidos</h3>
                            <p className="text-sm">¡Comparte tu código para empezar a ganar!</p>
                        </div>
                    )}
                </div>

                <div>
                     <p className="text-sm">Ganancias totales por referidos: <span className="font-bold text-green-600">{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(referralEarnings)}</span></p>
                </div>
            </CardContent>
        </Card>
    );
};
export default ReferralSection;

    