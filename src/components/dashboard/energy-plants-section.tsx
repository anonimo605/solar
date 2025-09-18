
"use client";

import { useState, useEffect } from "react";
import type { Satellite, PurchasedEnergyPlant, Transaction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ShoppingCart, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, doc, updateDoc, Timestamp, addDoc, runTransaction, writeBatch, orderBy, query } from "firebase/firestore";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Countdown Timer Component
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const calculateTimeLeft = () => {
        const difference = +targetDate - +new Date();
        let timeLeft: { days?: number; hours?: number; minutes?: number; seconds?: number } = {};

        if (difference > 0) {
            timeLeft = {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        }
        return timeLeft;
    };

    const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

    useEffect(() => {
        const timer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => clearTimeout(timer);
    });

    const timerComponents: string[] = [];
    if (timeLeft.days !== undefined && timeLeft.days > 0) timerComponents.push(`${timeLeft.days}d`);
    if (timeLeft.hours !== undefined) timerComponents.push(String(timeLeft.hours).padStart(2, '0'));
    if (timeLeft.minutes !== undefined) timerComponents.push(String(timeLeft.minutes).padStart(2, '0'));
    if (timeLeft.seconds !== undefined) timerComponents.push(String(timeLeft.seconds).padStart(2, '0'));

    const timeString = timerComponents.length > 3 
        ? `${timerComponents[0]} ${timerComponents.slice(1,3).join(":")}`
        : timerComponents.join(":");

    if (timeString) {
        return <span className="font-mono text-xs text-primary">{timeString}</span>;
    } else {
        return <span className="text-xs text-primary animate-pulse">Oferta terminada</span>;
    }
};

