
const SCREEN_WIDTH = Dimensions.get('window').width;


  const prompt2UpdateActivityLog = useCallback(
    (discussionSnapshot: any): void => {
      // console.log(
      //   'Inside prompt2UpdateActivityLog, snapshot size:',
      //   discussionSnapshot.size
      // );
      if (!discussionSnapshot || discussionSnapshot.empty) {
        // console.log('No documents in snapshot to process.');
        return;
      }

      const unclearedDocs = discussionSnapshot.docs.filter(
        (doc: any) => doc.data().cleared === false
      );

      // console.log('Uncleared documents:', unclearedDocs.length);
      if (unclearedDocs.length === 0) {
        // console.log('No uncleared documents to process.');
        return;
      }

      const discussionList = unclearedDocs
        .map((doc: any) => `"${doc.data().description || 'No description'}"`)
        .join(', ');

      Alert.alert(
        'Update Activity Log',
        `Do you want to update the Activity Log with these discussions: ${discussionList}?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes',
            onPress: async () => {
              try {
                // console.log('Starting Activity Log update...');
                const distinctCategories = await getCategoryNames();
                if (!uid) {
                  console.error(
                    'User ID is null, cannot proceed with ActivityLog update.'
                  );
                  Alert.alert(
                    'Error',
                    'User ID not found. Please sign in again.'
                  );
                  return;
                }

                for (const docSnapshot of unclearedDocs) {
                  const discussionTyped = {
                    id: docSnapshot.id,
                    discussionId: docSnapshot.data().id || docSnapshot.id,
                    description: docSnapshot.data().description || '',
                    timestamp:
                      docSnapshot.data().timestamp?.toDate() || new Date(),
                    typeSay: docSnapshot.data().typeSay || 'tell',
                    cleared: docSnapshot.data().cleared || false,
                  };
                  if (!discussionTyped.cleared) {
                    // console.log('Processing Discussion:', discussionTyped.id);
                    const activityAnalysis = await processPhrase(
                      discussionTyped.description,
                      distinctCategories,
                      // removed discussionCounts,
                      // removed setDiscussionCounts,
                      discussionTyped.id,
                      uid
                    );
                    await addOrUpdateGPTResponse(
                      discussionTyped.id,
                      JSON.stringify(activityAnalysis),
                      'updateDB'
                    );

                    // Check for existing ActivityLog entry
                    const existingLog = await findDuplicateActivityLog(
                      discussionTyped.id,
                      activityAnalysis.category,
                      activityAnalysis.parsedDescription,
                      uid
                    );
                    let newActivityLogId: string;
                    if (existingLog) {
                      // Use router to update existing ActivityLog entry (calls all pending updates)
                      await addOrUpdateActivityLog(); // No parameters allowed
                      newActivityLogId = String(existingLog.id);
                      await fetchData(); // Refresh after edit
                      // console.log(
                      //   `Updated existing ActivityLog entry ${existingLog.id} for discussionId ${discussionTyped.id}`
                      // );
                    } else {
                      // Use router to create new ActivityLog entry
                      const newLog = {
                        discussionId: String(discussionTyped.id), // ensure string type
                        category:
                          activityAnalysis.category !== 'uncategorized'
                            ? activityAnalysis.category
                            : 'uncategorized',
                        description: activityAnalysis.parsedDescription,
                        timestamp: discussionTyped.timestamp,
                        cleared: false,
                        uid: uid,
                        lockedCategory: false,
                        lockedDescription: false,
                        synced: false,
                      };
                      newActivityLogId = await createActivityLog(newLog);
                      await fetchData(); // Refresh after create
                      // console.log(
                      //   `Created new ActivityLog entry ${newActivityLogId} for discussionId ${discussionTyped.id}`
                      // );
                    }

                    // Replace direct Firestore/Realm calls with router function
                    await markDiscussionAsCleared(discussionTyped.id);
                  }
                }
                // console.log('Activity Log update completed successfully.');
                Alert.alert(
                  'Success',
                  `${unclearedDocs.length} Activity Log entries updated successfully!`
                );
                fetchData(); // Refresh tables after update
              } catch (error) {
                console.error('Error updating Activity Log:', error);
                Alert.alert(
                  'Error',
                  `Failed to update Activity Log: ${(error as any).message}`
                );
              }
            },
          },
        ],
        { cancelable: true }
      );
    },
  [uid, fetchData]
  );

  const handleSort = useCallback((column: string) => {
    setSortBy((prev) => {
      const newOrder =
        prev?.column === column && prev.order === 'asc' ? 'desc' : 'asc';
      return { column, order: newOrder };
    });
  }, []);
  const sortedData = useCallback(() => {
    if (!sortBy || tableData.length === 0) return tableData;
    const { column, order } = sortBy;
    return [...tableData].sort((a, b) => {
      if (column === 'timestamp' && a.rawTimestamp && b.rawTimestamp) {
        const timeA = a.rawTimestamp.getTime();
        const timeB = b.rawTimestamp.getTime();
        return order === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const valueA = a[column] || '';
      const valueB = b[column] || '';
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return order === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      return order === 'asc' ? (valueA > valueB ? 1 : -1) : valueA < valueB ? 1 : -1;
    });
  }, [sortBy, tableData]);
  const filteredData = useCallback(() => {
    let data = [...tableData];
    if (filters.timestamp) {
      data = data.filter((row) => String(row.timestamp).toLowerCase().includes(filters.timestamp.toLowerCase()));
    }
    if (filters.description) {
      data = data.filter((row) => String(row.description).toLowerCase().includes(filters.description.toLowerCase()));
    }
    if (sortBy) {
      data = data.sort((a, b) => {
        const aValue = a[sortBy.column];
        const bValue = b[sortBy.column];
        if (aValue < bValue) return sortBy.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortBy.order === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [tableData, filters, sortBy]);

  // Get item layout for FlatList optimization
  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: 48,
      offset: 48 * index,
      index,
    }),
    []
  );

  // Show upgrade modal every 5th entry for free users
  useEffect(() => {
    if (isPaid) return; // Only for free users
    const incrementEntryCount = async () => {
      try {
        let count = parseInt(
          (await AsyncStorage.getItem('mainTableEntryCount')) || '0',
          10
        );
        count = isNaN(count) ? 1 : count + 1;
        await AsyncStorage.setItem('mainTableEntryCount', count.toString());
        if (count % 5 === 0) {
          setShowUpgradePrompt(true);
        }
      } catch (e) {
        // ignore
      }
    };
    incrementEntryCount();
  }, []); // Only on mount

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableOpacity
        style={[styles.syncButton, isSyncing ? { opacity: 0.5 } : null]}
        onPress={triggerSync}
        disabled={isSyncing}
      >
        <Text style={styles.syncButtonText}>
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Text>
      </TouchableOpacity>
      <View style={styles.tableContainer}>
        <Text style={styles.tableHeader}>History</Text>
        <View style={styles.filterRow}>
          {[{ Header: 'Date', accessor: 'timestamp', flex: 1 }, { Header: 'Desc', accessor: 'description', style: styles.leftAlignCell, flex: 2 }].map((col) => (
            <TextInput
              key={col.accessor}
              style={[styles.filterInput, { flex: col.flex }]}
              placeholder={`Filter ${col.Header}`}
              value={typeof filters[col.accessor] === 'string' ? filters[col.accessor] : filters[col.accessor]?.toString() || ''}
              onChangeText={(text) => setFilters((prev) => ({ ...prev, [col.accessor]: text }))}
            />
          ))}
        </View>
        <View style={styles.headerRow}>
          {[{ Header: 'Date', accessor: 'timestamp', flex: 1 }, { Header: 'Desc', accessor: 'description', style: styles.leftAlignCell, flex: 2 }].map((col) => (
            <TouchableOpacity
              key={col.accessor}
              onPress={() => setSortBy((prev) => prev && prev.column === col.accessor ? { column: col.accessor, order: prev.order === 'asc' ? 'desc' : 'asc' } : { column: col.accessor, order: 'asc' })}
              style={[styles.headerCell, { flex: col.flex }]}
            >
              <Text style={styles.headerText}>
                {col.Header}{' '}
                {sortBy?.column === col.accessor
                  ? sortBy.order === 'asc'
                    ? '▲'
                    : '▼'
                  : ''}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {filteredData().length === 0 ? (
          <Text style={styles.errorText}>No history data found. Try voting or adding activities.</Text>
        ) : (
          <FlatList
            data={filteredData()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RowItem
                item={item}
                columns={[{ Header: 'Date', accessor: 'timestamp', flex: 1 }, { Header: 'Desc', accessor: 'description', style: styles.leftAlignCell, flex: 2 }]}
                renderRightActions={() => <View />}
                renderLeftActions={() => <View />}
              />
            )}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            style={styles.tableList}
            contentContainerStyle={styles.tableContentContainer}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            bounces={true}
            overScrollMode="always"
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );

const MainComponent: React.FC = () => {
  // ...existing code...
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    backgroundColor: '#f9f9f9',
    justifyContent: 'flex-start', // align content to top
    // Removed alignItems: 'flex-start' to allow full width
  },
  tableContainer: {
    flex: 1, // Re-enabled for proper scrolling
    width: SCREEN_WIDTH - 20,
    alignSelf: 'center',
    justifyContent: 'flex-start', // ensure table content starts at top
    alignItems: 'flex-start',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
    width: '100%',
  },
  navButton: {
    padding: 8,
    marginHorizontal: 5,
    backgroundColor: '#ddd',
    borderRadius: 5,
  },
  navButtonActive: {
    backgroundColor: '#007bff',
  },
  navButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 8,
    width: '100%',
  },
  filterInput: {
    padding: 4,
    marginHorizontal: 2,
    borderWidth: 1,
    borderRadius: 5,
    borderColor: '#ccc',
    fontSize: 12,
  },
  tableHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f2f2f2',
    padding: 6,
    width: '100%',
  },
  headerCell: {
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 4,
  },
  headerText: {
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
    padding: 6,
    backgroundColor: '#fff',
    width: '100%',
    minHeight: 48,
  },
  cell: {
    textAlign: 'center',
    fontSize: 12,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  leftAlignCell: {
    textAlign: 'left',
  },
  tableList: {
    flex: 1, // Allow table to take available space
    width: '100%',
    alignSelf: 'stretch',
    minHeight: 200, // Minimum height to ensure scrolling works
  },
  tableContentContainer: {
    paddingBottom: 20,
    flexGrow: 1,
  },
  categoryListContainer: {
    maxHeight: 300, // Limit height to ensure scrolling
    marginBottom: 20,
  },
  categoryListContent: {
    paddingBottom: 10,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  modalDeleteButton: {
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 5,
    height: 32,
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  editButton: {
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
  },
  categoryModalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 5,
  },
  modalInput: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 6,
    marginBottom: 8,
    minHeight: 60,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalLabel: {
    fontSize: 12,
    marginRight: 6,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 8,
  },
  modalButton: {
    padding: 6,
    borderRadius: 5,
    backgroundColor: '#ddd',
    width: '45%',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#007bff',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  relatedLogsContainer: {
    width: '100%',
    marginVertical: 8,
  },
  relatedLogEntry: {
    marginBottom: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 5,
  },
  categoryText: {
    fontSize: 12,
  },
  categorySelectButton: {
    padding: 6,
    backgroundColor: '#007bff',
    borderRadius: 5,
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
  },
  errorText: {
    fontSize: 16,
    color: '#ff4444',
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  createButton: {
    backgroundColor: '#28a745', // A green color for creation
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: 'center',
    marginBottom: 10,
    marginTop: 5,
     },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  categoryItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  categoryItemText: {
    fontSize: 16,
    textAlign: 'center',
  },
  syncButton: {
    padding: 10,
    backgroundColor: '#007bff',
    borderRadius: 5,
    alignSelf: 'center',
    marginBottom: 10,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default MainComponent;
