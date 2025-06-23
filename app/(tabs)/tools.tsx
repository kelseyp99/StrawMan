import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import ToolsButtons from '../../src/components/ui/ToolsButtons';
import { useAuth } from '../context/AuthContext';
import {
  getDiscussions,
  getActivityLogs,
  createCategoriesFromActivityLogs,
  populateCategoryId,
  synchronizeCategories,
  debugTestDataFetch,
} from '../../src/services/dbServices';

export default function ToolsScreen() {
  const { isLogged, isPaid } = useAuth();
  const [debugLoading, setDebugLoading] = useState(false);

  const handleDebugDeleteAll = async () => {
    setDebugLoading(true);
    try {
      // TODO: Add your delete all logic here
      alert('Delete All triggered');
    } finally {
      setDebugLoading(false);
    }
  };

  const handleDebugSyncAndPopulate = async () => {
    setDebugLoading(true);
    try {
      // TODO: Add your sync and populate logic here
      alert('Sync & Repopulate triggered');
    } finally {
      setDebugLoading(false);
    }
  };

  const handleCopyRealmToDownloads = async () => {
    setDebugLoading(true);
    try {
      // TODO: Add your copy realm logic here
      alert('Copy Realm to Downloads triggered');
    } finally {
      setDebugLoading(false);
    }
  };

  const handleCheckData = async () => {
    setDebugLoading(true);
    try {
      console.log('[DEBUG] Testing direct data fetch...');
      const discussions = await getDiscussions();
      console.log(
        '[DEBUG] getDiscussions returned:',
        discussions.length,
        'records'
      );
      console.log('[DEBUG] First 3 discussions:', discussions.slice(0, 3));

      const activityLogs = await getActivityLogs();
      console.log(
        '[DEBUG] getActivityLogs returned:',
        activityLogs.length,
        'records'
      );

      Alert.alert(
        'Data Check',
        'getDiscussions(): ' +
          discussions.length +
          ' discussions\n' +
          'Activity logs: ' +
          activityLogs.length
      );
    } catch (error: any) {
      console.error('[DEBUG] Error fetching data:', error);
      Alert.alert(
        'Error',
        'Failed to fetch data: ' + (error?.message || String(error))
      );
    } finally {
      setDebugLoading(false);
    }
  };

  const handleRemoveDuplicates = async () => {
    setDebugLoading(true);
    try {
      console.log(
        '[DEBUG] Remove duplicates functionality not implemented yet...'
      );
      // TODO: Implement removeDuplicateDiscussions functionality
      Alert.alert(
        'Not Implemented',
        'Remove duplicates functionality is not yet implemented.'
      );
    } catch (error: any) {
      console.error('[DEBUG] Error removing duplicates:', error);
      Alert.alert(
        'Error',
        'Failed to remove duplicates: ' + (error?.message || String(error))
      );
    } finally {
      setDebugLoading(false);
    }
  };

  const handlePopulateCategoryId = async () => {
    setDebugLoading(true);
    try {
      console.log('[DEBUG] Populating categoryId...');
      await populateCategoryId();
      Alert.alert('Success', 'Finished populating categoryId in ActivityLog.');
    } catch (error: any) {
      console.error('[DEBUG] Error populating categoryId:', error);
      Alert.alert(
        'Error',
        'Failed to populate categoryId: ' + (error?.message || String(error))
      );
    } finally {
      setDebugLoading(false);
    }
  };

  const handleCreateCategoriesFromActivityLogs = async () => {
    setDebugLoading(true);
    try {
      console.log('[DEBUG] Creating categories from ActivityLog data...');
      const result = await createCategoriesFromActivityLogs();
      Alert.alert(
        'Categories Created',
        `Successfully created ${result.created} categories from ActivityLog data.\n\n` +
          `Total unique categories found: ${result.total}\n` +
          `Created: ${result.created}\n` +
          `Skipped (already existed): ${result.skipped}\n\n` +
          `Categories: ${result.categories.slice(0, 10).join(', ')}` +
          (result.categories.length > 10 ? '...' : '')
      );
    } catch (error: any) {
      console.error(
        '[DEBUG] Error creating categories from ActivityLog:',
        error
      );
      Alert.alert(
        'Error',
        'Failed to create categories from ActivityLog: ' +
          (error?.message || String(error))
      );
    } finally {
      setDebugLoading(false);
    }
  };

  const handleSyncCategories = async () => {
    setDebugLoading(true);
    try {
      console.log('[DEBUG] Synchronizing categories...');
      await synchronizeCategories('1.1.0');
      Alert.alert('Success', 'Categories synchronized with Firebase.');
    } catch (error: any) {
      console.error('[DEBUG] Error synchronizing categories:', error);
      Alert.alert(
        'Error',
        'Failed to synchronize categories: ' + (error?.message || String(error))
      );
    } finally {
      setDebugLoading(false);
    }
  };

  const handleDebugTestDataFetch = async () => {
    setDebugLoading(true);
    try {
      console.log('[DEBUG] Testing data fetch functions...');
      await debugTestDataFetch();
      Alert.alert(
        'Debug Complete',
        'Check console for data fetch test results.'
      );
    } catch (error: any) {
      console.error('[DEBUG] Error testing data fetch:', error);
      Alert.alert(
        'Error',
        'Failed to test data fetch: ' + (error?.message || String(error))
      );
    } finally {
      setDebugLoading(false);
    }
  };

  if (!isLogged && isPaid) {
    // Not logged in, but paid: show login
    return null;
  }

  return (
    <View style={styles.container}>
      <ToolsButtons
        debugLoading={debugLoading}
        handleDebugDeleteAll={handleDebugDeleteAll}
        handleDebugSyncAndPopulate={handleDebugSyncAndPopulate}
        handleCopyRealmToDownloads={handleCopyRealmToDownloads}
        handleCheckData={handleCheckData}
        handleRemoveDuplicates={handleRemoveDuplicates}
        handleCreateCategoriesFromActivityLogs={
          handleCreateCategoriesFromActivityLogs
        }
        handlePopulateCategoryId={handlePopulateCategoryId}
        handleSyncCategories={handleSyncCategories}
        handleDebugTestDataFetch={handleDebugTestDataFetch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
