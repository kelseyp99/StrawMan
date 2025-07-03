import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  UpgradePromptModal,
  PlanModal,
} from '../../src/components/UpgradeModals';
import { synchronizeCategories } from '../../src/services/dbServices';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ToolsScreen() {
  const { isLogged, isPaid } = useAuth();
  const { isSyncing, triggerSync } = useSync();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showPlans, setShowPlans] = useState(false);

  const handleManualSync = async () => {
    try {
      await triggerSync();
      Alert.alert('Sync Complete', 'Data synced with cloud.');
    } catch (e) {
      Alert.alert('Sync Failed', 'Could not sync data.');
    }
  };

  const handleUpgrade = () => {
    setShowUpgrade(false);
    setShowPlans(true);
  };

  if (!isLogged && isPaid) {
    // Not logged in, but paid: show login
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.syncButton, isSyncing ? { opacity: 0.5 } : null]}
        onPress={handleManualSync}
        disabled={isSyncing}
      >
        <Text style={styles.syncButtonText}>
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Text>
      </TouchableOpacity>
      
      {/* Debug sync button moved from index */}
      <TouchableOpacity
        style={styles.debugButton}
        onPress={async () => {
          try {
            console.log('🔧 [DEBUG] Setting up paid user and sync...');
            await AsyncStorage.setItem('isPaidUser', 'true');
            await AsyncStorage.setItem('syncWithCloud', 'true');
            await AsyncStorage.setItem('userPlan', 'premium');
            
            console.log('🔧 [DEBUG] Triggering manual sync...');
            await triggerSync();
            
            console.log('🔧 [DEBUG] Also manually calling synchronizeCategories...');
            await synchronizeCategories('1.1.0');
            
            console.log('🔧 [DEBUG] Manual sync complete');
            
            Alert.alert('Debug', 'Sync triggered with paid user settings + category sync');
          } catch (error) {
            console.error('🔧 [DEBUG] Error:', error);
            Alert.alert('Debug Error', String(error));
          }
        }}
      >
        <Text style={styles.debugButtonText}>🔧 Enable Sync & Test Categories</Text>
      </TouchableOpacity>
      
      {!isPaid && (
        <TouchableOpacity
          style={styles.upgradeButton}
          onPress={() => setShowUpgrade(true)}
        >
          <Text style={styles.upgradeButtonText}>Upgrade Plan</Text>
        </TouchableOpacity>
      )}
      <UpgradePromptModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        onUpgrade={handleUpgrade}
      />
      <PlanModal
        visible={showPlans}
        onClose={() => setShowPlans(false)}
        onSelectPlan={(plan) => {
          setShowPlans(false);
          Alert.alert(
            'Selected Plan',
            plan === 'limited' ? '$10 Limited Plan' : '$30 Premium Plan'
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  syncButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 20,
    width: 200,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  debugButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 20,
    width: 280,
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  upgradeButton: {
    backgroundColor: '#FFD700',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    width: 200,
  },
  upgradeButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
