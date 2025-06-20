import React, { useState, useEffect, memo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Alert,
  Switch,
  ScrollView,
  Dimensions,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parse, isToday, format } from 'date-fns';
import {
  getActivityLogs,
  getDiscussions,
  markDiscussionAsCleared,
  createActivityLog,
  updateActivityLogCategory,
  createRuleCandidate,
  deleteActivityLog,
  deleteDiscussion,
  addOrUpdateDiscussion,
  deleteAllLocalAndRemoteRows,
  insertTestRowsAndExit,
  runAllSyncFunctions,
  getDistinctCategories,
  addOrUpdateGPTResponse,
  addOrUpdateActivityLog,
} from '../services/dbServices';
import { extractAndImportLegacyFirestoreData } from '../services/dbServicesRemote';
import { findDuplicateActivityLog } from '../services/phraseProcessor';
import RNFS from 'react-native-fs';
import { getUID } from '../utils/uidManager';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { processPhrase } from '../services/phraseProcessor';

// Screen width for responsive design
const SCREEN_WIDTH = Dimensions.get('window').width;

// Interface for DiscussionCounts document
interface DiscussionCount {
  discussionID: string;
  activityLogId: string;
  count: number;
}

// Interface for ActivityLog document
interface ActivityLog {
  id: string;
  discussionId: string;
  description: string;
  category: string;
  timestamp: any; // Firestore Timestamp
  cleared: boolean;
  uid: string;
  lockedCategory?: boolean;
  lockedDescription?: boolean;
}

interface SwipeableTablePropsType {
  name: string;
  data: any[];
  columns: {
    Header: string;
    accessor: string;
    hidden?: boolean;
    style?: any;
    flex?: number;
  }[];
}

// Helper to show 'Today' for today's date in Discussion Data
function mapDiscussionRow(row: any) {
  let dateObj: Date;
  try {
    if (!row.timestamp) {
      throw new Error('Missing timestamp');
    }
    if (typeof row.timestamp === 'string') {
      // Try parsing with date-fns for the expected format: M/d/yy  h:mm a
      dateObj = parse(row.timestamp, 'M/d/yy  h:mm a', new Date());
      if (isNaN(dateObj.getTime())) {
        // Try fallback with single space (in case of inconsistent spacing)
        dateObj = parse(
          row.timestamp.replace(/\s+/g, ' '),
          'M/d/yy h:mm a',
          new Date()
        );
      }
    } else if (typeof row.timestamp === 'number') {
      dateObj = new Date(row.timestamp);
    } else if (row.timestamp instanceof Date) {
      dateObj = row.timestamp;
    } else {
      throw new Error('Unknown timestamp type');
    }
    if (isNaN(dateObj.getTime())) {
      throw new Error('Invalid date');
    }
  } catch (e) {
    console.warn('[mapDiscussionRow] Invalid timestamp for row', row, e);
    dateObj = new Date();
  }
  return {
    ...row,
    timestamp: isToday(dateObj) ? 'Today' : format(dateObj, 'M/d/yy \n h:mm a'),
    rawTimestamp: dateObj,
    cleared: row.cleared ? '✔️ Yes' : '❌ No', // Ensure cleared is formatted for display
  };
}

// Memoized RelatedLogEntry
const RelatedLogEntry = memo(
  ({
    log,
    description,
    onDescriptionChange,
    onCategoryChange,
    onDelete,
  }: {
    log: ActivityLog;
    description: string;
    onDescriptionChange: (id: string, text: string) => void;
    onCategoryChange: (id: string) => void;
    onDelete: (id: string) => void;
  }) => {
    //console.log(`Rendering RelatedLogEntry for ID: ${log.id}`);
    return (
      <View style={styles.relatedLogEntry}>
        <Text style={styles.modalLabel}>ID: {log.id}</Text>
        <TouchableOpacity onPress={() => onCategoryChange(log.id)}>
          <Text style={styles.modalLabel}>Category: {log.category}</Text>
        </TouchableOpacity>
        <TextInput
          style={styles.modalInput}
          value={description}
          onChangeText={(text) => onDescriptionChange(log.id, text)}
          multiline
          placeholder="Edit Activity Log description"
        />
        <TouchableOpacity
          style={styles.modalDeleteButton}
          onPress={() => onDelete(log.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.log.id === nextProps.log.id &&
      prevProps.description === nextProps.description &&
      prevProps.log.category === nextProps.log.category
    );
  }
);

// Memoized RowItem for FlatList
const RowItem = memo(
  ({
    item,
    columns,
    renderRightActions,
    renderLeftActions,
  }: {
    item: any;
    columns: {
      Header: string;
      accessor: string;
      hidden?: boolean;
      style?: any;
      flex?: number;
    }[];
    renderRightActions: (tableName: string, itemId: string) => JSX.Element;
    renderLeftActions: (
      tableName: string,
      itemId: string,
      currentDesc: string,
      currentCleared: string,
      currentTypeSay: string
    ) => JSX.Element;
  }) => {
    // console.log(`Rendering RowItem for ID: ${item.id}`);
    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item.tableName, item.id)}
        renderLeftActions={() =>
          renderLeftActions(
            item.tableName,
            item.id,
            item.description,
            item.cleared,
            item.typeSay
          )
        }
      >
        <View style={styles.row}>
          {columns.map((col) =>
            !col.hidden ? (
              <Text
                key={`${item.id}-${col.accessor}`}
                style={[styles.cell, col.style, { flex: col.flex }]}
              >
                {item[col.accessor] ?? 'N/A'}
              </Text>
            ) : null
          )}
        </View>
      </Swipeable>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.description === nextProps.item.description &&
      prevProps.item.cleared === nextProps.item.cleared &&
      prevProps.item.typeSay === nextProps.item.typeSay
    );
  }
);

