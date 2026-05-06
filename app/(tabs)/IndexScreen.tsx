import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { getModelAPIkey } from '../../src/services/apiUtils';
import { useSync } from '../context/SyncContext';

interface IndexScreenProps { onApiKeyLoaded: (key: string | null) => void }

const IndexScreen: React.FC<IndexScreenProps> = (props) => {
  const { onApiKeyLoaded } = props;
  if (typeof onApiKeyLoaded !== 'function') {
    throw new Error('IndexScreen: onApiKeyLoaded prop is required and must be a function. Received: ' + typeof onApiKeyLoaded);
  }
  const [loading, setLoading] = useState(true);
  const { triggerSync } = useSync();

  useEffect(() => {
    async function loadApiKey() {
      try {
        const key = await getModelAPIkey();
        onApiKeyLoaded(key?.apiKey || null);
        console.log('API Key:', key ? `${key.apiKey.slice(0, 4)}...` : 'None');
      } catch (error) {
        console.error('API Key err:', error);
        onApiKeyLoaded(null);
      } finally {
        setLoading(false);
      }
    }
    loadApiKey();
    // Trigger sync on mount
    // triggerSync();
  }, [onApiKeyLoaded, triggerSync]);

  if (loading) return <ActivityIndicator size="large" color="#0000ff" />;
  return null;
};

export default IndexScreen;
