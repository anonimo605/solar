
'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, ChevronsRight, LifeBuoy, LogOut, Server, ShieldCheck, UserCog, Share2, Ticket, Megaphone, Link, QrCode, TrendingUp, Settings } from 'lucide-react';
import RechargeRequests from '@/components/admin/recharge-requests';
import { useAuth } from '@/hooks/use-auth';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import WithdrawalRequests from '@/components/admin/withdrawal-requests';
import WithdrawalSettingsForm from '@/components/admin/withdrawal-settings-form';

export default function AdminPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
       toast({
        title: 'Error',
        description: 'No se pudo cerrar la sesión.',
        variant: 'destructive',
      });
    }
  };

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p>{loading ? 'Verificando acceso y cargando datos...' : 'Acceso denegado. Redirigiendo...'}</p>
      </main>
    );
  }
  
  if (user.role !== 'superadmin' && user.role !== 'admin') {
      router.push('/dashboard');
      return (
         <main className="flex min-h-screen items-center justify-center bg-background">
            <p>Redirigiendo...</p>
        </main>
      );
  }

  return (
    <main className="flex min-h-screen flex-col items-center bg-background p-4 pt-12">
      <div className="w-full max-w-6xl space-y-8">
        <div className="flex justify-between items-center">
            <CardTitle>Panel de Administrador</CardTitle>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver al Dashboard
              </Button>
               <Button variant="destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Cerrar Sesión
                </Button>
            </div>
        </div>
        
        <Card>
            <CardHeader>
            <CardTitle>Configuración General</CardTitle>
            <CardDescription>Gestiona las configuraciones clave de la aplicación desde aquí.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.role === 'superadmin' && (
                  <>
                    <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/user-management')}>
                        <div className='flex items-center'><UserCog className="mr-2 h-4 w-4" />Gestionar Usuarios y Saldos</div>
                        <ChevronsRight className="ml-auto h-4 w-4"/>
                    </Button>
                    <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/referrals')}>
                        <div className='flex items-center'><Share2 className="mr-2 h-4 w-4" />Configurar Referidos</div>
                        <ChevronsRight className="ml-auto h-4 w-4"/>
                    </Button>
                    <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/gift-codes')}>
                        <div className='flex items-center'><Ticket className="mr-2 h-4 w-4" />Gestionar Códigos de Regalo</div>
                        <ChevronsRight className="ml-auto h-4 w-4"/>
                    </Button>
                    <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/announcements')}>
                        <div className='flex items-center'><Megaphone className="mr-2 h-4 w-4" />Gestionar Anuncio Global</div>
                        <ChevronsRight className="ml-auto h-4 w-4"/>
                    </Button>
                    <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/support-links')}>
                        <div className='flex items-center'><Link className="mr-2 h-4 w-4" />Gestionar Enlaces de Soporte</div>
                        <ChevronsRight className="ml-auto h-4 w-4"/>
                    </Button>
                     <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/qr-upload')}>
                        <div className='flex items-center'><QrCode className="mr-2 h-4 w-4" />Actualizar Código QR</div>
                        <ChevronsRight className="ml-auto h-4 w-4"/>
                    </Button>
                  </>
                )}
                <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/energy-plants')}>
                    <div className='flex items-center'><Server className="mr-2 h-4 w-4" />Gestión de Plantas de Energía</div>
                    <ChevronsRight className="ml-auto h-4 w-4"/>
                </Button>
                <Button className="w-full justify-between" variant="secondary" onClick={() => router.push('/admin/withdrawals')}>
                    <div className='flex items-center'><TrendingUp className="mr-2 h-4 w-4" />Gestionar Retiros y Ajustes</div>
                    <ChevronsRight className="ml-auto h-4 w-4"/>
                </Button>
            </CardContent>
        </Card>

        <RechargeRequests />
        
      </div>
    </main>
  );
}
