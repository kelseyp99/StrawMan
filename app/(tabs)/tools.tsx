
import React, { useState } from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import {
  UpgradePromptModal,
  PlanModal,
} from '../../src/components/UpgradeModals';
import { synchronizeCategories, cleanupDuplicateCategories, synchronizeActivityLog, synchronizeDiscussions } from '../../src/services/dbServices';
import { initializeDefaultCategories } from '../../src/services/dbServicesLocal';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ToolsScreen() {
  // Default upgrade handler
  const handleUpgrade = () => {
    Alert.alert('Upgrade', 'Upgrade action triggered.');
  };
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
      {/* Force Import Discussion button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#4e8cff',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
        onPress={async () => {
          await AsyncStorage.removeItem('discussionImportCompleted');
          await synchronizeDiscussions('MVP-ForceImport');
          Alert.alert('Force Import', 'Remote Discussion import triggered.');
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>🔄 Force Import Discussion (Remote)</Text>
      </TouchableOpacity>
      {/* Force Import Category button for new installs/testing */}
      <TouchableOpacity
        style={{
          backgroundColor: '#4e8cff',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
        onPress={async () => {
          await AsyncStorage.removeItem('categoryImportCompleted');
          await synchronizeCategories('MVP-ForceImport');
          Alert.alert('Force Import', 'Remote Category import triggered.');
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>🔄 Force Import Category (Remote)</Text>
      </TouchableOpacity>
      {/* Force Import ActivityLog button for new installs/testing */}
      <TouchableOpacity
        style={{
          backgroundColor: '#4e8cff',
          padding: 12,
          borderRadius: 8,
          marginBottom: 12,
        }}
        onPress={async () => {
          await AsyncStorage.removeItem('activityLogImportCompleted');
          await synchronizeActivityLog('MVP-ForceImport');
          Alert.alert('Force Import', 'Remote ActivityLog import triggered.');
        }}
      >
        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>🔄 Force Import ActivityLog (Remote)</Text>
      </TouchableOpacity>
      {/* Category cleanup button */}
      <TouchableOpacity
        style={styles.cleanupButton}
        onPress={async () => {
          try {
            console.log('🧹 [CLEANUP] Starting category duplicate cleanup...');
            await cleanupDuplicateCategories();
            Alert.alert('Cleanup Complete', 'Duplicate categories have been removed.');
          } catch (error) {
            console.error('🧹 [CLEANUP] Error:', error);
            Alert.alert('Cleanup Error', String(error));
          }
        }}
      >
        <Text style={styles.cleanupButtonText}>🧹 Clean Duplicate Categories</Text>
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
  cleanupButton: {
    backgroundColor: '#ff6b35',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 20,
    width: 280,
  },
  cleanupButtonText: {
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