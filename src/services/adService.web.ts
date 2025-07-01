// Web-compatible ad service implementation (no ads on web)
import AsyncStorage from '@react-native-async-storage/async-storage';

class AdService {
  private lastAdTimestamp = 0;
  private readonly AD_COOLDOWN = 30 * 60 * 1000; // 30 minutes in milliseconds
  private readonly STORAGE_KEY = 'lastAdTimestamp';

  constructor() {
    this.loadLastAdTimestamp();
    console.log('AdService: Web version initialized (no ads will be shown)');
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
      await AsyncStorage.setItem(
        this.STORAGE_KEY,
        this.lastAdTimestamp.toString()
      );
    } catch (error) {
      console.warn('Failed to save last ad timestamp:', error);
    }
  }

  public canShowAd(): boolean {
    // On web, we never show ads but maintain the cooldown logic for consistency
    return false;
  }

  public async showAdIfReady(): Promise<boolean> {
    // On web, simulate showing an ad but don't actually show anything
    console.log('AdService: Would show ad on native platform');
    await this.saveLastAdTimestamp();
    return false; // No ad shown on web
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
