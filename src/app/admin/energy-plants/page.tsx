
'use client';

import EnergyPlantManagement from '@/components/admin/energy-plant-management';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AdminEnergyPlantsPage() {
    const router = useRouter();

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-6xl space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Gestión de Plantas de Energía</h1>
                    <Button variant="outline" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Button>
                </div>

                <EnergyPlantManagement />

            </div>
        </main>
    );
}
