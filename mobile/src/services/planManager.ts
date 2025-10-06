// src/services/planManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
// Removed Realm import; all plan logic now uses AsyncStorage or stubs
// Removed realm import; no longer needed after migration to Firestore

export type PlanType = 'free' | 'limited' | 'premium';

export const PLAN_SKUS = {
  LIMITED: 'plan_limited_10', // $10 SKU
  PREMIUM: 'plan_premium_30', // $30 SKU
};

export async function setPlanBySku(sku: string) {
  let plan: PlanType = 'free';
  if (sku === PLAN_SKUS.LIMITED) plan = 'limited';
  if (sku === PLAN_SKUS.PREMIUM) plan = 'premium';
  await AsyncStorage.setItem('userPlan', plan);
  if (plan === 'premium') {
    await AsyncStorage.setItem('isPaidUser', 'true');
    setYearlySubscriptionDates(); // Set subscription dates on yearly purchase
  } else {
    await AsyncStorage.setItem('isPaidUser', 'false');
  }
}

export async function getPlan(): Promise<PlanType> {
  // Always return 'premium' for development/testing
  return 'premium';
}

export async function isPaidUser(): Promise<boolean> {
  const paid = await AsyncStorage.getItem('isPaidUser');
  return paid === 'true';
}

export async function shouldShowAdsOrPrompts(): Promise<boolean> {
  const plan = await getPlan();
  return plan === 'free';
}

export async function shouldShowInterstitialAds(): Promise<boolean> {
  // $10 and $30 plans: no interstitial ads
  const plan = await getPlan();
  return plan === 'free';
}

export async function shouldShowBannerAds(): Promise<boolean> {
  // Only $30 disables banner ads; $10 still shows banner
  const plan = await getPlan();
  return plan === 'free' || plan === 'limited';
}

export async function shouldShowUpgradePrompt(): Promise<boolean> {
  // $10 and $30: no upgrade prompt
  const plan = await getPlan();
  return plan === 'free';
}

export async function canAccessLoginAndSync(): Promise<boolean> {
  // Only $30 (premium) plan allows login and sync
  const plan = await getPlan();
  return plan === 'premium';
}


// Stub user object for subscription logic (replace with Firestore or AsyncStorage as needed)
function getUserStub(): any {
  // TODO: Replace with Firestore or AsyncStorage user fetch
  return {
    subscriptionStartDate: new Date(),
    subscriptionExpiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
  };
}

export async function setYearlySubscriptionDates() {
  // TODO: Replace with Firestore or AsyncStorage logic
  // Example: store subscription dates in AsyncStorage
  const now = new Date();
  const expiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  await AsyncStorage.setItem('subscriptionStartDate', now.toISOString());
  await AsyncStorage.setItem('subscriptionExpiryDate', expiry.toISOString());
}

export function getSubscriptionDaysLeft(): number {
  // TODO: Replace with Firestore or AsyncStorage logic
  const user = getUserStub();
  if (!user?.subscriptionExpiryDate || !(user.subscriptionExpiryDate instanceof Date)) return 0;
  const now = new Date();
  const expiry = user.subscriptionExpiryDate;
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function isSubscriptionExpired(): boolean {
  return getSubscriptionDaysLeft() <= 0;
}

export function getSubscriptionWarningLevel():
  | 'none'
  | '30days'
  | '7days'
  | '1day'
  | 'expired' {
  const days = getSubscriptionDaysLeft();
  if (days <= 0) return 'expired';
  if (days <= 1) return '1day';
  if (days <= 7) return '7days';
  if (days <= 30) return '30days';
  return 'none';
}
