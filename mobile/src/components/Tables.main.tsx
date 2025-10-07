
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, Dimensions, Alert, StyleSheet } from 'react-native';
import { getUserVoteHistoryCloud } from '../services/voteHistoryCloud';

console.log('[DEBUG] Tables.main.tsx file loaded');

const SCREEN_WIDTH = Dimensions.get('window').width;

const MainComponent: React.FC = () => {
  console.log('[DEBUG] Tables.main.tsx MainComponent mounted');
  const [tableData, setTableData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

    // Fetch and display the logged-in user's voting history
  useEffect(() => {
    console.log('[DEBUG] useEffect running, about to call getUserVoteHistoryCloud');
    setLoading(true);
    getUserVoteHistoryCloud()
      .then((votes) => {
        console.log('[DEBUG] Raw votes from cloud function:', votes);
        const rows = votes.map((candidate) => {
          let createdAt = '';
          if (candidate.createdAt) {
            if (candidate.createdAt.toDate) {
              createdAt = candidate.createdAt.toDate().toLocaleString();
            } else if (candidate.createdAt.seconds) {
              createdAt = new Date(candidate.createdAt.seconds * 1000).toLocaleString();
            } else if (typeof candidate.createdAt === 'string' || typeof candidate.createdAt === 'number') {
              createdAt = new Date(candidate.createdAt).toLocaleString();
            }
          }
          return {
            id: candidate.id || Math.random().toString(),
            name: candidate.name || '',
            createdAt,
          };
        });
        setTableData(rows);
        setLoading(false);
      })
      .catch((err) => {
        console.log('[DEBUG] Error from getUserVoteHistoryCloud:', err);
        setError('Failed to load voting history');
        setLoading(false);
      });
  }, []);

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
        </View>
      );
    }

      console.log('[DEBUG] Tables.main.tsx MainComponent mounted');
    return (
      <View style={styles.container}>
        <Text style={styles.tableHeader}>Voting History</Text>
        {tableData.length === 0 ? (
          <Text style={styles.errorText}>No voting history found.</Text>
        ) : (
          <View>
            <View style={styles.headerRow}>
              <Text style={[styles.headerCell, { flex: 2 }]}>Name</Text>
              <Text style={[styles.headerCell, { flex: 2 }]}>Created At</Text>
            </View>
            <FlatList
              data={tableData}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => {
                console.log('[DEBUG] Rendering row:', item);
                return (
                  <View style={styles.row}>
                    <Text style={[styles.cell, { flex: 2 }]}>{item.name || '[NO NAME]'}</Text>
                    <Text style={[styles.cell, { flex: 2 }]}>{item.createdAt || '[NO CREATED AT]'}</Text>
                  </View>
                );
              }}
              style={styles.tableList}
              contentContainerStyle={styles.tableContentContainer}
              showsVerticalScrollIndicator={true}
            />
          </View>
        )}
      </View>
    );
  };
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
