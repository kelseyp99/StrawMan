import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  Modal,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useAuth } from './context/AuthContext';
import { canAccessLoginAndSync, getSubscriptionWarningLevel, getSubscriptionDaysLeft, isSubscriptionExpired } from '../src/services/planManager';

export const SettingsContext = React.createContext({
  syncWithCloud: false,
  setSyncWithCloud: (val: boolean) => {},
});

export default function SettingsScreen() {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [aiPersonalization, setAiPersonalization] = useState(true);
  const [syncWithCloud, setSyncWithCloud] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isPaidCustomer, setIsPaidCustomer] = useState(false);
  const [subscriptionWarning, setSubscriptionWarning] = useState<'none' | '30days' | '7days' | '1day' | 'expired'>('none');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const router = useRouter();
  const { isLogged, setIsLogged, setIsPaid } = useAuth();

  useEffect(() => {
    (async () => {
      const syncSetting = await AsyncStorage.getItem('syncWithCloud');
      setSyncWithCloud(syncSetting === 'true');
      // Load paid user status from storage, but only if user is logged in
      const paid = await AsyncStorage.getItem('isPaidUser');
      const shouldBePaidUser = paid === 'true' && isLogged;
      setIsPaidCustomer(shouldBePaidUser);
      
      // If paid user status doesn't match login status, update storage
      if (paid === 'true' && !isLogged) {
        await AsyncStorage.setItem('isPaidUser', 'false');
        setIsPaid(false);
      } else if (shouldBePaidUser) {
        setIsPaid(true);
      }
    })();
  }, [isLogged]);

  useEffect(() => {
    // Check subscription warning level on mount and when screen is focused
    const checkWarning = () => {
      const warning = getSubscriptionWarningLevel();
      setSubscriptionWarning(warning);
      setDaysLeft(getSubscriptionDaysLeft());
    };
    checkWarning();
    const interval = setInterval(checkWarning, 24 * 60 * 60 * 1000); // Check daily
    return () => clearInterval(interval);
  }, []);

  const handleSyncToggle = async (value: boolean) => {
    // If user tries to enable sync, check if $30 plan and route to login if needed
    if (value) {
      const canSync = await canAccessLoginAndSync();
      if (!canSync) {
        setShowUpgradeModal(true);
        return;
      }
      // If $30 plan, go to login if not logged in
      if (!isLogged) {
        router.push('/login');
        return;
      }
    }
    setSyncWithCloud(value);
    await AsyncStorage.setItem('syncWithCloud', value ? 'true' : 'false');
  };

  return (
    <SettingsContext.Provider
      value={{ syncWithCloud, setSyncWithCloud: handleSyncToggle }}
    >
      <View style={{ flex: 1, padding: 20, backgroundColor: '#fff' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
          Settings
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <Text>Enable Voice Input</Text>
          <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <Text>Dark Mode</Text>
          <Switch value={darkMode} onValueChange={setDarkMode} />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <Text>AI Personalization</Text>
          <Switch
            value={aiPersonalization}
            onValueChange={setAiPersonalization}
          />
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text>Sync with Cloud</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              {isPaidCustomer ? 'Available with paid features' : 'Requires paid features'}
            </Text>
          </View>
          <Switch value={syncWithCloud} onValueChange={handleSyncToggle} />
        </View>
        {/* Subscription Expiry Warning */}
        {subscriptionWarning !== 'none' && (
          <View style={{ backgroundColor: subscriptionWarning === 'expired' ? '#ffcccc' : '#fffbe6', padding: 10, borderRadius: 6, marginBottom: 15 }}>
            <Text style={{ color: subscriptionWarning === 'expired' ? '#b71c1c' : '#bfa100', fontWeight: 'bold' }}>
              {subscriptionWarning === 'expired'
                ? 'Your subscription has expired. Please renew to continue using paid features.'
                : `Your subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Please renew soon!`}
            </Text>
          </View>
        )}
        {/* Developer/Testing Section */}
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: '#eee',
            paddingTop: 15,
            marginTop: 15,
            marginBottom: 15,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10, color: '#666' }}>
            Developer Options
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text>Enable Paid Features</Text>
            <Text style={{ fontSize: 12, color: '#666' }}>
              Toggle to access sync & premium features
            </Text>
          </View>
          <Switch
            value={isPaidCustomer}
            onValueChange={async (value) => {
              if (value && !isLogged) {
                // Enabling paid features requires Firebase login
                Alert.alert(
                  'Login Required', 
                  'To enable paid features, you need to log in with your Firebase account. You will be redirected to the login screen.',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                      text: 'Login', 
                      onPress: () => router.push('/login')
                    }
                  ]
                );
                return;
              }
              
              if (!value) {
                // Disabling paid features - switch to local mode
                setIsPaid(false);
                await AsyncStorage.setItem('isPaidUser', 'false');
                Alert.alert(
                  'Switched to Local Mode', 
                  'You are now using local-only mode. Your data will be stored locally only.'
                );
              } else {
                // Enable paid features (user is already logged in)
                setIsPaid(true);
                await AsyncStorage.setItem('isPaidUser', 'true');
                Alert.alert(
                  'Paid Features Enabled', 
                  'You can now enable cloud sync and access premium features.'
                );
              }
              
              setIsPaidCustomer(value);
            }}
          />
        </View>
        <Modal
          visible={showUpgradeModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowUpgradeModal(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <View
              style={{
                backgroundColor: '#fff',
                padding: 30,
                borderRadius: 10,
                alignItems: 'center',
              }}
            >
              <Text
                style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}
              >
                Upgrade Required
              </Text>
              <Text style={{ marginBottom: 20 }}>
                Syncing with the cloud is available for paid users only. Please
                upgrade to enable this feature.
              </Text>
              <TouchableOpacity
                style={{
                  backgroundColor: '#007AFF',
                  padding: 10,
                  borderRadius: 5,
                }}
                onPress={() => setShowUpgradeModal(false)}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </SettingsContext.Provider>
  );
}