const MainComponent: React.FC = () => {
  const [tables, setTables] = useState<SwipeableTablePropsType[]>([]);
  const [sortBy, setSortBy] = useState<{
    column: string;
    order: 'asc' | 'desc';
  } | null>(null);
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDesc, setEditDesc] = useState('');
  const [originalDesc, setOriginalDesc] = useState('');
  const [editCleared, setEditCleared] = useState(false);
  const [editTypeSay, setEditTypeSay] = useState<'ask' | 'tell'>('tell');
  const [editTimestamp, setEditTimestamp] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editTableName, setEditTableName] = useState('');
  const [editItemId, setEditItemId] = useState('');
  const [discussionSnapshot, setDiscussionSnapshot] = useState<any>(null);
  const [relatedActivityLogs, setRelatedActivityLogs] = useState<ActivityLog[]>(
    []
  );
  const [activityLogDescriptions, setActivityLogDescriptions] = useState<{
    [key: string]: string;
  }>({});
  const [activityLogCategories, setActivityLogCategories] = useState<{
    [key: string]: string;
  }>({});
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedActivityLogId, setSelectedActivityLogId] = useState<
    string | null
  >(null);
  const [allCategories, setAllCategories] = useState<string[]>([
    'Blood Pressure',
  ]);
  const [newCategory, setNewCategory] = useState('');
  const [discussionCounts, setDiscussionCounts] = useState<
    (DiscussionCount & { description: string })[]
  >([]);
  const [uid, setUid] = useState<string | null>(null);
  // Add state for legacy import loading
  const [importingLegacy, setImportingLegacy] = useState(false);
  // Debug: state for debug button loading
  const [debugLoading, setDebugLoading] = useState(false);

  // Fetch UID once on mount
  useEffect(() => {
    const fetchUid = async () => {
      const userId = await getUID();
      setUid(userId);
      if (!userId) {
        setError('User ID not found. Please sign in again.');
        setLoading(false);
      }
    };
    fetchUid();
  }, []);  // Fetch data using dbServices router
  const fetchData = useCallback(async () => {
    if (!uid) {
      console.log('[TABLES] No UID available, skipping fetch');
      return;
    }
    try {
      setLoading(true);
      console.log('[TABLES] Fetching data for uid:', uid);
      
      const activityLogRaw = await getActivityLogs();
      console.log('[TABLES] Raw activity logs count:', activityLogRaw.length);
      console.log('[TABLES] First few activity logs:', activityLogRaw.slice(0, 3));
      
      // Check UIDs in the data
      if (activityLogRaw.length > 0) {
        const uids = [...new Set(activityLogRaw.map((log: any) => log.uid))];
        console.log('[TABLES] Unique UIDs in activity logs:', uids);
        console.log('[TABLES] Current user UID:', uid);
      }
      
      //    console.log('[DEBUG] All ActivityLog from Realm:', activityLogRaw); // Removed
      // TEMP: Remove uid filter for debug
      // const activityLogData = activityLogRaw.filter((doc: any) => doc.uid === uid)
      // Convert Date objects to string for rendering
      const activityLogData = activityLogRaw
        .map((log: any) => ({
          ...log,
          timestamp:
            log.timestamp instanceof Date
              ? format(log.timestamp, 'M/d/yy \n h:mm a')
              : typeof log.timestamp === 'string'
              ? log.timestamp
              : String(log.timestamp),
        }))
        .sort(
          (a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        
      const discussionRaw = await getDiscussions();
      console.log('[TABLES] Raw discussions count:', discussionRaw.length);
      console.log('[TABLES] First few discussions:', discussionRaw.slice(0, 3));
      
      const discussionData = discussionRaw
        .map(mapDiscussionRow)
        .sort((a: any, b: any) => b.rawTimestamp - a.rawTimestamp);
        
      console.log('[TABLES] Processed activity logs count:', activityLogData.length);
      console.log('[TABLES] Processed discussions count:', discussionData.length);
      const categories = await getDistinctCategories();
      setAllCategories((prev) => [...new Set([...prev, ...categories])]);
      setTables([
        {
          name: 'Activity Log Data',
          columns: [
            { Header: 'ID', accessor: 'id', hidden: true },
            { Header: 'Date', accessor: 'timestamp', flex: 1 },
            {
              Header: 'Category',
              accessor: 'category',
              style: styles.leftAlignCell,
              flex: 1,
            },
            {
              Header: 'Desc',
              accessor: 'description',
              style: styles.leftAlignCell,
              flex: 2,
            },
            {
              Header: 'Cleared',
              accessor: 'cleared',
              hidden: true,
              style: styles.leftAlignCell,
            },
          ],
          data: activityLogData,
        },
        {
          name: 'Discussion Data',
          columns: [
            { Header: 'ID', accessor: 'id', hidden: true },
            { Header: 'Date', accessor: 'timestamp', flex: 1 },
            {
              Header: 'Type',
              accessor: 'typeSay',
              style: styles.leftAlignCell,
              flex: 1,
            },
            {
              Header: 'Desc',
              accessor: 'description',
              style: styles.leftAlignCell,
              flex: 2,
            },
            {
              Header: 'Cleared',
              accessor: 'cleared',
              style: styles.leftAlignCell,
              flex: 1,
            },
          ],          data: discussionData,
        },
      ]);
      
      console.log('[TABLES] Setting tables with data:');
      console.log('[TABLES] Activity Log table will have', activityLogData.length, 'rows');
      console.log('[TABLES] Discussion table will have', discussionData.length, 'rows');
      
      setInitialized(true);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to fetch data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) {
      // console.log('Mounting MainComponent, fetching data...');
      fetchData();
    }
  }, [uid, fetchData]);

  useEffect(() => {
    if (initialized && currentTableIndex === 0 && discussionSnapshot) {
      // console.log(
      //   'Triggering prompt2UpdateActivityLog with snapshot size:',
      //   discussionSnapshot?.size
      // );
      prompt2UpdateActivityLog(discussionSnapshot);
    }
  }, [currentTableIndex, initialized, discussionSnapshot]);

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
            onPress: async () => {              try {
                // console.log('Starting Activity Log update...');
                const distinctCategories = await getDistinctCategories();
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
                      docSnapshot.data().timestamp?.toDate() || new Date(),                    typeSay: docSnapshot.data().typeSay || 'tell',
                    cleared: docSnapshot.data().cleared || false,
                  };
                  
                  if (!discussionTyped.cleared) {
                    // console.log('Processing Discussion:', discussionTyped.id);
                    const activityAnalysis = await processPhrase(
                      discussionTyped.description,
                      distinctCategories,
                      discussionCounts,
                      setDiscussionCounts,
                      discussionTyped.id,
                      'local-user'
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
                    if (existingLog) {                      // Use router to update existing ActivityLog entry (calls all pending updates)
                      await addOrUpdateActivityLog(); // No parameters allowed
                      newActivityLogId = String(existingLog.id);
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
                        synced: false,                      };
                      newActivityLogId = await createActivityLog(newLog);
                      // console.log(
                      //   `Created new ActivityLog entry ${newActivityLogId} for discussionId ${discussionTyped.id}`
                      // );
                    }

                    // Replace direct Firestore/Realm calls with router function
                    await markDiscussionAsCleared(discussionTyped.id);                  }
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
    [uid, discussionCounts, fetchData]
  );

  const handleSort = useCallback((column: string) => {
    setSortBy((prev) => {
      const newOrder =
        prev?.column === column && prev.order === 'asc' ? 'desc' : 'asc';
      return { column, order: newOrder };
    });
  }, []);

  const sortedData = useCallback(() => {
    /*     console.log(
      'Current table index:',
      currentTableIndex,
      'sortBy:',
      sortBy,
      'tables.length:',
      tables.length
    ); */    if (!sortBy || tables.length === 0)
      return tables[currentTableIndex]?.data || [];
    const { column, order } = sortBy;
    // console.log(
    //   `Sorting by column: ${column}, order: ${order}, currentTableIndex: ${currentTableIndex}`
    // );
    return [...tables[currentTableIndex].data].sort((a, b) => {
      const valueA = a[column] || '';
      const valueB = b[column] || '';
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        return order === 'asc'
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }
      return order === 'asc'
        ? valueA > valueB
          ? 1
          : -1
        : valueA < valueB
        ? 1
        : -1;
    });
  }, [sortBy, tables, currentTableIndex]);
  const filteredData = useCallback(() => {
    /*  console.log(
      'Current table index:',
      currentTableIndex,
      'tables.length:',
      tables.length
    ); */
    if (tables.length === 0) {
      console.log('[TABLES] No tables available, returning empty array');
      return sortedData();
    }
    
    const sorted = sortedData();
    console.log('[TABLES] Sorted data count:', sorted.length);
    
    //console.log('Filtered data before applying filters:', sortedData());
    const data = sorted.filter((row) =>
      Object.entries(filters).every(([column, value]) =>
        row[column]
          ?.toString()
          .toLowerCase()
          .includes((value || '').toString().toLowerCase())
      )
    );
    
    console.log('[TABLES] Filtered data count:', data.length);
    console.log('[TABLES] Applied filters:', filters);
    
    /*  console.log(
      'Filtered data:',
      data.map((item) => item.id)
    ); */
    return data;
  }, [tables, filters, sortBy, currentTableIndex, sortedData]);

  const handleDelete = useCallback(
    async (tableName: string, itemId: string) => {
      try {
        if (tableName === 'Activity Log Data') {
          await deleteActivityLog(itemId);
        } else {
          await deleteDiscussion(itemId);
        }
        setTables((prevTables) =>
          prevTables.map((table) =>
            table.name === tableName
              ? {
                  ...table,
                  data: table.data.filter((item) => item.id !== itemId),
                }
              : table.name === 'Activity Log Data' &&
                tableName === 'Discussion Data'
              ? {
                  ...table,
                  data: table.data.filter(
                    (item) => item.discussionId !== itemId
                  ),
                }
              : table
          )
        );
        setDiscussionCounts((prev) =>
          prev.filter(
            (count) =>
              count.discussionID !== itemId && count.activityLogId !== itemId
          )
        );
        Alert.alert('Success', 'Item and related data deleted successfully.');
        fetchData();
      } catch (error) {
        console.error('Error deleting item:', error);
        Alert.alert('Error', 'Failed to delete item.');
      }
    },
    [uid, fetchData]
  );

  const handleEdit = useCallback(
    async (
      tableName: string,
      itemId: string,
      currentDesc: string,
      currentCleared: string,
      currentTypeSay: string
    ) => {
      setEditTableName(tableName);
      setEditItemId(itemId);
      setEditDesc(currentDesc || '');
      setOriginalDesc(currentDesc || '');
      setEditCleared(currentCleared === '✔️ Yes');
      setEditTypeSay(currentTypeSay === 'ask' ? 'ask' : 'tell');
      const table = tables.find((t) => t.name === tableName);
      const item = table?.data.find((i) => i.id === itemId);
      setEditTimestamp(item?.rawTimestamp || new Date());

      let descriptionToProcess = currentDesc || '';
      let discussionId = itemId;

      try {
        // Use router to get activity logs
        const activityLogs = await getActivityLogs();
        if (tableName === 'Discussion Data') {
          const relatedLogs = activityLogs.filter(
            (log: any) => log.discussionId === itemId
          );
          setRelatedActivityLogs(relatedLogs);
          const descriptions = relatedLogs.reduce((acc: any, log: any) => {
            acc[log.id] = log.description || '';
            return acc;
          }, {});
          const categories = relatedLogs.reduce((acc: any, log: any) => {
            acc[log.id] = log.category || 'uncategorized';
            return acc;
          }, {});
          setActivityLogDescriptions(descriptions);
          setActivityLogCategories(categories);
        } else if (tableName === 'Activity Log Data') {
          const activityLog = activityLogs.find(
            (log: any) => log.id === itemId
          );
          if (activityLog) {
            discussionId = activityLog.discussionId;
            // Use router to get discussions
            const discussions = await getDiscussions();
            const relatedDiscussion = discussions.find(
              (d: any) => d.id === discussionId
            );
            if (relatedDiscussion) {
              descriptionToProcess = relatedDiscussion.description || '';
              const relatedLogs = activityLogs.filter(
                (log: any) =>
                  log.discussionId === discussionId && log.id !== itemId
              );
              setRelatedActivityLogs(relatedLogs);
              const descriptions = relatedLogs.reduce((acc: any, log: any) => {
                acc[log.id] = log.description || '';
                return acc;
              }, {});
              const categories = relatedLogs.reduce((acc: any, log: any) => {
                acc[log.id] = log.category || 'uncategorized';
                return acc;
              }, {});
              setActivityLogDescriptions(descriptions);
              setActivityLogCategories(categories);
            }
          }
        }

        if (descriptionToProcess && uid) {          const activityAnalysis = await processPhrase(
            descriptionToProcess,
            allCategories,
            discussionCounts,
            setDiscussionCounts,
            discussionId,
            uid
          );

          if (activityAnalysis.category !== 'uncategorized') {
            // Use router to get all logs for this discussion
            const allLogs = await getActivityLogs();
            const existingLogs = allLogs.filter(
              (log: any) => log.discussionId === discussionId
            );

            if (existingLogs.length === 0) {
              // Check for duplicate before creating
              const existingLog = await findDuplicateActivityLog(
                discussionId,
                activityAnalysis.category,
                activityAnalysis.parsedDescription,
                uid
              );

              let newActivityLogId: string;
              if (existingLog) {
                // Use router to update existing ActivityLog entry (calls all pending updates)
                await addOrUpdateActivityLog(); // No parameters allowed
                newActivityLogId = String(existingLog.id);
                console.log(
                  `Updated existing ActivityLog entry ${existingLog.id} for discussionId ${discussionId}`
                );
              } else {
                // Use router to create new ActivityLog entry
                const newLog = {
                  discussionId: String(editItemId), // ensure string type for discussionId
                  category:
                    activityLogCategories[editItemId] || 'uncategorized',
                  description: editDesc,
                  timestamp: editTimestamp,
                  cleared: editCleared,
                  uid: uid,
                  lockedCategory: false,
                  lockedDescription: false,
                  synced: false,
                  typeSay: editTypeSay, // add typeSay to match ActivityLog shape if needed
                };
                newActivityLogId = await createActivityLog(newLog);
                console.log(
                  `Created new ActivityLog entry ${newActivityLogId} for discussionId ${discussionId}`
                );
              }

              setRelatedActivityLogs((prev) => [
                ...prev,
                {
                  id: newActivityLogId,
                  discussionId: discussionId,
                  category: activityAnalysis.category,
                  description: activityAnalysis.parsedDescription,
                  timestamp: editTimestamp,
                  cleared: false,
                  uid: uid,
                  lockedCategory: false,
                  lockedDescription: false,
                },
              ]);
              setActivityLogDescriptions((prev) => ({
                ...prev,
                [newActivityLogId]: activityAnalysis.parsedDescription,
              }));
              setActivityLogCategories((prev) => ({
                ...prev,
                [newActivityLogId]: activityAnalysis.category,
              }));
            }

            // Mark discussion as cleared using router
            await markDiscussionAsCleared(discussionId);
            setEditCleared(true);
          }
        }
      } catch (error) {
        console.error('Error fetching related ActivityLog entries:', error);
        setRelatedActivityLogs([]);
        setActivityLogDescriptions({});
        setActivityLogCategories({});
        Alert.alert('Error', 'Failed to fetch related entries.');
      }

      setEditModalVisible(true);
    },
    [tables, allCategories, discussionCounts, uid, editTimestamp]
  );

  const handleCategorySelect = useCallback(
    async (category: string) => {
      if (!selectedActivityLogId) return;

      try {
        setRelatedActivityLogs((prev) =>
          prev.map((log) =>
            log.id === selectedActivityLogId
              ? { ...log, category, lockedCategory: true }
              : log
          )
        );
        setActivityLogCategories((prev) => ({
          ...prev,
          [selectedActivityLogId]: category,
        }));

        // Use router to update ActivityLog category
        await updateActivityLogCategory(selectedActivityLogId, category);
        console.log(
          `Updated ActivityLog ${selectedActivityLogId} category to ${category}`
        );

        if (!allCategories.includes(category)) {
          setAllCategories((prev) => [...prev, category]);
        }

        // Use router to create RuleCandidate
        await createRuleCandidate({
          discussionId: editItemId,
          category,
          description: activityLogDescriptions[selectedActivityLogId] || '',
          uid: uid!,
        });

        // Use router to mark discussion as cleared
        await markDiscussionAsCleared(editItemId);
        setEditCleared(true);

        setCategoryModalVisible(false);
        setNewCategory('');
        setSelectedActivityLogId(null);
      } catch (error) {
        console.error('Error updating category:', error);
        Alert.alert('Error', 'Failed to update category.');
      }
    },
    [
      selectedActivityLogId,
      activityLogDescriptions,
      editItemId,
      allCategories,
      uid,
    ]
  );

  const handleAddNewCategory = useCallback(() => {
    if (newCategory.trim()) {
      handleCategorySelect(newCategory.trim());
    } else {
      Alert.alert('Error', 'New category cannot be empty.');
    }
  }, [newCategory, handleCategorySelect]);

  const handleDeleteActivityLog = useCallback(
    async (activityLogId: string) => {
      try {
        await deleteActivityLog(activityLogId);
        // Update UI
        setRelatedActivityLogs((prev) =>
          prev.filter((log) => log.id !== activityLogId)
        );
        setActivityLogDescriptions((prev) => {
          const updated = { ...prev };
          delete updated[activityLogId];
          return updated;
        });
        setActivityLogCategories((prev) => {
          const updated = { ...prev };
          delete updated[activityLogId];
          return updated;
        });
        setTables((prevTables) =>
          prevTables.map((table) =>
            table.name === 'Activity Log Data'
              ? {
                  ...table,
                  data: table.data.filter((item) => item.id !== activityLogId),
                }
              : table
          )
        );
        setDiscussionCounts((prev) =>
          prev.filter((count) => count.activityLogId !== activityLogId)
        );
        Alert.alert('Success', 'Activity Log entry deleted successfully.');
        fetchData(); // Refresh tables after delete
      } catch (error) {
        console.error('Error deleting ActivityLog entry:', error);
        Alert.alert('Error', `Failed to delete Activity Log entry: ${error}`);
      }
    },
    [fetchData]
  );

  const saveEdit = useCallback(async () => {
    if (!editDesc || !editDesc.trim()) {
      Alert.alert('Error', 'Description cannot be empty.');
      return;
    }
    if (!uid || !editItemId || !editTableName) {
      console.error('Invalid saveEdit inputs:', {
        uid,
        editItemId,
        editTableName,
      });
      Alert.alert('Error', 'Missing user ID or item data. Please try again.');
      return;
    }
    try {
      if (editTableName === 'Discussion Data') {
        await addOrUpdateDiscussion(editDesc, editTypeSay, editItemId);
        await markDiscussionAsCleared(editItemId);
      } else {
        // Use router to update or create ActivityLog
        // Find the log to update, or create a new one if not found
        const activityLogs = await getActivityLogs();
        const logToUpdate = activityLogs.find(
          (log: any) => log.id === editItemId
        );
        if (logToUpdate) {
          await addOrUpdateActivityLog(); // No parameters allowed, batch update only
        } else {
          // Create new ActivityLog using router
          const newLog = {
            discussionId: String(editItemId), // ensure string type for discussionId
            category: activityLogCategories[editItemId] || 'uncategorized',
            description: editDesc,
            timestamp: editTimestamp,
            cleared: editCleared,
            uid: uid,
            lockedCategory: false,
            lockedDescription: false,
            synced: false,
            typeSay: editTypeSay, // add typeSay to match ActivityLog shape if needed
          };
          const newId = await createActivityLog(newLog);
          setEditItemId(newId); // update state with new ID
        }
      }
      setTables((prevTables) =>
        prevTables.map((table) =>
          table.name === editTableName
            ? {
                ...table,
                data: table.data.map((item) =>
                  item.id === editItemId
                    ? {
                        ...item,
                        description: editDesc,
                        cleared: editCleared ? '✔️ Yes' : '❌ No',
                        typeSay: editTypeSay,
                        timestamp: editTimestamp
                          ? format(new Date(editTimestamp), 'M/d/yy \n h:mm a')
                          : 'N/A',
                        rawTimestamp: editTimestamp || new Date(),
                      }
                    : item
                ),
              }
            : table.name === 'Activity Log Data'
            ? {
                ...table,
                data: table.data.map((item) =>
                  relatedActivityLogs.some((log) => log.id === item.id)
                    ? {
                        ...item,
                        description:
                          activityLogDescriptions[item.id] || item.description,
                        category:
                          activityLogCategories[item.id] || item.category,
                        cleared: item.cleared,
                        timestamp: editTimestamp
                          ? format(new Date(editTimestamp), 'M/d/yy \n h:mm a')
                          : item.timestamp,
                        rawTimestamp: editTimestamp || item.rawTimestamp,
                      }
                    : item
                ),
              }
            : table
        )
      );
      setEditModalVisible(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
      setRelatedActivityLogs([]);
      setActivityLogDescriptions({});
      setActivityLogCategories({});
      Alert.alert(
        'Success',
        'Item and related ActivityLog entries updated successfully.'
      );
      fetchData(); // Refresh tables after save
    } catch (error) {
      console.error('Error in saveEdit:', error);
      Alert.alert('Error', `Failed to save changes: ${error}`);
    }
  }, [
    editDesc,
    editCleared,
    editTypeSay,
    editTimestamp,
    editTableName,
    editItemId,
    relatedActivityLogs,
    activityLogDescriptions,
    activityLogCategories,
    uid,
    fetchData,
  ]);

  // Handler for legacy import button
  const handleLegacyImport = async () => {
    setImportingLegacy(true);
    try {
      const result = await extractAndImportLegacyFirestoreData();
      Alert.alert(
        'Legacy Import Complete',
        `Imported ${result.discussionCount} Discussion and ${result.activityLogCount} ActivityLog records.`
      );
      await fetchData();
    } catch (e: any) {
      Alert.alert('Legacy Import Failed', e.message || String(e));
    } finally {
      setImportingLegacy(false);
    }
  };

  // Handler for debug: delete all local/remote rows
  const handleDebugDeleteAll = async () => {
    setDebugLoading(true);
    try {
      await deleteAllLocalAndRemoteRows();
      Alert.alert('Debug: All local and remote ChangeLog data deleted.');
      await fetchData();
    } catch (e: any) {
      Alert.alert('Debug Delete Failed', e.message || String(e));
    } finally {
      setDebugLoading(false);
    }
  };  // Handler for debug: run all syncs and repopulate Realm (10 rows per table)
  const handleDebugSyncAndPopulate = async () => {
    setDebugLoading(true);
    try {
      console.log('[RESTORE] Starting test data creation...');
      
      // Import the local functions and DatabaseService
      const local = require('../services/dbServicesLocal');
      const { DatabaseService } = require('../services/dbServicesLocal');
      const localDB = new DatabaseService();
      
      // Initialize the local database first
      console.log('[RESTORE] Initializing local user...');
      await local.initializeUser();
      
      // Create test discussions and activity logs locally only
      for (let i = 0; i < 10; i++) {
        const discussionId = `test-discussion-${Date.now()}-${i}`;
        console.log(`[RESTORE] Creating discussion ${i + 1} with ID: ${discussionId}`);
        
        // Add discussion using the standalone function (local only)
        await local.addOrUpdateDiscussion(`Test Discussion ${i + 1}`, 'ask', discussionId, new Date());
        console.log(`[RESTORE] Discussion ${i + 1} created successfully`);
        
        // Add activity log using the class method (which is definitely local only)
        const activityLogId = await localDB.createActivityLog({
          discussionId: discussionId,
          category: 'test',
          description: `Test ActivityLog ${i + 1}`,
          timestamp: new Date(),
          cleared: false,
          uid: uid || 'local-user',
          lockedCategory: false,
          lockedDescription: false,
        });
        console.log(`[RESTORE] Activity log ${i + 1} created with ID: ${activityLogId}`);
      }
      
      console.log('[RESTORE] All test data created, refreshing tables...');
      Alert.alert('Success', 'Test data created successfully!');
      await fetchData();
    } catch (e: any) {
      console.error('[RESTORE] Error creating test data:', e);
      Alert.alert('Error', `Failed to create test data: ${e.message || String(e)}`);
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
      const message = e instanceof Error ? e.message : String(e);
      Alert.alert('Copy Failed', message);
    } finally {
      setDebugLoading(false);
    }
  };

  // Cast 'e' to Error type
  const alertCopyFailed = (e: unknown) => {
    Alert.alert('Copy Failed', (e as Error).message || String(e));
  };

  const renderRightActions = useCallback(
    (tableName: string, itemId: string) => (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(tableName, itemId)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    ),
    [handleDelete]
  );

  const renderLeftActions = useCallback(
    (
      tableName: string,
      itemId: string,
      currentDesc: string,
      currentCleared: string,
      currentTypeSay: string
    ) => (
      <TouchableOpacity
        style={styles.editButton}
        onPress={() =>
          handleEdit(
            tableName,
            itemId,
            currentDesc,
            currentCleared,
            currentTypeSay
          )
        }
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>
    ),
    [handleEdit]
  );

  const getItemLayout = useCallback(
    (data: any, index: number) => ({
      length: 48,
      offset: 48 * index,
      index,
    }),
    []
  );

  // Extra debug: log getDiscussions() output on mount
  useEffect(() => {
    async function debugFetchDiscussions() {
      try {
        const discussions = await getDiscussions();
        //console.log('[EXTRA DEBUG] getDiscussions() raw output:', discussions); // Removed
      } catch (e) {
        console.error('[EXTRA DEBUG] Error calling getDiscussions:', e);
      }
    }
    debugFetchDiscussions();
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
        <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }  //console.log('Rendering MainComponent - debug');
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >      {/* TEMPORARY: Restore data button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#007bff',
          padding: 10,
          borderRadius: 5,
          marginBottom: 10,
          alignSelf: 'center',
        }}
        onPress={handleDebugSyncAndPopulate}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>
          Restore Data (Click Once)
        </Text>
      </TouchableOpacity>
      
      {/* TEMPORARY: Check database button */}
      <TouchableOpacity
        style={{
          backgroundColor: '#28a745',
          padding: 10,
          borderRadius: 5,
          marginBottom: 10,
          alignSelf: 'center',
        }}
        onPress={async () => {
          try {
            console.log('[DB CHECK] Checking database contents...');
            const local = require('../services/dbServicesLocal');
            const activityLogs = await local.getActivityLogs();
            const discussions = await local.getDiscussions();
            console.log('[DB CHECK] Activity logs count:', activityLogs.length);
            console.log('[DB CHECK] Discussions count:', discussions.length);
            console.log('[DB CHECK] Sample activity logs:', activityLogs.slice(0, 2));
            console.log('[DB CHECK] Sample discussions:', discussions.slice(0, 2));
            Alert.alert('Database Check', `Activity Logs: ${activityLogs.length}, Discussions: ${discussions.length}`);
          } catch (e: any) {
            console.error('[DB CHECK] Error:', e);
            Alert.alert('Error', e.message || String(e));
          }
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>
          Check Database
        </Text>
      </TouchableOpacity>
      
      {initialized && tables.length > 0 ? (
        <View style={styles.tableContainer}>
          <View style={styles.navigation}>
            {tables.map((table) => (
              <TouchableOpacity
                key={table.name}
                style={[
                  styles.navButton,
                  currentTableIndex ===
                    tables.findIndex((t) => t.name === table.name) &&
                    styles.navButtonActive,
                ]}
                onPress={() =>
                  setCurrentTableIndex(
                    tables.findIndex((t) => t.name === table.name)
                  )
                }
              >
                <Text style={styles.navButtonText}>{table.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.tableHeader}>
            {tables[currentTableIndex]?.name || 'Loading...'}
          </Text>

          <View style={styles.filterRow}>
            {tables[currentTableIndex]?.columns.map((col) =>
              !col.hidden ? (
                <TextInput
                  key={col.accessor}
                  style={[styles.filterInput, { flex: col.flex }]}
                  placeholder={`Filter ${col.Header}`}
                  value={
                    typeof filters[col.accessor] === 'string'
                      ? filters[col.accessor]
                      : filters[col.accessor]?.toString() || ''
                  }
                  onChangeText={(text) =>
                    setFilters((prev) => ({ ...prev, [col.accessor]: text }))
                  }
                />
              ) : null
            )}
          </View>

          <View style={styles.headerRow}>
            {tables[currentTableIndex]?.columns.map((col) =>
              !col.hidden ? (
                <TouchableOpacity
                  key={col.accessor}
                  onPress={() => handleSort(col.accessor)}
                  style={[styles.headerCell, { flex: col.flex }]}
                >
                  <Text style={styles.headerText}>
                    {col.Header}{' '}
                    {sortBy?.column === col.accessor
                      ? sortBy.order === 'asc'
                        ? '↑'
                        : '↓'
                      : ''}
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
          </View>

          <FlatList
            data={filteredData()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <RowItem
                item={item}
                columns={tables[currentTableIndex].columns}
                renderRightActions={renderRightActions}
                renderLeftActions={renderLeftActions}
              />
            )}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            getItemLayout={getItemLayout}
            style={styles.tableList}
          />

          <Modal
            animationType="slide"
            transparent={true}
            visible={editModalVisible}
            onRequestClose={() => {
              setEditModalVisible(false);
              setShowDatePicker(false);
              setShowTimePicker(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <ScrollView style={styles.modalContainer}>
                <Text style={styles.modalTitle}>
                  Edit {editTableName} Entry
                </Text>
                <Text style={styles.modalSubtitle}>Discussion Details</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  placeholder="Enter discussion description"
                />
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Cleared:</Text>
                  <Switch value={editCleared} onValueChange={setEditCleared} />
                </View>
                {editTableName === 'Discussion Data' && (
                  <View style={styles.switchContainer}>
                    <Text style={styles.modalLabel}>
                      Type: {editTypeSay === 'ask' ? 'Ask' : 'Tell'}
                    </Text>
                    <Switch
                      value={editTypeSay === 'ask'}
                      onValueChange={(value) =>
                        setEditTypeSay(value ? 'ask' : 'tell')
                      }
                    />
                  </View>
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Date:</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                    <Text>
                      {editTimestamp
                        ? format(editTimestamp, 'M/d/yy')
                        : 'Select Date'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    value={editTimestamp}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(false);
                      if (selectedDate) {
                        setEditTimestamp(selectedDate);
                      }
                    }}
                  />
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Time:</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                    <Text>
                      {editTimestamp
                        ? format(editTimestamp, 'h:mm a')
                        : 'Select Time'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {showTimePicker && (
                  <DateTimePicker
                    value={editTimestamp}
                    mode="time"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(false);
                      if (selectedDate) {
                        setEditTimestamp(selectedDate);
                      }
                    }}
                  />
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Category:</Text>
                  <TouchableOpacity
                    style={styles.categorySelectButton}
                    onPress={() => {
                      setSelectedActivityLogId(editItemId);
                      setCategoryModalVisible(true);
                    }}
                  >
                    <Text style={styles.categoryText}>
                      {activityLogCategories[editItemId] || 'uncategorized'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Always show related Activity Log entries if any */}
                {relatedActivityLogs.length > 0 && (
                  <View style={styles.relatedLogsContainer}>
                    <Text style={styles.modalSubtitle}>
                      Related Activity Log Entries
                    </Text>
                    {relatedActivityLogs.slice(0, 5).map((item) => (
                      <RelatedLogEntry
                        key={item.id}
                        log={item}
                        description={activityLogDescriptions[item.id] || ''}
                        onDescriptionChange={(id, text) =>
                          setActivityLogDescriptions((prev) => ({
                            ...prev,
                            [id]: text,
                          }))
                        }
                        onCategoryChange={(id) => {
                          setSelectedActivityLogId(id);
                          setCategoryModalVisible(true);
                        }}
                        onDelete={handleDeleteActivityLog}
                      />
                    ))}
                  </View>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setEditModalVisible(false);
                      setShowDatePicker(false);
                      setShowTimePicker(false);
                      setRelatedActivityLogs([]);
                      setActivityLogDescriptions({});
                      setActivityLogCategories({});
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={saveEdit}
                  >
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Modal>
          <Modal
            animationType="slide"
            transparent={true}
            visible={categoryModalVisible}
            onRequestClose={() => {
              setCategoryModalVisible(false);
              setNewCategory('');
              setSelectedActivityLogId(null);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.categoryModalContainer}>
                <Text style={styles.modalTitle}>Select Category</Text>
                <FlatList
                  data={allCategories}
                  keyExtractor={(item) => item}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.categoryItem}
                      onPress={() => handleCategorySelect(item)}
                    >
                      <Text style={styles.categoryText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  nestedScrollEnabled={true}
                />
                <TextInput
                  style={styles.modalInput}
                  value={newCategory}
                  onChangeText={setNewCategory}
                  placeholder="Add new category"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setCategoryModalVisible(false);
                      setNewCategory('');
                      setSelectedActivityLogId(null);
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={handleAddNewCategory}
                  >
                    <Text style={styles.modalButtonText}>Add New</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      ) : (
        <View style={styles.container}>
          <Text style={styles.errorText}>
            No data available. Please try again.
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
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
    // flex: 1, // Removed to prevent vertical stretching
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
    // flex: 1, // Removed to prevent vertical stretching
    width: '100%',
    alignSelf: 'stretch',
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
    width: '80%',
    maxHeight: '60%',
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 10,
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
  categoryItem: {
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
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
});

export default MainComponent;
