import React from 'react';
import { View, StyleSheet, Alert, TouchableOpacity, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';

export default function ToolsScreen() {
  const { isLogged, isPaid } = useAuth();
  const { isSyncing, triggerSync } = useSync();

  const handleManualSync = async () => {
    try {
      await triggerSync();
      Alert.alert('Sync Complete', 'Data synced with cloud.');
    } catch (e) {
      Alert.alert('Sync Failed', 'Could not sync data.');
    }
  };

  if (!isLogged && isPaid) {
    // Not logged in, but paid: show login
    return null;
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.syncButton,
          isSyncing ? { opacity: 0.5 } : null,
        ]}
        onPress={handleManualSync}
        disabled={isSyncing}
      >
        <Text style={styles.syncButtonText}>
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Text>
      </TouchableOpacity>
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
});
