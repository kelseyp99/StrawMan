import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import RNFS from 'react-native-fs';
import {
  runAllSyncFunctions,
  deleteAllLocalAndRemoteRows,
  insertTestRowsAndExit,
} from '@/services/dbServices';

export default function DebugButtons() {
  const [debugLoading, setDebugLoading] = useState(false);

  // Handler for debug: delete all local/remote rows
  const handleDebugDeleteAll = async () => {
    setDebugLoading(true);
    try {
      await deleteAllLocalAndRemoteRows();
      Alert.alert('Debug: All local and remote ChangeLog data deleted.');
    } catch (e) {
      Alert.alert('Debug Delete Failed', e.message || String(e));
    } finally {
      setDebugLoading(false);
    }
  };

  // Handler for debug: run all syncs and repopulate Realm (10 rows per table)
  const handleDebugSyncAndPopulate = async () => {
    setDebugLoading(true);
    try {
      await insertTestRowsAndExit();
      await runAllSyncFunctions();
      Alert.alert(
        'Debug: Ran all syncs and repopulated Realm (10 rows per table).'
      );
    } catch (e) {
      Alert.alert('Debug Sync/Populate Failed', e.message || String(e));
    } finally {
      setDebugLoading(false);
    }
  };

  // TEMP: Copy Realm DB to Downloads folder
  const handleCopyRealmToDownloads = async () => {
    setDebugLoading(true);
    try {
      const realmPath = '/data/data/com.anonymous.lifelog/files/lifelog.realm';
      const downloadsPath = `${RNFS.DownloadDirectoryPath}/lifelog.realm`;
      await RNFS.copyFile(realmPath, downloadsPath);
      Alert.alert('Success', 'Realm DB copied to Downloads folder!');
    } catch (e) {
      Alert.alert('Copy Failed', e.message || String(e));
    } finally {
      setDebugLoading(false);
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'center',
        marginVertical: 12,
      }}
    >
      <TouchableOpacity
        style={{
          backgroundColor: '#ff4444',
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 5,
          marginRight: 10,
          minWidth: 120,
          alignItems: 'center',
          opacity: debugLoading ? 0.5 : 1,
        }}
        onPress={handleDebugDeleteAll}
        disabled={debugLoading}
      >
        <Text
          style={{
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          DEBUG: Delete All
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          backgroundColor: '#007bff',
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 5,
          marginRight: 10,
          minWidth: 120,
          alignItems: 'center',
          opacity: debugLoading ? 0.5 : 1,
        }}
        onPress={handleDebugSyncAndPopulate}
        disabled={debugLoading}
      >
        <Text
          style={{
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          DEBUG: Sync & Repop
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          backgroundColor: '#00b894',
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 5,
          minWidth: 120,
          alignItems: 'center',
          opacity: debugLoading ? 0.5 : 1,
        }}
        onPress={handleCopyRealmToDownloads}
        disabled={debugLoading}
      >
        <Text
          style={{
            color: '#fff',
            fontWeight: 'bold',
            fontSize: 12,
            textAlign: 'center',
          }}
        >
          DEBUG: Copy Realm DB
        </Text>
      </TouchableOpacity>
    </View>
  );
}
