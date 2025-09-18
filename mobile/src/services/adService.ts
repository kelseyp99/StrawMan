import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Select interstitial ad unit from env in production; default to Google test ID otherwise
const isLive = process.env.AD_MOB_ENV === 'live';
const liveInterstitialAndroid = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID;
const liveInterstitialIOS = process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_IOS;
const adUnitId = isLive
  ? (Platform.OS === 'android' ? liveInterstitialAndroid : liveInterstitialIOS) || TestIds.INTERSTITIAL
  : TestIds.INTERSTITIAL;

class AdService {
  private interstitial: InterstitialAd | null = null;
  private isLoaded = false;
  private isShowing = false;
  private lastAdTimestamp = 0;
  private readonly AD_COOLDOWN = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly STORAGE_KEY = 'lastAdTimestamp';

  constructor() {
    this.initializeAd();
    this.loadLastAdTimestamp();
  }

  private async loadLastAdTimestamp() {
    try {
      const timestamp = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (timestamp) {
        this.lastAdTimestamp = parseInt(timestamp, 10);
      }
    } catch (error) {
      console.warn('Failed to load last ad timestamp:', error);
    }
  }

  private async saveLastAdTimestamp() {
    try {
      this.lastAdTimestamp = Date.now();
      await AsyncStorage.setItem(this.STORAGE_KEY, this.lastAdTimestamp.toString());
    } catch (error) {
      console.warn('Failed to save last ad timestamp:', error);
    }
  }

  private initializeAd() {
    this.interstitial = InterstitialAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

    this.interstitial.addAdEventListener(AdEventType.LOADED, () => {
      this.isLoaded = true;
      console.log('Interstitial ad loaded');
    });

    this.interstitial.addAdEventListener(AdEventType.OPENED, () => {
      this.isShowing = true;
      console.log('Interstitial ad opened');
    });

    this.interstitial.addAdEventListener(AdEventType.CLOSED, () => {
      this.isShowing = false;
      this.isLoaded = false;
      console.log('Interstitial ad closed');
      this.saveLastAdTimestamp();
      // Preload next ad
      setTimeout(() => this.loadAd(), 1000);
    });

    this.interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
      console.warn('Interstitial ad error:', error);
      this.isLoaded = false;
      this.isShowing = false;
      // Retry loading after a delay
      setTimeout(() => this.loadAd(), 10000);
    });

    // Initial load
    this.loadAd();
  }

  private loadAd() {
    if (this.interstitial && !this.isLoaded && !this.isShowing) {
      this.interstitial.load();
    }
  }

  public canShowAd(): boolean {
    const now = Date.now();
    const timeSinceLastAd = now - this.lastAdTimestamp;
    return (
      this.isLoaded &&
      !this.isShowing &&
      timeSinceLastAd >= this.AD_COOLDOWN
    );
  }

  public async showAdIfReady(): Promise<boolean> {
    if (!this.canShowAd()) {
      return false;
    }

    try {
      await this.interstitial?.show();
      return true;
    } catch (error) {
      console.warn('Failed to show interstitial ad:', error);
      return false;
    }
  }

  public getTimeUntilNextAd(): number {
    const now = Date.now();
    const timeSinceLastAd = now - this.lastAdTimestamp;
    const timeRemaining = this.AD_COOLDOWN - timeSinceLastAd;
    return Math.max(0, timeRemaining);
  }

  public getTimeUntilNextAdFormatted(): string {
    const timeRemaining = this.getTimeUntilNextAd();
    if (timeRemaining === 0) return 'Ready';
    
    const minutes = Math.ceil(timeRemaining / (60 * 1000));
    return `${minutes} min`;
  }
}

// Singleton instance
export const adService = new AdService();