const EnergyPlantsSection = () => {
  const [energyPlants, setEnergyPlants] = useState<Satellite[]>([]);
  const { user, purchasedEnergyPlants } = useAuth();
  const { toast } = useToast();
  const [selectedPlant, setSelectedPlant] = useState<Satellite | null>(null);
  const [quantity, setQuantity] = useState<number | string>(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "satellites"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const energyPlantsData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data,
                timeLimitSetAt: data.timeLimitSetAt instanceof Timestamp ? data.timeLimitSetAt.toDate() : undefined,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            } as Satellite
        });
        
        const sortedEnergyPlants = energyPlantsData.sort((a, b) => {
            const aIsLimited = a.isTimeLimited && a.timeLimitSetAt && a.timeLimitHours && (new Date() < new Date(a.timeLimitSetAt.getTime() + a.timeLimitHours * 60 * 60 * 1000));
            const bIsLimited = b.isTimeLimited && b.timeLimitSetAt && b.timeLimitHours && (new Date() < new Date(b.timeLimitSetAt.getTime() + b.timeLimitHours * 60 * 60 * 1000));

            if (aIsLimited && !bIsLimited) return -1;
            if (!aIsLimited && bIsLimited) return 1;

            return a.price - b.price;
        });
        
        setEnergyPlants(sortedEnergyPlants);
    });
    return () => unsubscribe();
  }, []);

  const openConfirmationDialog = (plant: Satellite) => {
      setSelectedPlant(plant);
      setQuantity(1);
      setIsDialogOpen(true);
  };

  const handlePurchase = async () => {
    if (!user || !selectedPlant) {
      toast({ variant: "destructive", title: "Error", description: "Debes iniciar sesión para comprar." });
      return;
    }

    const numQuantity = Number(quantity);

    if (isNaN(numQuantity) || numQuantity <= 0) {
        toast({ variant: "destructive", title: "Cantidad inválida", description: "La cantidad debe ser un número mayor que cero." });
        return;
    }

    const totalCost = selectedPlant.price * numQuantity;

    if (user.balance < totalCost) {
      toast({ variant: "destructive", title: "Saldo insuficiente", description: "No tienes suficiente saldo para comprar esta cantidad." });
      return;
    }
    
    const userOwnedCount = purchasedEnergyPlants.filter(p => p.energyPlantId === selectedPlant.id).length;
    if ((userOwnedCount + numQuantity) > selectedPlant.purchaseLimit) {
        toast({ variant: "destructive", title: "Límite alcanzado", description: `No puedes comprar esta cantidad. El límite para esta planta es ${selectedPlant.purchaseLimit} y ya posees ${userOwnedCount}.` });
        return;
    }
    
    try {
        const userDocRef = doc(db, "users", user.id);
        const productsColRef = collection(db, `users/${user.id}/purchasedEnergyPlants`);
        const transactionsColRef = collection(db, 'transactions');

        await runTransaction(db, async (transaction) => {
            const userDoc = await transaction.get(userDocRef);
            if (!userDoc.exists()) {
                throw new Error("Usuario no encontrado.");
            }

            const currentBalance = userDoc.data().balance;
            const updatedBalance = currentBalance - totalCost;

            if (updatedBalance < 0) {
                throw new Error("Saldo insuficiente.");
            }

            transaction.update(userDocRef, { 
                balance: updatedBalance,
                version: (user.version || 0) + 1 
            });

            const newTransactionData = {
                userId: user.id,
                type: 'debit',
                amount: totalCost,
                description: `Compra: ${selectedPlant.name} (x${numQuantity})`,
                date: Timestamp.now(),
            };
            const newTransRef = doc(transactionsColRef);
            transaction.set(newTransRef, newTransactionData);

            for (let i = 0; i < numQuantity; i++) {
                 const purchaseTime = new Date();
                 const newPurchasedPlantData: Omit<PurchasedEnergyPlant, 'id'> = {
                    energyPlantId: selectedPlant.id,
                    name: selectedPlant.name,
                    purchaseDate: purchaseTime,
                    dailyYield: selectedPlant.dailyYield,
                    status: 'Activo',
                    price: selectedPlant.price,
                    durationDays: selectedPlant.durationDays,
                    imageUrl: selectedPlant.imageUrl,
                };
                const newProductDocRef = doc(productsColRef);
                transaction.set(newProductDocRef, {
                    ...newPurchasedPlantData,
                    purchaseDate: Timestamp.fromDate(purchaseTime)
                });
            }
        });

        toast({ title: "¡Compra exitosa!", description: `Has comprado ${numQuantity}x ${selectedPlant.name}.` });
        setIsDialogOpen(false);
    } catch (error: any) {
        console.error("Purchase failed:", error);
        toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo completar la compra." });
    }
  };

  const isQuantityValid = Number(quantity) > 0 && String(quantity).trim() !== '';

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle>Comprar Plantas de Energía</CardTitle>
        <CardDescription>
          Usa tu saldo para comprar plantas de energía y obtener rendimientos.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {energyPlants.length > 0 ? energyPlants.map((plant) => {
            const isLimited = plant.isTimeLimited && plant.timeLimitHours && plant.timeLimitSetAt;
            const expirationDate = isLimited ? new Date(plant.timeLimitSetAt!.getTime() + plant.timeLimitHours! * 60 * 60 * 1000) : null;
            const isExpired = expirationDate ? new Date() > expirationDate : false;
            
            if (isLimited && isExpired) return null;
            
            const dailyYieldAmount = plant.price * (plant.dailyYield / 100);
            const totalProfit = dailyYieldAmount * plant.durationDays;

            return (
              <Card key={plant.id} className="overflow-hidden flex flex-row items-center gap-4 p-4">
                 <div className="relative w-32 h-32 flex-shrink-0 bg-muted/20 rounded-md">
                  <Image
                    src={plant.imageUrl}
                    alt={plant.name}
                    fill
                    className="object-cover rounded-md"
                    data-ai-hint="solar panel investment"
                  />
                   {isLimited && expirationDate && (
                       <Badge variant="destructive" className="absolute top-1 right-1">
                            <Clock className="mr-1 h-3 w-3" />
                           <CountdownTimer targetDate={expirationDate} />
                       </Badge>
                   )}
                </div>
                <div className="flex-grow">
                    <CardTitle className="text-lg mb-1">{plant.name}</CardTitle>
                    <p className="text-xl font-bold">
                        {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                        }).format(plant.price)}
                    </p>
                    <div className="space-y-0.5 text-xs mt-2">
                            <p className="text-green-600 font-semibold">
                                Rendimiento Diario: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(dailyYieldAmount)} ({plant.dailyYield}%)
                            </p>
                            <p className="text-blue-600 font-semibold">
                                Ganancia Total: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(totalProfit)}
                            </p>
                            <p className="text-muted-foreground">
                                Duración: {plant.durationDays} días
                            </p>
                            <p className="text-muted-foreground">
                                Límite de compra: {plant.purchaseLimit}
                            </p>
                    </div>
                    <Button className="w-full mt-3 h-9" onClick={() => openConfirmationDialog(plant)} disabled={!user}>
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        Comprar
                    </Button>
                </div>
              </Card>
            )
        }) : (
            <div className="text-center text-muted-foreground py-8 col-span-full">
                <p>No hay plantas de energía disponibles para la compra en este momento.</p>
                <p className="text-sm">Por favor, pídele a un administrador que añada nuevas plantas.</p>
            </div>
        )}
      </CardContent>
    </Card>

    {selectedPlant && (
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar Compra</AlertDialogTitle>
                    <AlertDialogDescription>
                        Estás a punto de comprar <strong>{selectedPlant.name}</strong>.
                        Por favor, selecciona la cantidad y confirma la operación.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad</Label>
                        <Input 
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            onBlur={(e) => {
                                const numValue = Number(e.target.value);
                                if (isNaN(numValue) || numValue < 1) {
                                    setQuantity(1);
                                }
                            }}
                            className="w-full"
                        />
                    </div>
                     <div className="p-3 border rounded-lg bg-muted/50 text-sm space-y-1">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Precio Unitario:</span>
                            <span className="font-medium">
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedPlant.price)}
                            </span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                            <span>Costo Total:</span>
                            <span className="text-primary">
                                {new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(selectedPlant.price * (Number(quantity) || 0))}
                            </span>
                        </div>
                    </div>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handlePurchase} disabled={!isQuantityValid}>Confirmar Compra</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )}
    </>
  );
};

export default EnergyPlantsSection;
