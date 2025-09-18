
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { RegisterForm } from '@/components/auth/register-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Sun } from 'lucide-react';
import { Toaster } from "@/components/ui/toaster"


type View = 'login' | 'register';

function AuthPageContent() {
  const [view, setView] = useState<View>('login');
  const searchParams = useSearchParams();
  const refCode = searchParams.get('ref');

  useEffect(() => {
    if (refCode) {
      setView('register');
    }
  }, [refCode]);

  return (
    <>
      <Toaster />
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border-primary/20 bg-card/80 backdrop-blur-sm">
           <CardHeader className="p-8 text-center bg-card/50">
             <div className="flex justify-center items-center gap-4 mb-4">
                <Sun className="h-10 w-10 text-primary" />
                <CardTitle className="font-headline text-5xl font-bold">
                Solar
                </CardTitle>
            </div>
            <CardDescription className="pt-1 text-muted-foreground">
              Tu compañero de energía solar seguro y sin interrupciones.
            </CardDescription>
          </CardHeader>

          <CardContent className="bg-card/50 p-8 pt-6">
             {view === 'login' ? (
                <LoginForm onSwitchRequest={() => setView('register')} />
              ) : (
                <RegisterForm onSwitchRequest={() => setView('login')} initialReferralCode={refCode || undefined} />
              )}
          </CardContent>
        </Card>
        <footer className="py-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Solar. Todos los derechos reservados.
        </footer>
      </main>
    </>
  );
}


export default function Home() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <AuthPageContent />
        </Suspense>
    );
}

    