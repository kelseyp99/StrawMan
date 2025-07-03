/**
 * Debug script to enable sync functionality for testing
 * Run this in the React Native debugger console or add it temporarily to your app
 */

const enableSyncForTesting = async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  
  try {
    // Set user as paid customer
    await AsyncStorage.setItem('isPaidUser', 'true');
    console.log('✅ Set isPaidUser to true');
    
    // Enable sync with cloud
    await AsyncStorage.setItem('syncWithCloud', 'true');
    console.log('✅ Set syncWithCloud to true');
    
    // Verify the settings
    const isPaid = await AsyncStorage.getItem('isPaidUser');
    const syncEnabled = await AsyncStorage.getItem('syncWithCloud');
    const isLogged = await AsyncStorage.getItem('isLogged');
    
    console.log('Current settings:');
    console.log('- isLogged:', isLogged);
    console.log('- isPaidUser:', isPaid);
    console.log('- syncWithCloud:', syncEnabled);
    
    if (isPaid === 'true' && syncEnabled === 'true' && isLogged === 'true') {
      console.log('🎉 Sync should now be enabled!');
    } else {
      console.log('⚠️ Some settings are still missing');
    }
    
  } catch (error) {
    console.error('Error setting sync preferences:', error);
  }
};

// Export for use
module.exports = { enableSyncForTesting };

// If running directly in console:
// enableSyncForTesting();
