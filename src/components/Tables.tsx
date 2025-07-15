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
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { parse, isToday, format } from 'date-fns';
import { useInterstitialAd } from '../hooks/useInterstitialAd';
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
  addOrUpdateGPTResponse,
  addOrUpdateActivityLog,
  getCategories,
  addOrUpdateCategory,
  deleteCategory,
  createCategoriesFromActivityLogs,
  getCategoryById,
  getCategoryNames,
  checkCategoryReferences,
  findCategoryByName,
  mergeCategoryReferences,
  syncToCloud,
} from '../services/dbServices';
import { extractAndImportLegacyFirestoreData } from '../services/dbServicesRemote';
import { findDuplicateActivityLog } from '../services/phraseProcessor';
import { useSync } from '../../app/context/SyncContext';
import RNFS from 'react-native-fs';
import { UpgradePromptModal } from './UpgradeModals';
import { useAuth } from '../../app/context/AuthContext';

// Temporarily commented out Firebase imports to prevent lockup
// import { db } from '../firebaseConfig';
// import {
//   collection,
//   doc,
//   getDocs,
//   deleteDoc,
//   updateDoc,
//   addDoc,
//   DocumentData,
//   QuerySnapshot,
//   query,
//   getDoc,
//   writeBatch,
//   where,
//   Timestamp,
//   onSnapshot,
// } from 'firebase/firestore';
import { getUID, setUID } from '../utils/uidManager';
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
        <Text style={styles.modalLabel}>
          ID: {typeof log.id === 'string' || typeof log.id === 'number' ? String(log.id) : '[INVALID ID]'}
        </Text>
        <TouchableOpacity onPress={() => onCategoryChange(log.id)}>
          <Text style={styles.modalLabel}>
            Category: {typeof log.category === 'string' ? log.category : '[INVALID CATEGORY]'}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={styles.modalInput}
          value={typeof description === 'string' ? description : ''}
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
                {String(item[col.accessor] ?? 'N/A')}
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
  // Add sync context to detect when sync completes
  const { lastSync } = useSync();

  // Interstitial ad hook with smart timing
  const { tryShowAd } = useInterstitialAd({
    enabled: true,
    showOnFocus: false, // Don't show immediately on focus to avoid jarring experience
    showAfterAction: true, // Show after user completes actions
    minScreenTimeBeforeAd: 10000, // Wait 10 seconds on screen before eligible
  });

  const { isPaid } = useAuth();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

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
  const [uid, setUid] = useState<string | null>(null); // Add state for legacy import loading
  const [importingLegacy, setImportingLegacy] = useState(false);
  // Debug: state for debug button loading
  const [debugLoading, setDebugLoading] = useState(false);

  // State for separate Categories edit modal
  const [categoryEditModalVisible, setCategoryEditModalVisible] =
    useState(false);
  const [editCategoryId, setEditCategoryId] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [categoryEditModalTitle, setCategoryEditModalTitle] =
    useState('Edit Category');

  // State for category delete/merge functionality
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [hasReferences, setHasReferences] = useState(false);
  const [referenceCount, setReferenceCount] = useState(0);
  const [mergeTargetName, setMergeTargetName] = useState('');
  const [showMergeOption, setShowMergeOption] = useState(false);
  const [existingCategories, setExistingCategories] = useState<string[]>([]); // Fetch UID once on mount

  // Always reload categories from Realm when modal opens
  useEffect(() => {
    if (categoryModalVisible) {
      loadCategories();
    }
  }, [categoryModalVisible, loadCategories]);
  useEffect(() => {
    const fetchUid = async () => {
      let userId = await getUID();

      // Check if user is paid customer
      const isPaidUser = await AsyncStorage.getItem('isPaidUser');

      if (!userId) {
        if (isPaidUser === 'true') {
          // Paid user should have Firebase UID - redirect to login
          setError('Please sign in to access paid features.');
          setLoading(false);
          return;
        } else {
          // Local mode - generate local UID
          userId = 'local_user_' + Date.now();
          await setUID(userId);
          console.log('Generated local UID for local mode:', userId);
        }
      }

      setUid(userId);
    };
    fetchUid();
  }, []);
  // Fetch data using dbServices router
  const fetchData = useCallback(async () => {
    if (!uid) return;
    try {
      setLoading(true);
      // Fetch data with minimal processing
      const activityLogRaw = await getActivityLogs();
      console.log('[DEBUG] Raw activity logs from Realm:', activityLogRaw);
      const activityLogData = (
        await Promise.all(
          activityLogRaw.map(async (log: any) => {
            let categoryName = log.category;
            if (log.categoryId) {
              try {
                const categoryObj = await getCategoryById(log.categoryId);
                if (categoryObj) {
                  categoryName = categoryObj.name;
                }
              } catch (error) {
                console.warn(
                  `Could not fetch category for id ${log.categoryId}:`,
                  error
                );
              }
            }
            return {
              ...log,
              id: String(log.id || ''),
              categoryId: String(log.categoryId || ''),
              category: String(categoryName || ''),
              description: String(log.description || ''),
              timestamp:
                log.timestamp instanceof Date
                  ? log.timestamp.toLocaleDateString() +
                    ' ' +
                    log.timestamp.toLocaleTimeString()
                  : String(log.timestamp || 'No date'),
              rawTimestamp:
                log.timestamp instanceof Date
                  ? log.timestamp
                  : new Date(log.timestamp || 0),
              cleared: log.cleared ? '✔️ Yes' : '❌ No',
            };
          })
        )
      ).sort(
        (a: any, b: any) => b.rawTimestamp.getTime() - a.rawTimestamp.getTime()
      );

      const discussionRaw = await getDiscussions();
      console.log('[PERF] Fetched', discussionRaw.length, 'discussions from local Realm');
      console.log('[DEBUG] Raw discussions from Realm:', discussionRaw);
      // Process discussions and add proper date sorting
      const discussionData = discussionRaw
        .map((discussion: any) => ({
          ...discussion,
          id: String(discussion.id || ''),
          discussionId: String(discussion.discussionId || ''),
          description: String(discussion.description || ''),
          typeSay: String(discussion.typeSay || 'tell'),
          timestamp: discussion.timestamp || 'No date',
          rawTimestamp:
            discussion.timestamp instanceof Date
              ? discussion.timestamp
              : new Date(discussion.timestamp || 0),
          cleared: discussion.cleared ? '✔️ Yes' : '❌ No',
        }))
        .sort(
          (a: any, b: any) =>
            b.rawTimestamp.getTime() - a.rawTimestamp.getTime()
        );

      // Fetch categories
      const categoriesRaw = await getCategories();
      console.log('[PERF] Fetched', categoriesRaw.length, 'categories from local Realm');
      console.log('[DEBUG] Raw categories from Realm:', categoriesRaw);
      // Process categories data
      const categoriesData = categoriesRaw
        .map((category: any) => ({
          tableName: 'Categories',
          id: String(category.id || ''),
          name: String(category.name || ''),
          description: String(category.description || ''),
          createdAt:
            category.createdAt instanceof Date
              ? category.createdAt.toLocaleDateString() +
                ' ' +
                category.createdAt.toLocaleTimeString()
              : String(category.createdAt || 'No date'),
          rawTimestamp:
            category.createdAt instanceof Date
              ? category.createdAt
              : new Date(category.createdAt || 0),
          synced: category.synced ? '✔️ Yes' : '❌ No',
        }))
        .sort(
          (a: any, b: any) =>
            b.rawTimestamp.getTime() - a.rawTimestamp.getTime()
        );
      // console.log('[PERF] Data processing complete');      // Skip categories for now to improve performance
      // const categories = await getDistinctCategories();
      // setAllCategories((prev) => [...new Set([...prev, ...categories])]);

      setTables([
        {
          name: 'Activities',
          columns: [
            { Header: 'ID', accessor: 'id', hidden: true },
            { Header: 'categoryId', accessor: 'categoryId', hidden: true },
            { Header: 'rawTimestamp', accessor: 'rawTimestamp', hidden: true },
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
          name: 'Discussions',
          columns: [
            { Header: 'ID', accessor: 'id', hidden: true },
            { Header: 'rawTimestamp', accessor: 'rawTimestamp', hidden: true },
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
          ],
          data: discussionData,
        },
        {
          name: 'Categories',
          columns: [
            { Header: 'ID', accessor: 'id', hidden: true },
            { Header: 'rawTimestamp', accessor: 'rawTimestamp', hidden: true },
            {
              Header: 'Name',
              accessor: 'name',
              style: styles.leftAlignCell,
              flex: 1,
            },
            {
              Header: 'Description',
              accessor: 'description',
              style: styles.leftAlignCell,
              flex: 2,
            },
          ],
          data: categoriesData,
        },
      ]);
      setInitialized(true);
      // console.log('[PERF] Tables initialized successfully');
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
    // Temporarily disabled to prevent lockup
    // console.log('[DEBUG] discussionSnapshot useEffect disabled to prevent lockup');
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
                      discussionCounts,
                      setDiscussionCounts,
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
    if (!sortBy || tables.length === 0)
      return tables[currentTableIndex]?.data || [];
    const { column, order } = sortBy;

    return [...tables[currentTableIndex].data].sort((a, b) => {
      // Use rawTimestamp for date sorting
      if (column === 'timestamp' && a.rawTimestamp && b.rawTimestamp) {
        const timeA = a.rawTimestamp.getTime();
        const timeB = b.rawTimestamp.getTime();
        return order === 'asc' ? timeA - timeB : timeB - timeA;
      }

      // Default sorting for other columns
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
    // Simplified filtering for performance
    if (tables.length === 0) return [];

    const sorted = sortedData();

    // Skip filtering if no filters are set
    const hasFilters = Object.values(filters).some(
      (value) => value && value.trim()
    );
    if (!hasFilters) return sorted;

    // Simple filtering
    return sorted.filter((row) =>
      Object.entries(filters).every(([column, value]) => {
        if (!value || !value.trim()) return true;
        const cellValue = String(row[column] || '').toLowerCase();
        return cellValue.includes(value.toLowerCase());
      })
    );
  }, [tables, filters, sortedData]);

  const handleDelete = useCallback(
    async (tableName: string, itemId: string) => {
      try {
        if (tableName === 'Activity Log Data') {
          await deleteActivityLog(itemId);
        } else if (tableName === 'Categories') {
          await deleteCategory(itemId);
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

        // Show interstitial ad after successful delete action (natural completion point)
        setTimeout(() => {
          tryShowAd('action');
        }, 1500); // Small delay to avoid interfering with the success alert

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
      // Handle Categories with separate modal
      if (tableName === 'Categories') {
        const table = tables.find((t) => t.name === tableName);
        const categoryItem = table?.data.find((i) => i.id === itemId);
        if (categoryItem) {
          setEditCategoryId(itemId);
          setEditCategoryName(categoryItem.name || '');
          setEditCategoryDescription(categoryItem.description || '');
          setCategoryEditModalTitle('Edit Category');
          setCategoryEditModalVisible(true);
        }
        return;
      }

      // Handle other tables with existing modal
      setEditTableName(tableName);
      setEditItemId(itemId);
      setEditDesc(currentDesc || '');
      setOriginalDesc(currentDesc || '');
      setEditCleared(currentCleared === 'G��n+� Yes');
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

        if (descriptionToProcess && uid) {
          const activityAnalysis = await processPhrase(
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
                // console.log(
                //   `Updated existing ActivityLog entry ${existingLog.id} for discussionId ${discussionId}`
                // );
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

  // Function to load categories for the modal
  const loadCategories = useCallback(async () => {
    try {
      const categories = await getCategories();
      const categoryNames = categories.map((cat) => cat.name);
      setAllCategories(categoryNames);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  // Handler for category selection in the modal
  const handleCategorySelect = useCallback(
    async (categoryName: string) => {
      if (selectedActivityLogId) {
        try {
          // Update the category for the selected ActivityLog in Realm
          await updateActivityLogCategory(selectedActivityLogId, categoryName);
          // Update local state for UI
          setActivityLogCategories((prev) => ({
            ...prev,
            [selectedActivityLogId]: categoryName,
          }));
          // Also update relatedActivityLogs array
          setRelatedActivityLogs((prev) =>
            prev.map((log) =>
              log.id === selectedActivityLogId
                ? { ...log, category: categoryName }
                : log
            )
          );
          // Close the modal
          setCategoryModalVisible(false);
          setSelectedActivityLogId(null);
        } catch (error) {
          console.error('Error updating category:', error);
          Alert.alert('Error', 'Failed to update category.');
        }
      }
    },
    [selectedActivityLogId]
  );

  // Handler for adding new category from the modal
  const handleAddNewCategory = useCallback(async () => {
    if (!newCategory.trim()) {
      Alert.alert('Error', 'Category name cannot be empty.');
      return;
    }

    // Check for duplicate category name (case-insensitive)
    const trimmedName = newCategory.trim();
    const existingCategory = allCategories.find(
      (cat) => cat.toLowerCase() === trimmedName.toLowerCase()
    );

    if (existingCategory) {
      Alert.alert(
        'Error',
        `Category "${trimmedName}" already exists. Please choose a different name.`
      );
      return;
    }

    try {
      // Create the new category
      const categoryId = await addOrUpdateCategory(newCategory.trim());

      // Refresh the categories list
      await loadCategories();

      // Select the new category for the activity log
      if (selectedActivityLogId) {
        setActivityLogCategories((prev) => ({
          ...prev,
          [selectedActivityLogId]: newCategory.trim(),
        }));
      }

      // Close modal and reset
      setCategoryModalVisible(false);
      setSelectedActivityLogId(null);
      setNewCategory('');

      Alert.alert('Success', 'Category created and assigned successfully.');
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Failed to create category.');
    }
  }, [newCategory, selectedActivityLogId, loadCategories, allCategories]);

  // Handler for deleting activity log from modal
  const handleDeleteActivityLog = useCallback(async (id: string) => {
    try {
      await deleteActivityLog(id); // Remove from related activity logs
      setRelatedActivityLogs((prev) => prev.filter((log) => log.id !== id));

      // Remove from descriptions and categories
      setActivityLogDescriptions((prev) => {
        const newDesc = { ...prev };
        delete newDesc[id];
        return newDesc;
      });

      setActivityLogCategories((prev) => {
        const newCat = { ...prev };
        delete newCat[id];
        return newCat;
      });

      Alert.alert('Success', 'Activity log deleted successfully.');

      // Show interstitial ad after successful activity log deletion
      setTimeout(() => {
        tryShowAd('action');
      }, 1500);
    } catch (error) {
      console.error('Error deleting activity log:', error);
      Alert.alert('Error', 'Failed to delete activity log.');
    }
  }, []);

  // Handler for deleting categories with FK checks
  const handleDeleteCategory = useCallback(
    async (categoryId: string, categoryName: string) => {
      try {
        // Check if category has references
        const refCheck = await checkCategoryReferences(categoryId);

        setCategoryToDelete({ id: categoryId, name: categoryName });
        setHasReferences(refCheck.hasReferences);
        setReferenceCount(refCheck.referenceCount);
        setMergeTargetName('');
        setShowMergeOption(false);

        if (refCheck.hasReferences) {
          // Load existing categories for merge dropdown
          const categories = await getCategoryNames();
          setExistingCategories(
            categories.filter((cat) => cat !== categoryName)
          );
        }

        setDeleteModalVisible(true);
      } catch (error) {
        console.error('Error checking category references:', error);
        Alert.alert('Error', 'Failed to check category references.');
      }
    },
    []
  );

  // Handler for confirming category deletion
  const confirmDeleteCategory = useCallback(async () => {
    if (!categoryToDelete) return;

    try {
      if (hasReferences && mergeTargetName) {
        // Merge scenario
        const targetCategory = await findCategoryByName(mergeTargetName);
        if (targetCategory) {
          // Merge references to existing category
          await mergeCategoryReferences(categoryToDelete.id, targetCategory.id);
          await deleteCategory(categoryToDelete.id);
          Alert.alert(
            'Success',
            `Category "${categoryToDelete.name}" merged into "${mergeTargetName}" and deleted.`
          );
        } else {
          Alert.alert('Error', 'Target category not found.');
          return;
        }
      } else if (!hasReferences) {
        // Simple delete
        await deleteCategory(categoryToDelete.id);
        Alert.alert(
          'Success',
          `Category "${categoryToDelete.name}" deleted successfully.`
        );
      } else {
        Alert.alert(
          'Error',
          'Cannot delete category with references without specifying merge target.'
        );
        return;
      }

      // Refresh data and close modal
      await fetchData();
      setDeleteModalVisible(false);
      setCategoryToDelete(null);
    } catch (error) {
      console.error('Error deleting/merging category:', error);
      Alert.alert('Error', 'Failed to delete category.');
    }
  }, [categoryToDelete, hasReferences, mergeTargetName, fetchData]);

  // Save function for general edits
  const saveEdit = useCallback(async () => {
    // Implementation for saving edits
    console.log('Save edit called - implementation needed');
  }, []); // Create category handler
  const handleCreateCategory = () => {
    setEditCategoryId(null);
    setEditCategoryName('');
    setEditCategoryDescription('');
    setCategoryEditModalTitle('Create Category');
    setCategoryEditModalVisible(true);
  }; // Save function specifically for Categories
  const saveCategoryEdit = useCallback(async () => {
    if (!editCategoryName.trim()) {
      Alert.alert('Error', 'Category name cannot be empty.');
      return;
    }

    // Check for duplicate category name (case-insensitive)
    const trimmedName = editCategoryName.trim();
    const categoriesTable = tables.find((table) => table.name === 'Categories');
    const existingCategory = categoriesTable?.data.find(
      (cat) =>
        cat.name.toLowerCase() === trimmedName.toLowerCase() &&
        cat.id !== editCategoryId
    );

    if (existingCategory) {
      Alert.alert(
        'Error',
        `Category "${trimmedName}" already exists. Please choose a different name.`
      );
      return;
    }

    try {
      // Prepare category data
      const categoryData = {
        id: editCategoryId,
        name: editCategoryName.trim(),
        description: editCategoryDescription.trim(),
      }; // Update or create category
      await addOrUpdateCategory(
        editCategoryName.trim(),
        editCategoryDescription.trim(),
        editCategoryId || undefined
      );

      // Refresh categories and main table data
      await loadCategories();
      await fetchData();

      // Close modal
      setCategoryEditModalVisible(false);
      setEditCategoryId(null);
      setEditCategoryName('');
      setEditCategoryDescription('');

      Alert.alert('Success', 'Category saved successfully.');
    } catch (error) {
      console.error('Error saving category:', error);
      Alert.alert('Error', 'Failed to save category.');
    }
  }, [
    editCategoryId,
    editCategoryName,
    editCategoryDescription,
    loadCategories,
    fetchData,
    tables,
  ]);

  // Legacy data import handler
  const handleLegacyImport = useCallback(async () => {
    setImportingLegacy(true);
    try {
      // Clear existing data
      await deleteAllLocalAndRemoteRows();

      // Extract and import legacy data
      const result = await extractAndImportLegacyFirestoreData();
      console.log('Legacy data import result:', result);
      Alert.alert('Success', 'Legacy data imported successfully.');

      // Show ad after successful data import (major completion action)
      setTimeout(() => {
        tryShowAd('action');
      }, 2000); // Slightly longer delay for import completion

      fetchData(); // Refresh data after import
    } catch (error) {
      console.error('Error importing legacy data:', error);
      Alert.alert('Error', 'Failed to import legacy data.');
    } finally {
      setImportingLegacy(false);
    }
  }, [fetchData]);

  // Debug function to create test rows
  const handleCreateTestRows = useCallback(async () => {
    try {
      // Insert test rows and exit
      await insertTestRowsAndExit();
      Alert.alert('Success', 'Test rows created successfully.');
    } catch (error) {
      console.error('Error creating test rows:', error);
      Alert.alert('Error', 'Failed to create test rows.');
    }
  }, []);

  // Render right swipe actions (delete)
  const renderRightActions = useCallback(
    (tableName: string, itemId: string, itemData?: any) => (
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => {
          if (tableName === 'Categories' && itemData) {
            handleDeleteCategory(itemId, itemData.name);
          } else {
            handleDelete(tableName, itemId);
          }
        }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    ),
    [handleDelete, handleDeleteCategory]
  );

  // Render left swipe actions (edit)
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
  //console.log('Rendering MainComponent - debug');
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <UpgradePromptModal
        visible={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
        onUpgrade={() => {
          setShowUpgradePrompt(false);
          // Optionally trigger plan modal if desired
        }}
      />
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

          {tables[currentTableIndex]?.name === 'Categories' && (
            <>
              <TouchableOpacity
                style={styles.createButton}
                onPress={handleCreateCategory}
              >
                <Text style={styles.createButtonText}>Create Category</Text>
              </TouchableOpacity>
            </>
          )}
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
                        ? '▲'
                        : '▼'
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
            contentContainerStyle={styles.tableContentContainer}
            showsVerticalScrollIndicator={true}
            scrollEnabled={true}
            nestedScrollEnabled={true}
            bounces={true}
            overScrollMode="always"
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
                  Edit {typeof editTableName === 'string' && editTableName.trim().length > 0 ? editTableName : 'Entry'} Entry
                </Text>
                <Text style={styles.modalSubtitle}>Discussion Details</Text>
                <TextInput
                  style={styles.modalInput}
                  value={typeof editDesc === 'string' ? editDesc : ''}
                  onChangeText={setEditDesc}
                  multiline
                  placeholder="Enter discussion description"
                />
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Cleared:</Text>
                  <Switch value={!!editCleared} onValueChange={setEditCleared} />
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
                {editTableName === 'Categories' && (
                  <View>
                    <Text style={styles.modalLabel}>Category Name:</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={typeof editTypeSay === 'string' ? editTypeSay : ''}
                      onChangeText={(text) =>
                        setEditTypeSay(text as 'tell' | 'ask')
                      }
                      placeholder="Enter category name"
                    />
                  </View>
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Date:</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                    <Text>
                      {editTimestamp instanceof Date && !isNaN(editTimestamp.getTime())
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
                      {editTimestamp instanceof Date && !isNaN(editTimestamp.getTime())
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
                {/* Removed category label and section from upper part */}
                </View>
                {/* Always show related Activity Log entries if any */}
                {relatedActivityLogs.length > 0 && (
                  <View style={styles.relatedLogsContainer}>
                    <Text style={styles.modalSubtitle}>
                      Related Activity Log Entries
                    </Text>
                    {relatedActivityLogs.slice(0, 5).map((item) => (
                      <View key={item.id} style={styles.relatedLogEntry}>
                        <TouchableOpacity
                          style={styles.categorySelectButton}
                          onPress={() => {
                            setSelectedActivityLogId(item.id);
                            setCategoryModalVisible(true);
                          }}
                        >
                          <Text style={styles.categoryText}>Change Category ({item.category || 'uncategorized'})</Text>
                        </TouchableOpacity>
                        <RelatedLogEntry
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
                      </View>
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
              fetchData(); // Refresh table when modal is closed
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
                  showsVerticalScrollIndicator={true}
                  scrollEnabled={true}
                  bounces={true}
                  style={styles.categoryListContainer}
                  contentContainerStyle={styles.categoryListContent}
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
                      fetchData(); // Refresh table when Cancel is pressed
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
          {/* Categories Edit Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={categoryEditModalVisible}
            onRequestClose={() => {
              setCategoryEditModalVisible(false);
              setEditCategoryId(null);
              setEditCategoryName('');
              setEditCategoryDescription('');
              fetchData(); // Refresh table when modal is closed
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>{categoryEditModalTitle}</Text>
                <Text style={styles.modalLabel}>Category Name:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCategoryName}
                  onChangeText={setEditCategoryName}
                  placeholder="Enter category name"
                />
                <Text style={styles.modalLabel}>Category Description:</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCategoryDescription}
                  onChangeText={setEditCategoryDescription}
                  multiline
                  placeholder="Enter category description"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => {
                      setCategoryEditModalVisible(false);
                      setEditCategoryId(null);
                      setEditCategoryName('');
                      setEditCategoryDescription('');
                      fetchData(); // Refresh table when Cancel is pressed
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.saveButton]}
                    onPress={saveCategoryEdit}
                  >
                    <Text style={styles.modalButtonText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
          {/* Delete Category Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={deleteModalVisible}
            onRequestClose={() => {
              setDeleteModalVisible(false);
              setCategoryToDelete(null);
              setHasReferences(false);
              setReferenceCount(0);
              setMergeTargetName('');
              setShowMergeOption(false);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Delete Category</Text>
                {hasReferences ? (
                  <View>
                    <Text style={styles.modalLabel}>
                      This category is referenced in {referenceCount} activity
                      log
                      {referenceCount === 1 ? '' : 's'}. You can either delete
                      the category or merge it with another category.
                    </Text>
                    <Text style={styles.modalLabel}>Merge with:</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={mergeTargetName}
                      onChangeText={setMergeTargetName}
                      placeholder="Enter category name to merge"
                    />
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={async () => {
                        if (!categoryToDelete || !mergeTargetName) return;
                        try {
                          // Merge category references
                          await mergeCategoryReferences(
                            categoryToDelete.id,
                            mergeTargetName
                          );
                          await deleteCategory(categoryToDelete.id);
                          Alert.alert(
                            'Success',
                            `Category "${categoryToDelete.name}" merged into "${mergeTargetName}" and deleted.`
                          );

                          // Show ad after successful category merge (natural completion point)
                          setTimeout(() => {
                            tryShowAd('action');
                          }, 1500);

                          // Refresh data
                          fetchData();
                          // Close modal
                          setDeleteModalVisible(false);
                          setCategoryToDelete(null);
                          setHasReferences(false);
                          setReferenceCount(0);
                          setMergeTargetName('');
                          setShowMergeOption(false);
                        } catch (error) {
                          console.error('Error merging categories:', error);
                          Alert.alert('Error', 'Failed to merge categories.');
                        }
                      }}
                    >
                      <Text style={styles.modalButtonText}>Merge</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <Text style={styles.modalLabel}>
                      Are you sure you want to delete this category?
                    </Text>
                    <TouchableOpacity
                      style={[styles.modalButton, styles.saveButton]}
                      onPress={async () => {
                        if (!categoryToDelete) return;
                        try {
                          // Delete category                          await deleteCategory(categoryToDelete.id);
                          Alert.alert(
                            'Success',
                            'Category deleted successfully.'
                          );

                          // Show ad after successful category deletion
                          setTimeout(() => {
                            tryShowAd('action');
                          }, 1500);

                          // Refresh data
                          fetchData();
                          // Close modal
                          setDeleteModalVisible(false);
                          setCategoryToDelete(null);
                        } catch (error) {
                          console.error('Error deleting category:', error);
                          Alert.alert('Error', 'Failed to delete category.');
                        }
                      }}
                    >
                      <Text style={styles.modalButtonText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <TouchableOpacity
                  style={styles.modalButton}
                  onPress={() => {
                    setDeleteModalVisible(false);
                    setCategoryToDelete(null);
                    setHasReferences(false);
                    setReferenceCount(0);
                    setMergeTargetName('');
                    setShowMergeOption(false);
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
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
});

export default MainComponent;
