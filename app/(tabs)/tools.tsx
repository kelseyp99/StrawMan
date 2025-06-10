import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ToolsButtons from '../../src/components/ui/ToolsButtons';
import { useAuth } from '../context/AuthContext';

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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
