import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { adService } from '../services/adService';

interface UseInterstitialAdOptions {
  enabled?: boolean;
  showOnFocus?: boolean;
  showAfterAction?: boolean;
  minScreenTimeBeforeAd?: number; // minimum time on screen before showing ad
}

export const useInterstitialAd = (options: UseInterstitialAdOptions = {}) => {
  const {
    enabled = true,
    showOnFocus = false,
    showAfterAction = true,
    minScreenTimeBeforeAd = 10000, // 10 seconds
  } = options;

  const [canShowAd, setCanShowAd] = useState(false);
  const [timeUntilNextAd, setTimeUntilNextAd] = useState('');
  const screenFocusTime = useRef<number>(0);
  const lastActionTime = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!enabled) return;

    screenFocusTime.current = Date.now();

    // Update ad availability status periodically
    const updateAdStatus = () => {
      setCanShowAd(adService.canShowAd());
      setTimeUntilNextAd(adService.getTimeUntilNextAdFormatted());
    };

    updateAdStatus();
    const interval = setInterval(updateAdStatus, 30000); // Check every 30 seconds

    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        showOnFocus
      ) {
        // App came to foreground, potentially show ad
        setTimeout(() => {
          tryShowAd('focus');
        }, 1000); // Small delay to avoid jarring experience
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      clearInterval(interval);
      subscription?.remove();
    };
  }, [enabled, showOnFocus]);

  const tryShowAd = async (trigger: 'action' | 'focus' | 'manual') => {
    if (!enabled || !adService.canShowAd()) {
      return false;
    }

    const now = Date.now();
    const timeSinceScreenFocus = now - screenFocusTime.current;
    const timeSinceLastAction = now - lastActionTime.current;

    // Don't show ad immediately after screen focus or action
    if (
      (trigger === 'focus' && timeSinceScreenFocus < minScreenTimeBeforeAd) ||
      (trigger === 'action' && timeSinceLastAction < 2000) // 2 second buffer after actions
    ) {
      return false;
    }

    console.log(`Attempting to show interstitial ad (trigger: ${trigger})`);
    const success = await adService.showAdIfReady();
    
    if (success) {
      setCanShowAd(false);
      console.log(`Interstitial ad shown successfully (trigger: ${trigger})`);
    }
    
    return success;
  };

  const showAdAfterAction = async () => {
    if (!showAfterAction) return false;
    
    lastActionTime.current = Date.now();
    
    // Small delay to let UI updates complete
    setTimeout(() => {
      tryShowAd('action');
    }, 500);
    
    return true;
  };

  const showAdManually = () => tryShowAd('manual');

  return {
    canShowAd,
    timeUntilNextAd,
    showAdAfterAction,
    showAdManually,
    tryShowAd,
  };
};
