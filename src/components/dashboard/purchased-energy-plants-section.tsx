
"use client";

import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Progress } from "@/components/ui/progress";

// Countdown Timer Component
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
    const calculateTimeLeft = () => {
        const difference = +targetDate - +new Date();
        let timeLeft: { hours?: number; minutes?: number; seconds?: number } = {};

        if (difference > 0) {
            timeLeft = {
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

    Object.keys(timeLeft).forEach((interval) => {
        const value = timeLeft[interval as keyof typeof timeLeft];
        timerComponents.push(String(value).padStart(2, '0'));
    });

    if (timerComponents.length) {
        return <span className="font-mono text-base">{timerComponents.join(":")}</span>;
    } else {
        return <span className="text-primary animate-pulse text-base">Procesando...</span>;
    }
};


const PurchasedEnergyPlantsSection = () => {
    const { user, purchasedEnergyPlants } = useAuth();

    if (!user) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>Mis Plantas de Energía</CardTitle>
                </CardHeader>
                <CardContent className="text-center text-muted-foreground py-8">
                    Cargando información del usuario...
                </CardContent>
            </Card>
        )
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Mis Plantas de Energía</CardTitle>
                <CardDescription>
                    Aquí puedes ver todas las plantas de energía que has comprado y su progreso.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {purchasedEnergyPlants.length > 0 ? (
                        purchasedEnergyPlants.map((plant) => {
                            const purchaseDate = new Date(plant.purchaseDate);
                            const expirationDate = new Date(new Date(purchaseDate).setDate(purchaseDate.getDate() + plant.durationDays));
                            const lastDate = plant.lastYieldDate ? new Date(plant.lastYieldDate) : new Date(plant.purchaseDate);
                            const nextYieldDate = new Date(lastDate.getTime() + 24 * 60 * 60 * 1000);
                            
                            const daysPassed = (new Date().getTime() - purchaseDate.getTime()) / (1000 * 3600 * 24);
                            const progressPercentage = Math.min((daysPassed / plant.durationDays) * 100, 100);

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
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                        />
                                        <Badge variant={plant.status === 'Activo' ? "default" : "secondary"} className="absolute top-1 right-1">
                                            {plant.status}
                                        </Badge>
                                    </div>
                                    <div className="flex-grow">
                                        <CardTitle className="text-lg mb-1">{plant.name}</CardTitle>
                                        <CardDescription className="text-xs mb-2">
                                            Comprado: {purchaseDate.toLocaleDateString("es-CO")}
                                        </CardDescription>
                                        
                                        <div className="space-y-2 mt-2 text-xs">
                                            <div>
                                                <div className="text-green-600 font-semibold">
                                                    Rendimiento Diario: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(dailyYieldAmount)} ({plant.dailyYield}%)
                                                </div>
                                                <div className="text-blue-600 font-semibold">
                                                    Ganancia Total: +{new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(totalProfit)}
                                                </div>
                                                <div className="text-center bg-muted/50 p-1 rounded-md mt-2">
                                                    <p className="text-xs text-muted-foreground">Próximo rendimiento:</p>
                                                    {plant.status === 'Activo' ? (
                                                        <CountdownTimer targetDate={nextYieldDate} />
                                                    ) : (
                                                        <span className="text-muted-foreground text-sm">--:--:--</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="pt-1">
                                                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                                    <span>Progreso</span>
                                                    <span>Expira: {expirationDate.toLocaleDateString("es-CO")}</span>
                                                </div>
                                                <Progress value={progressPercentage} className="h-1.5" />
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            );
                        })
                    ) : (
                        <div className="col-span-full text-center text-muted-foreground py-16">
                            <h3 className="text-lg font-semibold">No tienes plantas de energía</h3>
                            <p>Ve a la sección "Comprar" para adquirir tu primera planta.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default PurchasedEnergyPlantsSection;

    