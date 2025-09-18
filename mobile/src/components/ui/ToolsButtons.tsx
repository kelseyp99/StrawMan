import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';

interface ToolsButtonsProps {
  debugLoading: boolean;
  handleDebugDeleteAll: () => void;
  handleDebugSyncAndPopulate: () => void;
  handleCopyRealmToDownloads: () => void;
  handleCheckData: () => void;
  handleRemoveDuplicates: () => void;
  handleCreateCategoriesFromActivityLogs: () => void;
  handlePopulateCategoryId: () => void;
  handleSyncCategories: () => void;
  handleDebugTestDataFetch: () => void;
}

export default function ToolsButtons({
  debugLoading,
  handleDebugDeleteAll,
  handleDebugSyncAndPopulate,
  handleCopyRealmToDownloads,
  handleCheckData,
  handleRemoveDuplicates,
  handleCreateCategoriesFromActivityLogs,
  handlePopulateCategoryId,
  handleSyncCategories,
  handleDebugTestDataFetch,
}: ToolsButtonsProps) {
  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#ff4444' }]}
        onPress={() =>
          Alert.alert(
            'Confirm',
            'Are you sure you want to delete all local and remote ChangeLog data?',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: handleDebugDeleteAll,
              },
            ]
          )
        }
        disabled={debugLoading}
        accessibilityLabel="Delete all local and remote ChangeLog data"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          DEBUG: Delete All Local/Remote (ChangeLog)
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#007bff' }]}
        onPress={() =>
          Alert.alert(
            'Confirm',
            'Sync and repopulate Realm with 10 rows per table?',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'OK', onPress: handleDebugSyncAndPopulate },
            ]
          )
        }
        disabled={debugLoading}
        accessibilityLabel="Sync and repopulate Realm with 10 rows per table"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          DEBUG: Sync & Repopulate (10 rows/table)
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#00b894' }]}
        onPress={() =>
          Alert.alert('Confirm', 'Copy Realm DB to Downloads folder?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'OK', onPress: handleCopyRealmToDownloads },
          ])
        }
        disabled={debugLoading}
        accessibilityLabel="Copy Realm DB to Downloads folder"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>DEBUG: Copy Realm DB to Downloads</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#17a2b8' }]}
        onPress={handleCheckData}
        disabled={debugLoading}
        accessibilityLabel="Check how many discussions and activity logs are in the database"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>🔍 DEBUG: Check Data Count</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#fd7e14' }]}
        onPress={() =>
          Alert.alert(
            'Remove Duplicates',
            'Remove duplicate Discussion records based on timestamp? This will keep only one record per unique timestamp.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Remove Duplicates', onPress: handleRemoveDuplicates },
            ]
          )
        }
        disabled={debugLoading}
        accessibilityLabel="Remove duplicate Discussion records based on timestamp"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>🧹 DEBUG: Remove Duplicates</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#6f42c1' }]}
        onPress={handleCreateCategoriesFromActivityLogs}
        disabled={debugLoading}
        accessibilityLabel="Create categories from existing activity logs"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>
          DEBUG: Create Categories from Activity Logs
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#fd7e14' }]}
        onPress={handlePopulateCategoryId}
        disabled={debugLoading}
        accessibilityLabel="Populate categoryId in ActivityLog table"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>DEBUG: Populate categoryId</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#6f42c1' }]}
        onPress={handleSyncCategories}
        disabled={debugLoading}
        accessibilityLabel="Sync categories with Firebase"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>Sync Categories</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, { backgroundColor: '#dc3545' }]}
        onPress={handleDebugTestDataFetch}
        disabled={debugLoading}
        accessibilityLabel="Test data fetch functions"
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>DEBUG: Test Data Fetch</Text>
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
