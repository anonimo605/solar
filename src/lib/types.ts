

import { Timestamp } from "firebase/firestore";

export interface WithdrawalInfo {
    nequiAccount: string;
    fullName: string;
    idNumber: string;
}

export interface User {
    id: string;
    displayId: string;
    phoneNumber: string;
    email: string;
    balance: number;
    role: 'user' | 'admin' | 'superadmin';
    ownReferralCode: string;
    withdrawalInfo?: WithdrawalInfo;
    version?: number;
    referredUsers?: string[];
    invitedByReferralCode?: string;
}

export interface Transaction {
    id: string;
    userId: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    date: Date;
}

export interface PaymentRequest {
  id: string;
  userId: string;
  userPhoneNumber: string;
  amount: number;
  referenceNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: {
      adminId: string;
      adminPhone: string;
  }
}


export interface WithdrawalRequest {
    id:string;
    userId: string;
    userPhone: string;
    amount: number;
    nequiAccount: string;
    fullName: string;
    idNumber: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: Date;
    processedAt?: Date;
    processedBy?: {
        adminId: string;
        adminPhone: string;
    }
}

export interface WithdrawalSettings {
    minWithdrawal: number;
    dailyLimit: number; // Max number of withdrawals per day
    withdrawalFeePercentage: number;
    withdrawalStartTime: number; // Hour of the day (0-23)
    withdrawalEndTime: number; // Hour of the day (0-23)
    allowedWithdrawalDays: number[]; // Array of day numbers (0=Sun, 1=Mon, ...)
}

export interface SupportLinks {
    whatsappContactUrl: string;
    whatsappGroupUrl: string;
    telegramGroupUrl?: string;
}

export interface EnergyPlant {
    id: string;
    name: string;
    price: number;
    dailyYield: number;
    purchaseLimit: number;
    durationDays: number;
    imageUrl: string;
    isTimeLimited: boolean;
    timeLimitHours?: number;
    timeLimitSetAt?: Date;
    createdAt: Date;
    createdBy?: {
        adminId: string;
        adminPhone: string;
    };
}

export interface Satellite {
    id: string;
    name: string;
    price: number;
    dailyYield: number;
    purchaseLimit: number;
    durationDays: number;
    imageUrl: string;
    isTimeLimited: boolean;
    timeLimitHours?: number;
    timeLimitSetAt?: Date;
    createdAt: Date;
}

export interface PurchasedEnergyPlant {
    id: string;
    energyPlantId: string;
    name: string;
    purchaseDate: Date;
    lastYieldDate?: Date;
    dailyYield: number;
    durationDays: number;
    price: number;
    status: 'Activo' | 'Completado';
    imageUrl: string;
}

export interface GiftCode {
    id: string;
    code: string;
    amount: number;
    usageLimit: number;
    expiresInMinutes: number;
    createdAt: Date;
    redeemedBy: string[];
}

export interface QrCodeUpdateLog {
    id: string;
    url: string;
    updatedBy: {
        userId: string;
        phoneNumber: string;
    };
    timestamp: Date;
}

export interface RechargeSettings {
    suggestedAmounts: number[];
}
    

    