
'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useForm, SubmitHandler } from 'react-hook-form';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDocs, query, collection, where, writeBatch, Timestamp, getDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { createTransaction } from '@/services/transactionService';
import { useEffect } from 'react';


interface RegisterFormProps {
  onSwitchRequest: () => void;
  initialReferralCode?: string;
}

type Inputs = {
  phone: string;
  password: string;
  confirmPassword: string;
  referralCode?: string;
};

export function RegisterForm({ onSwitchRequest, initialReferralCode }: RegisterFormProps) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, setValue } = useForm<Inputs>({
    defaultValues: {
      referralCode: initialReferralCode || ''
    }
  });
  const router = useRouter();
  const { toast } = useToast();
  const password = watch("password");

  useEffect(() => {
    if (initialReferralCode) {
      setValue('referralCode', initialReferralCode);
    }
  }, [initialReferralCode, setValue]);


  const generateReferralCode = () => {
    // Generates a 6-digit numeric code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  const onRegisterSubmit: SubmitHandler<Inputs> = async (data) => {
    try {
        // Step 1: Validate referral code if provided
        if (data.referralCode) {
            const referralCodeNormalized = data.referralCode.toUpperCase();
            const q = query(collection(db, "users"), where("ownReferralCode", "==", referralCodeNormalized));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast({
                    variant: "destructive",
                    title: "Código de Referido Inválido",
                    description: "El código de referido que ingresaste no existe. Por favor, verifica el código o déjalo vacío.",
                });
                return; // Stop the registration process
            }
        }

        // Get registration bonus from config
        const referralsConfigRef = doc(db, 'config', 'referrals');
        const configSnap = await getDoc(referralsConfigRef);
        const registrationBonus = configSnap.exists() ? configSnap.data().registrationBonus ?? 5000 : 5000;


      // Step 2: Create user with email and password
      const email = `${data.phone}@monetario.app`;
      const userCredential = await createUserWithEmailAndPassword(auth, email, data.password);
      const user = userCredential.user;

      const newUserDocRef = doc(db, 'users', user.uid);
      
      const batch = writeBatch(db);

      // Step 3: Set user document
      batch.set(newUserDocRef, {
        uid: user.uid,
        displayId: user.uid.substring(0, 7).toUpperCase(),
        phoneNumber: data.phone,
        createdAt: serverTimestamp(),
        invitedByReferralCode: data.referralCode?.toUpperCase() || null,
        ownReferralCode: generateReferralCode(),
        role: 'user',
        balance: registrationBonus,
        version: 1,
        referredUsers: [],
      });
      
       // Step 4: Create transaction for registration bonus
       const newTransactionRef = doc(collection(db, "transactions"));
       batch.set(newTransactionRef, {
           userId: user.uid,
           type: 'credit',
           amount: registrationBonus,
           description: 'Bono de registro',
           date: serverTimestamp(),
       });

      // Step 5: If referral code is valid, update the referrer
      if (data.referralCode) {
         const referralCodeNormalized = data.referralCode.toUpperCase();
         const q = query(collection(db, "users"), where("ownReferralCode", "==", referralCodeNormalized));
         const querySnapshot = await getDocs(q);
         
         // We already validated it, so it should not be empty, but we check again for safety
         if (!querySnapshot.empty) {
            const referrerDoc = querySnapshot.docs[0];
            const referrerRef = doc(db, 'users', referrerDoc.id);
            const referrerData = referrerDoc.data();
            
            const referredUsers = referrerData.referredUsers || [];
            batch.update(referrerRef, { referredUsers: [...referredUsers, user.uid] });
         }
      }

      // Step 6: Commit all changes
      await batch.commit();

      toast({
        title: "¡Registro exitoso!",
        description: `Tu cuenta ha sido creada y has recibido un bono de ${new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(registrationBonus)}.`,
      });

      router.push('/dashboard');

    } catch (error: any) {
      console.error(error);
      let description = "Ocurrió un error. Inténtalo de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este número de celular ya está registrado. Intenta iniciar sesión.";
      } else if (error.code === 'auth/weak-password') {
        description = "La contraseña es muy débil. Debe tener al menos 6 caracteres.";
      } else if (error.code === 'auth/invalid-credential' || error.code === 'auth/configuration-not-found') {
        description = "Error de configuración o credenciales. Revisa la consola y la configuración de Firebase.";
      }
      toast({
        title: "Error en el registro",
        description,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="animate-in fade-in-20 slide-in-from-bottom-8 duration-500">
      <form className="space-y-6" onSubmit={handleSubmit(onRegisterSubmit)}>
        <div className="space-y-2">
          <Label htmlFor="phone">Número de Celular</Label>
          <Input {...register("phone", { required: "El número es requerido" })} id="phone" type="tel" placeholder="3001234567" required className="bg-background/50 focus:bg-background" disabled={isSubmitting} />
           {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input {...register("password", { required: "La contraseña es requerida", minLength: { value: 6, message: "La contraseña debe tener al menos 6 caracteres" } })} id="password" type="password" placeholder="••••••••" required className="bg-background/50 focus:bg-background" disabled={isSubmitting} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
         <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirmar Contraseña</Label>
          <Input 
            {...register("confirmPassword", { 
              required: "Por favor, confirma tu contraseña",
              validate: value => value === password || "Las contraseñas no coinciden"
            })} 
            id="confirmPassword" 
            type="password" 
            placeholder="••••••••" 
            required 
            className="bg-background/50 focus:bg-background"
            disabled={isSubmitting}
          />
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="referralCode">Código de Referido (Opcional)</Label>
          <Input {...register("referralCode")} id="referralCode" type="text" placeholder="ABCXYZ" className="bg-background/50 focus:bg-background uppercase" disabled={isSubmitting} />
        </div>
        <Button type="submit" className="w-full font-semibold" disabled={isSubmitting}>
          {isSubmitting ? 'Registrando...' : 'Registrarse'}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes una cuenta?{' '}
          <Button variant="link" type="button" onClick={onSwitchRequest} className="p-0 h-auto font-semibold text-primary" disabled={isSubmitting}>
            Inicia Sesión
          </Button>
        </p>
      </form>
    </div>
  );
}
