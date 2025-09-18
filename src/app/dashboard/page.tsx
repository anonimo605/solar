

'use client';

import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut, User as FirebaseUser } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  LogOut, 
  User as UserIcon, 
  Wallet, 
  Hash, 
  Landmark, 
  Users, 
  Phone,
  LifeBuoy,
  ArrowDownUp,
  CreditCard,
  ShieldCheck,
  Megaphone,
  X,
  MessageSquare,
  UserPlus,
  Gift,
  History,
  Send,
  Server,
  Sun
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, collection, addDoc, serverTimestamp, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import type { SupportLinks, RechargeSettings } from '@/lib/types';
import EnergyPlantsSection from '@/components/dashboard/energy-plants-section';
import PurchasedEnergyPlantsSection from '@/components/dashboard/purchased-energy-plants-section';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { Label } from '@/components/ui/label';
import WithdrawalSection from '@/components/dashboard/withdrawal-section';
import GiftCodeSection from '@/components/dashboard/gift-code-section';
import ReferralSection from '@/components/dashboard/referral-section';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


interface UserData {
  phoneNumber: string;
  ownReferralCode: string;
  balance: number;
  role?: string;
}

interface Announcement {
  title: string;
  message: string;
  active: boolean;
}

type ActiveView = 'exchange' | 'buy' | 'platforms' | 'profile' | 'referrals' | 'withdraw' | 'gift-code';
type RechargeStep = 'selection' | 'payment' | 'pending';

