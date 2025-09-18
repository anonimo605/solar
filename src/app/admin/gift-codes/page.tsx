
'use client';

import GiftCodeManagement from '@/components/admin/gift-code-management';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AdminGiftCodesPage() {
    const router = useRouter();
    const { user } = useAuth();

    useEffect(() => {
        if (user && user.role !== 'superadmin') {
            router.push('/admin');
        }
    }, [user, router]);

    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-6xl space-y-8">
                <div className="flex justify-between items-center">
                    <h1 className="text-2xl font-bold">Gestión de Códigos de Regalo</h1>
                    <Button variant="outline" onClick={() => router.push('/admin')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Panel
                    </Button>
                </div>

                <GiftCodeManagement />

            </div>
        </main>
    );
}
