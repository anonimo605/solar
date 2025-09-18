
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword, onAuthStateChanged, getAuth } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface LoginFormProps {
  onSwitchRequest: () => void;
}

type Inputs = {
  phone: string;
  password: string;
};

export function LoginForm({ onSwitchRequest }: LoginFormProps) {
  const { register, handleSubmit } = useForm<Inputs>();
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSignInSubmit: SubmitHandler<Inputs> = async (data) => {
    setIsSubmitting(true);
    try {
      // Firebase doesn't directly support phone+password, so we use a "fake" email
      const email = `${data.phone}@monetario.app`;
      await signInWithEmailAndPassword(auth, email, data.password);
      
      toast({
        title: "¡Bienvenido de nuevo!",
        description: "Has iniciado sesión correctamente.",
      });

      // Wait for auth state to be confirmed before redirecting
      const authInstance = getAuth();
      onAuthStateChanged(authInstance, (user) => {
        if (user) {
          router.push('/dashboard');
        }
      });

    } catch (error: any) {
      console.error(error);
      let description = "Ocurrió un error. Inténtalo de nuevo.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        description = "Credenciales incorrectas. Por favor, verifica tu número de celular y contraseña.";
      }
      toast({
        title: "Error al iniciar sesión",
        description,
        variant: "destructive",
      });
    } finally {
        setIsSubmitting(false);
    }
  };


  return (
    <div className="animate-in fade-in-20 slide-in-from-bottom-8 duration-500">
      <form className="space-y-6" onSubmit={handleSubmit(onSignInSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="phone">Número de Celular</Label>
          <Input {...register("phone", { required: true })} id="phone" type="tel" placeholder="3001234567" required className="bg-background/50 focus:bg-background" disabled={isSubmitting} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input {...register("password", { required: true })} id="password" type="password" placeholder="••••••••" required className="bg-background/50 focus:bg-background" disabled={isSubmitting} />
        </div>
        <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? 'Iniciando...' : 'Iniciar Sesión'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes una cuenta?{' '}
          <Button variant="link" type="button" onClick={onSwitchRequest} className="p-0 h-auto font-semibold text-primary" disabled={isSubmitting}>
            Regístrate
          </Button>
        </p>
      </form>
    </div>
  );
}
