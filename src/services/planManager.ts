// src/services/planManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PlanType = 'free' | 'limited' | 'premium';

export const PLAN_SKUS = {
  LIMITED: 'plan_limited_10',   // $10 SKU
  PREMIUM: 'plan_premium_30',  // $30 SKU
};

export async function setPlanBySku(sku: string) {
  let plan: PlanType = 'free';
  if (sku === PLAN_SKUS.LIMITED) plan = 'limited';
  if (sku === PLAN_SKUS.PREMIUM) plan = 'premium';
  await AsyncStorage.setItem('userPlan', plan);
  if (plan === 'premium') await AsyncStorage.setItem('isPaidUser', 'true');
  else await AsyncStorage.setItem('isPaidUser', 'false');
}

export async function getPlan(): Promise<PlanType> {
  const plan = await AsyncStorage.getItem('userPlan');
  if (plan === 'limited' || plan === 'premium') return plan;
  return 'free';
}

export async function isPaidUser(): Promise<boolean> {
  return (await getPlan()) === 'premium';
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
