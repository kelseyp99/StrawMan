import React from 'react';
import ToolsButtons from '../../components/ui/ToolsButtons';
import { View, Text } from 'react-native';

export default function Tools() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 40,
      }}
    >
      <ToolsButtons
        debugLoading={false}
        handleDebugDeleteAll={() => {}}
        handleDebugSyncAndPopulate={() => {}}
        handleCopyRealmToDownloads={() => {}}
        handleCheckData={() => {}}
        handleRemoveDuplicates={() => {}}
        handleCreateCategoriesFromActivityLogs={() => {}}
        handlePopulateCategoryId={() => {}}
        handleSyncCategories={() => {}}
        handleDebugTestDataFetch={() => {}}
      />
      <Text>Welcome to your Tools Page!</Text>
    </View>
  );
}
