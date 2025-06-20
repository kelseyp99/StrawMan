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
import * as dbServices from '../src/services/dbServices';

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

  useEffect(() => {
    (async () => {
      const syncSetting = await AsyncStorage.getItem('syncWithCloud');
      setSyncWithCloud(syncSetting === 'true');
      // TODO: Replace with real paid check
      const paid = await AsyncStorage.getItem('isPaidCustomer');
      setIsPaidCustomer(paid === 'true');
    })();
  }, []);

  useEffect(() => {
    let syncInterval: NodeJS.Timeout | null = null;
    
    const startSyncTimer = async () => {
      const syncWithCloudEnabled = await AsyncStorage.getItem('syncWithCloud');
      const isPaid = await AsyncStorage.getItem('isPaidCustomer');
      
      if (syncWithCloudEnabled === 'true' && isPaid === 'true') {
        console.log('[SETTINGS] Starting background sync timer for paid user');
        
        // Run legacy sync immediately (but don't block UI)
        setTimeout(() => {
          dbServices.syncFromRemote().catch((e) => 
            console.warn('[SETTINGS] Background legacy sync failed:', e)
          );
        }, 5000);
        
        // Then every 30 minutes for ongoing sync
        syncInterval = setInterval(() => {
          if (navigator.onLine !== false) { // Check if online
            dbServices.syncFromRemote().catch(() => {});
            dbServices.syncToCloud('Discussion').catch(() => {});
            dbServices.syncToCloud('ActivityLog').catch(() => {});
          }
        }, 30 * 60 * 1000);
      } else {
        console.log('[SETTINGS] Sync timer not started - user not paid or sync disabled');
      }
    };
    
    startSyncTimer();
    
    return () => {
      if (syncInterval) {
        clearInterval(syncInterval);
        console.log('[SETTINGS] Sync timer cleared');
      }
    };
  }, [syncWithCloud]);

  const handleSyncToggle = async (value: boolean) => {
    if (value && !isPaidCustomer) {
      setShowUpgradeModal(true);
      return;
    }
    setSyncWithCloud(value);
    await AsyncStorage.setItem('syncWithCloud', value ? 'true' : 'false');
  };

  const handleManualSync = async () => {
    if (!isPaidCustomer) {
      Alert.alert('Upgrade Required', 'Cloud sync is only available for paid users.');
      return;
    }
    
    if (!syncWithCloud) {
      Alert.alert('Sync Disabled', 'Please enable cloud sync first.');
      return;
    }
    
    try {
      Alert.alert('Syncing...', 'Starting manual sync...');
      await dbServices.syncFromRemote(); // This handles the legacy data properly
      await dbServices.syncToCloud('Discussion');
      await dbServices.syncToCloud('ActivityLog');
      Alert.alert('Sync Complete', 'Data synced with cloud successfully.');
    } catch (e) {
      console.error('Manual sync error:', e);
      Alert.alert('Sync Failed', 'Could not sync data. Please try again.');
    }
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
          <Text>Sync with Cloud</Text>
          <Switch value={syncWithCloud} onValueChange={handleSyncToggle} />
        </View>
        <TouchableOpacity
          style={{
            backgroundColor: '#007AFF',
            padding: 12,
            borderRadius: 6,
            alignItems: 'center',
            marginBottom: 15,
          }}
          onPress={handleManualSync}
          disabled={!syncWithCloud}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Sync Now</Text>
        </TouchableOpacity>
        
        {/* Debug/Testing Section */}
        <View style={{ marginBottom: 20, padding: 10, backgroundColor: '#f0f0f0', borderRadius: 6 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>Debug/Testing</Text>
          <Text style={{ marginBottom: 10 }}>
            Paid Customer: {isPaidCustomer ? 'Yes' : 'No'}
          </Text>
          <TouchableOpacity
            style={{
              backgroundColor: isPaidCustomer ? '#28a745' : '#ffc107',
              padding: 10,
              borderRadius: 6,
              alignItems: 'center',
              marginBottom: 10,
            }}
            onPress={async () => {
              const newStatus = !isPaidCustomer;
              await AsyncStorage.setItem('isPaidCustomer', newStatus ? 'true' : 'false');
              setIsPaidCustomer(newStatus);
              Alert.alert(
                'Status Updated', 
                `Paid customer status set to: ${newStatus ? 'True' : 'False'}`
              );
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
              {isPaidCustomer ? 'Set as Free User' : 'Set as Paid Customer'}
            </Text>
          </TouchableOpacity>
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
