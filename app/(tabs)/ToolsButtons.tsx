import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';

export default function ToolsButtons({
  debugLoading,
  handleDebugDeleteAll,
  handleDebugSyncAndPopulate,
  handleCopyRealmToDownloads,
}) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#ff4444' }]}
        onPress={handleDebugDeleteAll}
        disabled={debugLoading}
      >
        <Text style={styles.buttonText}>
          DEBUG: Delete All Local/Remote (ChangeLog)
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#007bff' }]}
        onPress={handleDebugSyncAndPopulate}
        disabled={debugLoading}
      >
        <Text style={styles.buttonText}>
          DEBUG: Sync & Repopulate (10 rows/table)
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#00b894' }]}
        onPress={handleCopyRealmToDownloads}
        disabled={debugLoading}
      >
        <Text style={styles.buttonText}>DEBUG: Copy Realm DB to Downloads</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    alignItems: 'center',
    marginVertical: 8,
    padding: 16,
  },
  button: {
    padding: 12,
    borderRadius: 5,
    marginBottom: 12,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