const DEFAULT_SUGGESTED_AMOUNTS = [20000, 48000, 100000, 150000, 350000, 500000];

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [activeView, setActiveView] = useState<ActiveView>('buy');

  // State for recharge
  const [rechargeStep, setRechargeStep] = useState<RechargeStep>('selection');
  const [rechargeAmount, setRechargeAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('https://placehold.co/300x300.png');
  const [lastConfirmedReference, setLastConfirmedReference] = useState('');
  const [suggestedAmounts, setSuggestedAmounts] = useState<number[]>(DEFAULT_SUGGESTED_AMOUNTS);


  // State for announcement
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // State for support links
  const [supportLinks, setSupportLinks] = useState<SupportLinks | null>(null);
  
  const { toast } = useToast();

   useEffect(() => {
    const fetchConfig = async () => {
        if(!user || authLoading) return;

        try {
            // Fetch QR Code
            const qrDocRef = doc(db, 'config', 'qrCode');
            const qrDocSnap = await getDoc(qrDocRef);
            if (qrDocSnap.exists() && qrDocSnap.data().url) {
                setQrCodeUrl(qrDocSnap.data().url);
            }
            
             // Fetch Suggested Amounts
            const rechargeSettingsDocRef = doc(db, 'config', 'rechargeSettings');
            const rechargeSettingsDocSnap = await getDoc(rechargeSettingsDocRef);
            if (rechargeSettingsDocSnap.exists()) {
                const settings = rechargeSettingsDocSnap.data() as RechargeSettings;
                if(settings.suggestedAmounts && settings.suggestedAmounts.length > 0) {
                    setSuggestedAmounts(settings.suggestedAmounts);
                }
            }


            // Fetch Announcement
            const announcementDocRef = doc(db, 'config', 'announcement');
            const announcementDocSnap = await getDoc(announcementDocRef);
            if (announcementDocSnap.exists()) {
                const annData = announcementDocSnap.data() as Announcement;
                if (annData.active) {
                    setAnnouncement(annData);
                    setShowAnnouncement(true);
                }
            }

            // Fetch Support Links
            const supportLinksDocRef = doc(db, 'config', 'supportLinks');
            const supportLinksDocSnap = await getDoc(supportLinksDocRef);
            if(supportLinksDocSnap.exists()){
                setSupportLinks(supportLinksDocSnap.data() as SupportLinks);
            }

        } catch(error) {
            console.error("Error fetching config:", error);
            toast({
                title: "Error de configuración",
                description: "No se pudieron cargar algunos datos de la aplicación.",
                variant: "destructive",
            });
        }
    };
    
    if(!authLoading) {
      fetchConfig();
    }
   }, [user, authLoading, toast]);


  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const handleRechargeAmountSelection = (amount: number | 'custom') => {
    let finalAmount: number;
    if (amount === 'custom') {
      finalAmount = parseFloat(customAmount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        toast({ title: 'Monto inválido', description: 'Por favor, ingresa un número válido.', variant: 'destructive' });
        return;
      }
    } else {
      finalAmount = amount;
    }
    setRechargeAmount(finalAmount);
    setPaymentReference('');
    setRechargeStep('payment');
  };

  const handlePaymentConfirmation = async () => {
    if (!user || !rechargeAmount || !paymentReference) {
        toast({ title: 'Error', description: 'Por favor, ingresa el código de referencia del pago.', variant: 'destructive' });
        return;
    }

    try {
        const paymentRequest = {
            userId: user.id,
            userPhoneNumber: user.phoneNumber,
            amount: rechargeAmount,
            referenceNumber: paymentReference,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, 'paymentRequests'), paymentRequest);
        setLastConfirmedReference(paymentReference);
        setRechargeStep('pending');
    } catch (error) {
        console.error("Error creating payment request: ", error);
        toast({ title: 'Error', description: 'No se pudo crear la solicitud de pago. Inténtalo de nuevo.', variant: 'destructive' });
    }
  };

  const openLink = (url: string) => {
    if(url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };


  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <p>Cargando...</p>
      </main>
    );
  }

  if (!user) {
    return null; 
  }

  const renderContent = () => {
    switch(activeView) {
      case 'exchange':
        return (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Recargar Saldo</CardTitle>
              <CardDescription>Selecciona o ingresa un monto para recargar tu cuenta.</CardDescription>
            </CardHeader>
            <CardContent>
              {rechargeStep === 'selection' && (
                <div className="space-y-4">
                   <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {suggestedAmounts.map((amount) => (
                             <Button key={amount} variant="outline" className="h-16 text-lg" onClick={() => handleRechargeAmountSelection(amount)}>
                                ${amount.toLocaleString('es-CO')}
                            </Button>
                        ))}
                   </div>
                   <div className="flex items-center space-x-2">
                     <Input 
                        type="number" 
                        placeholder="Otro monto"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="h-12"
                     />
                     <Button onClick={() => handleRechargeAmountSelection('custom')} className="h-12">Continuar</Button>
                   </div>
                </div>
              )}
              {rechargeStep === 'payment' && (
                <div className="space-y-6 text-center">
                    <h3 className="text-xl font-semibold">Monto a Recargar: ${rechargeAmount?.toLocaleString('es-CO')}</h3>
                    <p className="text-muted-foreground">1. Escanea el código QR con tu app de Nequi para pagar.</p>
                    <div className="flex justify-center">
                        <Image src={qrCodeUrl} alt="Código QR de Nequi" width={300} height={300} className="rounded-lg shadow-md" data-ai-hint="qr code"/>
                    </div>
                    <div className="space-y-2 max-w-sm mx-auto">
                        <Label htmlFor="payment-reference">2. Ingresa el código de referencia de pago</Label>
                        <p className="text-xs text-muted-foreground pb-2">Escribe el número de confirmación o referencia que te dio Nequi.</p>
                        <Input
                            id="payment-reference"
                            value={paymentReference}
                            onChange={(e) => setPaymentReference(e.target.value)}
                            placeholder="Ej: m1234567"
                            className="text-center text-lg h-12"
                        />
                    </div>
                    <div className="flex gap-4 justify-center">
                         <Button variant="outline" onClick={() => setRechargeStep('selection')}>Cancelar</Button>
                         <Button onClick={handlePaymentConfirmation} disabled={!paymentReference}>He realizado el pago</Button>
                    </div>
                </div>
              )}
               {rechargeStep === 'pending' && (
                <div className="space-y-4 text-center p-8">
                    <CreditCard className="mx-auto h-12 w-12 text-primary" />
                    <h3 className="text-2xl font-bold">Pago en Verificación</h3>
                    <p className="text-muted-foreground max-w-md mx-auto">
                        Hemos recibido tu confirmación. Tu solicitud de recarga por ${rechargeAmount?.toLocaleString('es-CO')} está siendo verificada. Verás el saldo reflejado en tu cuenta una vez sea aprobada.
                    </p>
                    <p className="text-sm font-semibold">Tu código de referencia es: <span className="font-mono">{lastConfirmedReference}</span></p>
                    <Button onClick={() => setRechargeStep('selection')}>Hacer otra recarga</Button>
                </div>
              )}

            </CardContent>
          </Card>
        );
      case 'buy':
        return <EnergyPlantsSection />;
      case 'platforms':
        return <PurchasedEnergyPlantsSection />;
      case 'withdraw':
        return <WithdrawalSection />;
      case 'gift-code':
        return <GiftCodeSection />;
      case 'referrals':
        return <ReferralSection />;
      case 'profile':
        return (
          <Card className="w-full mt-4 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Tu Perfil</CardTitle>
              <CardDescription>
                Aquí puedes ver la información de tu cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {user && (
                <div className="space-y-6">
                  <div className="flex items-center">
                    <Hash className="mr-3 h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Tu Código de Referido:</p>
                      <p className="text-lg font-mono tracking-widest bg-muted text-muted-foreground px-2 py-1 rounded-md inline-block">{user.ownReferralCode}</p>
                    </div>
                  </div>
                   <div className="space-y-2">
                        <Button className="w-full" onClick={() => router.push('/dashboard/transactions')}>
                            <History className="mr-2 h-4 w-4" />
                            Ver Historial de Saldo
                        </Button>
                        <Button className="w-full" variant="outline" onClick={() => router.push('/dashboard/cuenta-retiro')}>
                            <Landmark className="mr-2 h-4 w-4" />
                            Datos para Retiros
                        </Button>
                        <Button className="w-full" variant="outline" onClick={() => setActiveView('gift-code')}>
                            <Gift className="mr-2 h-4 w-4" />
                            Canjear Código de Regalo
                        </Button>
                    </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  }

  return (
     <main className="flex min-h-screen flex-col items-center bg-background pb-24">
        {showAnnouncement && announcement && (
            <Dialog open={showAnnouncement} onOpenChange={setShowAnnouncement}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4">
                            <Megaphone className="h-10 w-10 text-primary" />
                        </div>
                        <DialogTitle className="text-center text-2xl">{announcement.title}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 text-center text-muted-foreground">
                        {announcement.message}
                    </div>
                    <DialogFooter className="sm:justify-center">
                        <Button type="button" onClick={() => setShowAnnouncement(false)}>
                            Cerrar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
        
        <div className="w-full max-w-4xl p-4 pt-4">
            {user && (
              <Card className="w-full shadow-lg mb-4">
                 <CardHeader className="p-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-xl font-mono tracking-wider">
                      ID: {user.displayId}
                    </CardTitle>
                     <Button variant="outline" size="sm" onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar Sesión
                    </Button>
                </CardHeader>
                <Separator />
                <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16 bg-primary text-primary-foreground">
                            <AvatarFallback className="bg-primary text-primary-foreground">
                                <Sun className="h-8 w-8" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 flex-grow">
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Saldo Disponible</p>
                                <p className="text-2xl font-bold text-primary">
                                    {(user.balance ?? 0).toLocaleString('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-muted-foreground">Número de Celular</p>
                                <p className="text-xl font-semibold">{user.phoneNumber}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
              </Card>
            )}
        </div>

        <header className="sticky top-0 left-0 right-0 bg-primary text-primary-foreground border-b border-t shadow-md z-40 w-full">
            <div className="grid grid-cols-6 items-center max-w-4xl mx-auto p-2">
                <Button variant={activeView === 'exchange' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('exchange')}>
                    <Landmark className="h-5 w-5" />
                    <span className="text-xs mt-1">Recargar</span>
                </Button>
                <Button variant={activeView === 'buy' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('buy')}>
                    <Sun className="h-5 w-5" />
                    <span className="text-xs mt-1">Comprar</span>
                </Button>
                <Button variant={activeView === 'platforms' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('platforms')}>
                    <Server className="h-5 w-5" />
                    <span className="text-xs mt-1">Mis Plantas</span>
                </Button>
                <Button variant={activeView === 'withdraw' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('withdraw')}>
                    <ArrowDownUp className="h-5 w-5" />
                    <span className="text-xs mt-1">Retirar</span>
                </Button>
                <Button variant={activeView === 'referrals' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('referrals')}>
                    <Users className="h-5 w-5" />
                    <span className="text-xs mt-1">Referidos</span>
                </Button>
                <Button variant={activeView === 'profile' ? 'secondary' : 'ghost'} className="flex flex-col h-auto p-2" onClick={() => setActiveView('profile')}>
                    <UserIcon className="h-5 w-5" />
                    <span className="text-xs mt-1">Perfil</span>
                </Button>
            </div>
        </header>

        <div className="w-full max-w-4xl p-4">
            {(user?.role === 'superadmin' || user?.role === 'admin') && (
              <div className="mb-4 w-full">
                <Button className="w-full" onClick={() => router.push('/admin')}>
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  Panel de Administrador
                </Button>
              </div>
            )}

            <div className="">
                {renderContent()}
            </div>
        </div>

        {(supportLinks?.whatsappContactUrl || supportLinks?.whatsappGroupUrl || supportLinks?.telegramGroupUrl) && (
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        variant="default"
                        className="fixed bottom-4 right-4 h-16 w-16 rounded-full shadow-lg z-50"
                    >
                        <LifeBuoy className="h-8 w-8" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side="top" align="end">
                    <div className="flex flex-col gap-2">
                        {supportLinks.whatsappContactUrl && (
                            <Button size="sm" onClick={() => openLink(supportLinks.whatsappContactUrl)}>
                                <MessageSquare className="mr-2 h-4 w-4"/>
                                Contactar Soporte
                            </Button>
                        )}
                        {supportLinks.whatsappGroupUrl && (
                            <Button size="sm" variant="secondary" onClick={() => openLink(supportLinks.whatsappGroupUrl)}>
                                <UserPlus className="mr-2 h-4 w-4"/>
                                Unirse a WhatsApp
                            </Button>
                        )}
                        {supportLinks.telegramGroupUrl && (
                            <Button size="sm" variant="secondary" onClick={() => openLink(supportLinks.telegramGroupUrl)}>
                                <Send className="mr-2 h-4 w-4"/>
                                Unirse a Telegram
                            </Button>
                        )}
                    </div>
                </PopoverContent>
            </Popover>
        )}
      
    </main>
  );
}
