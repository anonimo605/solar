
'use client';

import WithdrawalAccountForm from "@/components/dashboard/withdrawal-account-form";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function WithdrawalAccountPage() {
    const router = useRouter();
    return (
        <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
            <div className="w-full max-w-2xl space-y-8">
                <Button variant="outline" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Volver
                </Button>
                <WithdrawalAccountForm />
            </div>
        </main>
    )
}
