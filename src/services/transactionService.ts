
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { Transaction } from "@/lib/types";

export const createTransaction = async (transactionData: Omit<Transaction, 'id' | 'date'> & { date?: Date }) => {
    try {
        const { date, ...restData } = transactionData;
        await addDoc(collection(db, 'transactions'), {
            ...restData,
            date: date ? Timestamp.fromDate(date) : serverTimestamp()
        });
    } catch (error) {
        console.error("Error creating transaction:", error);
        // Depending on the use case, you might want to re-throw the error
        // to be handled by the calling function (e.g., inside a Firestore transaction).
        throw error;
    }
};
