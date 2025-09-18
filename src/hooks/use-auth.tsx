
'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, updateDoc, collection, runTransaction, addDoc, serverTimestamp, query, writeBatch, Timestamp, orderBy } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter, usePathname } from 'next/navigation';
import type { User, Transaction, PurchasedEnergyPlant } from '@/lib/types';
import { createTransaction } from '@/services/transactionService';

interface AuthContextType {
    user: User | null;
    firebaseUser: FirebaseUser | null;
    loading: boolean;
    updateUser: (data: Partial<User>) => Promise<void>;
    purchasedEnergyPlants: PurchasedEnergyPlant[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [purchasedEnergyPlants, setPurchasedEnergyPlants] = useState<PurchasedEnergyPlant[]>([]);
    const router = useRouter();
    const pathname = usePathname();

    const handleRedirect = useCallback((currentUser: User | null) => {
        const isAuthRoute = pathname === '/';
        const isAdminRoute = pathname.startsWith('/admin');
        const isDashboardRoute = pathname.startsWith('/dashboard');

        if (currentUser) {
            if (isAuthRoute) {
                router.push((currentUser.role === 'superadmin' || currentUser.role === 'admin') ? '/admin' : '/dashboard');
            } else if (isAdminRoute && !(currentUser.role === 'superadmin' || currentUser.role === 'admin')) {
                router.push('/dashboard');
                return false; // Indicate that we should stop processing for this user
            }
        } else {
            if (isAdminRoute || isDashboardRoute) {
               router.push('/');
           }
        }
        return true; // Indicate that we can proceed
    }, [router, pathname]);


     useEffect(() => {
        const processEnergyPlantYields = async () => {
            if (!user || loading) return;

            const userDocRef = doc(db, "users", user.id);
            const batch = writeBatch(db);
            let totalYield = 0;
            const transactionsToAdd: Omit<Transaction, 'id'>[] = [];

            for (const plant of purchasedEnergyPlants) {
                if (plant.status !== 'Activo') {
                    continue;
                }

                const now = new Date();
                const purchaseDate = new Date(plant.purchaseDate);
                const expirationDate = new Date(new Date(purchaseDate).setDate(purchaseDate.getDate() + plant.durationDays));
                
                let lastYieldDate = plant.lastYieldDate ? new Date(plant.lastYieldDate) : purchaseDate;

                // Loop to calculate pending yields day by day
                while (true) {
                    const nextYieldDate = new Date(lastYieldDate.getTime() + 24 * 60 * 60 * 1000);

                    if (nextYieldDate > now) {
                        break; // No more yields to process for now
                    }
                     if (nextYieldDate > expirationDate) {
                        // Plant has expired, check if we need to mark it as completed
                        const plantRef = doc(db, `users/${user.id}/purchasedEnergyPlants`, plant.id);
                        batch.update(plantRef, { status: 'Completado' });
                        break; 
                    }

                    // A 24-hour cycle has passed, process yield
                    const dailyYieldAmount = plant.price * (plant.dailyYield / 100);
                    totalYield += dailyYieldAmount;
                    
                    transactionsToAdd.push({
                        userId: user.id,
                        type: 'credit',
                        amount: dailyYieldAmount,
                        description: `Rendimiento diario: ${plant.name}`,
                        date: nextYieldDate, 
                    });

                    lastYieldDate = nextYieldDate;
                    const plantRef = doc(db, `users/${user.id}/purchasedEnergyPlants`, plant.id);
                    batch.update(plantRef, { lastYieldDate: Timestamp.fromDate(lastYieldDate) });
                }
                 // Final check for expiration after loop
                if (now >= expirationDate) {
                    const plantRef = doc(db, `users/${user.id}/purchasedEnergyPlants`, plant.id);
                    batch.update(plantRef, { status: 'Completado' });
                }
            }

            if (totalYield > 0) {
                try {
                    // Update balance in the same batch
                    const newBalance = user.balance + totalYield;
                    batch.update(userDocRef, { 
                        balance: newBalance,
                        version: (user.version || 0) + 1
                    });
                    
                    // Commit plant updates and balance update
                    await batch.commit();

                    // Create transaction documents separately after batch commit
                    for(const trans of transactionsToAdd) {
                        await createTransaction(trans);
                    }

                } catch (error) {
                    console.error("Error processing energy plant yields:", error);
                }
            }
        };

        if (user && purchasedEnergyPlants.length > 0 && !loading) {
            processEnergyPlantYields();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, purchasedEnergyPlants, loading]);


    useEffect(() => {
        const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
            setFirebaseUser(fbUser);
            setLoading(true);

            if (fbUser) {
                const userDocRef = doc(db, 'users', fbUser.uid);
                const unsubUser = onSnapshot(userDocRef, (doc) => {
                    if (doc.exists()) {
                        const userData = { id: doc.id, ...doc.data() } as User;
                        const canProceed = handleRedirect(userData);
                        if (canProceed) {
                            setUser(userData);
                        } else {
                            setUser(null); // Prevent data from leaking to unauthorized components
                        }
                    } else {
                        setUser(null);
                        handleRedirect(null); 
                    }
                    // setLoading(false) is now after plants are loaded
                });

                const energyPlantsQuery = query(collection(db, 'users', fbUser.uid, 'purchasedEnergyPlants'), orderBy('purchaseDate', 'desc'));
                const unsubEnergyPlants = onSnapshot(energyPlantsQuery, (snapshot) => {
                    const userEnergyPlants = snapshot.docs.map(doc => {
                        const data = doc.data();
                        return {
                            ...data,
                            id: doc.id,
                            purchaseDate: (data.purchaseDate as Timestamp).toDate(),
                            lastYieldDate: data.lastYieldDate ? (data.lastYieldDate as Timestamp).toDate() : undefined
                        } as PurchasedEnergyPlant;
                    });
                    setPurchasedEnergyPlants(userEnergyPlants);
                    setLoading(false); // Set loading to false after user and plants are loaded
                });
                
                return () => {
                    unsubUser();
                    unsubEnergyPlants();
                };

            } else {
                setUser(null);
                setFirebaseUser(null);
                setPurchasedEnergyPlants([]);
                setLoading(false);
                handleRedirect(null);
            }
        });

        return () => {
            unsubscribeAuth();
        };
    }, [handleRedirect]);

    const updateUser = useCallback(async (data: Partial<User>) => {
        if (!firebaseUser) throw new Error("No user is signed in to update.");
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        await updateDoc(userDocRef, data);
    }, [firebaseUser]);


    const value = { user, firebaseUser, loading, updateUser, purchasedEnergyPlants };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
