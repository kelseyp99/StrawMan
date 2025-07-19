import React, { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  ActivityIndicator,
  Pressable,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { getModelAPIkey } from '../../src/services/apiUtils';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { auth } from '../../src/firebaseConfig';
import {
  disperseQuestion,
  addQuestionDiscussion,
  addOrUpdateDiscussion,
  getCategoryNames,
  getNextOpenDiscussion,
  fetchInitialDiscussion,
  synchronizeDiscussions,
  synchronizeActivityLog,
  markDiscussionAsCleared,
  processPendingTells,
  findDuplicateActivityLog,
  createActivityLog,
  deleteActivityLog,
  getActivityLogs,
  getDiscussions,
} from '../../src/services/dbServices';
import { transformInput } from '../../src/services/phraseProcessor';
// Firestore imports removed for offline-first operation
import Header from '../../src/components/Header';
import InputField from '../../src/components/InputField';
import ActionButtons from '../../src/components/ActionButtons';
import SettingsButton from '../../src/components/SettingsButton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { setUID } from '../../src/utils/uidManager';
import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as dbServices from '../../src/services/dbServices';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSync } from '../context/SyncContext';
import { exportRealmDataToFile } from '../../src/services/dbServicesLocal';
import Share from 'react-native-share';

// IAP temporarily disabled
// import { setPlanBySku, PLAN_SKUS } from '../../src/services/planManager';



// Log application load
console.log('LifeLog init:', new Date().toISOString());





interface Discussion {
  id: string;
  discussionId: string;
  description: string;
  timestamp: Date | string;
  typeSay: string;
  cleared?: boolean;
  uid?: string;
}

interface IndexScreenProps {
}

const IndexScreen: React.FC<IndexScreenProps> = (props) => {
  const { onApiKeyLoaded } = props;
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

export default function AskJanet() {

  // All state hooks declared at the top for clarity and to avoid reference errors

  // All state hooks declared at the top for clarity and to avoid reference errors
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const [history, setHistory] = useState<
    { text: string; type: string; aiResponse?: string }[]
  >([
    { text: "What is the weather like today?", type: "question", aiResponse: "I don't have access to current weather data." },
    { text: "I had breakfast this morning", type: "fact" },
    { text: "How can I improve my sleep?", type: "question", aiResponse: "Try maintaining a consistent sleep schedule." },
    { text: "I went for a run", type: "fact" },
    { text: "What exercises are good for beginners?", type: "question" },
    { text: "I drank water", type: "fact" },
    { text: "How much water should I drink daily?", type: "question" },
    { text: "I read a book", type: "fact" },
    { text: "What are good books for learning?", type: "question" },
    { text: "I practiced meditation", type: "fact" },
    { text: "How to start meditating?", type: "question" },
    { text: "I had lunch", type: "fact" },
    { text: "What are healthy lunch options?", type: "question" },
    { text: "I called my family", type: "fact" },
    { text: "How to maintain relationships?", type: "question" },
    { text: "I worked on a project", type: "fact" },
  ]);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const [discussionCounts, setDiscussionCounts] = useState<any[]>([]);
  const [processedDiscussions, setProcessedDiscussions] = useState<string[]>([]);
  const [destinationFolder, setDestinationFolder] = useState<string>('Downloads');
  const [filePath, setFilePath] = useState<string>('');
  const [currentDiscussion, setCurrentDiscussion] = useState<Discussion | null>(null);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogQuestion, setDialogQuestion] = useState('');
  const [distinctCategories, setDistinctCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerResult | null>(null);
  const [activityLogEntries, setActivityLogEntries] = useState<string[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const [responses, setResponses] = useState<
    { responseType: string; text: string }[]
  >([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userUID, setUserUID] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const router = useRouter();
  const { isLogged, loading: authLoading, setIsLogged } = useAuth(); // Use local auth context

  // ...existing code...

  const dialogRef = useRef<View>(null);
  const MAX_FETCH_ATTEMPTS = 5;
  const { lastSync } = useSync();

  // Initialize user with Firebase auth (if available) or local auth system
  useEffect(() => {
    let isMounted = true; // Flag to prevent navigation after component unmount

    async function initApp() {
      if (authLoading) {
        // Wait for auth context to load
        return;
      }

      if (!isMounted) return; // Prevent navigation if component unmounted

      // Check if user is marked as paid user
      const isPaidUser = (await AsyncStorage.getItem('isPaidUser')) === 'true';

      if (isPaidUser) {
        // Paid user mode - check for persisted authentication first
        if (isLogged) {
          // User is already logged in according to AuthContext
          console.log('Paid user already logged in, checking Firebase auth...');
          
          // Try to get persisted user data
          const [savedEmail, savedUID] = await Promise.all([
            AsyncStorage.getItem('userEmail'),
            AsyncStorage.getItem('userUID')
          ]);

          if (savedEmail && savedUID) {
            console.log('Using persisted user data:', savedEmail);
            setUserEmail(savedEmail);
            setUserUID(savedUID);
            await setUID(savedUID);
          } else {
            // Check current Firebase user
            const firebaseUser = auth.currentUser;
            if (firebaseUser) {
              console.log('Using Firebase user data:', firebaseUser.email);
              setUserEmail(firebaseUser.email);
              setUserUID(firebaseUser.uid);
              await setUID(firebaseUser.uid);
              
              // Persist user data for next time
              await AsyncStorage.setItem('userEmail', firebaseUser.email || '');
              await AsyncStorage.setItem('userUID', firebaseUser.uid);
            } else {
              console.log('No persisted or Firebase user data, redirecting to login');
              setTimeout(() => {
                if (isMounted) {
                  router.replace('/login');
                }
              }, 100);
              setLoadingAuth(false);
              return;
            }
          }
        } else {
          // User not logged in, redirect to login
          console.log('Paid user not logged in, redirecting to login');
          setTimeout(() => {
            if (isMounted) {
              router.replace('/login');
            }
          }, 100);
          setLoadingAuth(false);
          return;
        }
      } else {
        // Local-only mode - generate or use local UID
        console.log('Using local-only mode');
        setUserEmail('local@user.app'); // Default email for local auth

        // Get or generate a local UID
        let localUID = await AsyncStorage.getItem('localUID');
        if (!localUID) {
          localUID = `local-${Date.now()}-${Math.random()
            .toString(36)
            .substr(2, 9)}`;
          await AsyncStorage.setItem('localUID', localUID);
          console.log('Generated new local UID:', localUID);
        } else {
          console.log('Using existing local UID:', localUID);
        }

        setUserUID(localUID);
        await setUID(localUID); // Store local UID
        await setIsLogged(true); // Mark as logged in for local mode
      }

      try {
        await initializeUser();
        await loadInitialData();
      } catch (error) {
        console.error('Init err:', error);
      }

      setLoadingAuth(false);
    }

    initApp();

    return () => {
      isMounted = false; // Cleanup
    };
  }, [isLogged, authLoading, router]);

  useEffect(() => {
    if (dialogVisible) {
      const fetchCategories = async () => {
        try {
          const categories = await getCategoryNames();
          console.log('Modal opened, fetched categories:', categories);
          setDistinctCategories(
            categories.length > 0
              ? categories
              : ['diet', 'exercise', 'sleep', 'mood']
          );
        } catch (error) {
          console.error('Error fetching categories:', error);
          setDistinctCategories(['diet', 'exercise', 'sleep', 'mood']);
        }
      };
      fetchCategories();
    }
  }, [dialogVisible]);

  useEffect(() => {
    if (dialogVisible && selectedCategories.length > 0) {
      const fetchEntries = async () => {
        const entries = await getActivityLogEntries();
        console.log('Fetched ActivityLog entries:', entries);
        setActivityLogEntries(entries);
      };
      fetchEntries();
    } else {
      setActivityLogEntries([]);
    }
  }, [dialogVisible, selectedCategories]);

  useEffect(() => {
    if (!loadingAuth) {
      loadInitialData();
    }
  }, [lastSync, loadingAuth]);

  async function loadInitialData() {
    try {
      const initialDiscussion = await fetchInitialDiscussion();
      if (initialDiscussion) {
        console.log('Discussion:', initialDiscussion);
        setDiscussion({
          id: initialDiscussion.id,
          discussionId: initialDiscussion.discussionId || initialDiscussion.id,
          description: initialDiscussion.description || 'No description',
          timestamp: initialDiscussion.timestamp,
          typeSay: initialDiscussion.typeSay || 'ask',
          cleared: initialDiscussion.cleared || false,
        });
      }

      // Use local Realm data instead of Firestore
      console.log('Loading discussion counts from local storage...');
      // TODO: Implement local discussion counts if needed
      setDiscussionCounts([]);
    } catch (error) {
      console.error('Data err:', error);
    }
  }

  async function initializeUser() {
    console.log('User init...');
  }

  const handleSignOut = async () => {
    try {
      console.log('Signing out from local auth');
      setMenuVisible(false);
      // Clear local state
      setUserEmail(null);
      setUserUID(null);
      setDiscussion(null);
      setDiscussionCounts([]);
      
      // Clear persisted user data
      await AsyncStorage.multiRemove([
        'userEmail',
        'userUID',
        'isPaidUser',
        'syncWithCloud',
        'userPlan'
      ]);
      
      // Clear auth state
      await setIsLogged(false);
      router.replace('/login');
    } catch (error) {
      console.error('Sign out err:', error);
    }
  };

  const handleInputChange = (text: string) => {
    setInput(text);
    setIsQuestion(/\b(what|when|how|why|does|is|can)\b/i.test(text));
    const djMode = /\b(DJ mode|dj mode|Dj mode|DJ|dj)\b/i.test(text);
    if (djMode) {
      console.log('DJ Mode detected in input');
    }
  };

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function fetchDiscussions(maxAttempts: number = MAX_FETCH_ATTEMPTS) {
    console.log('Fetching discussions from local storage...');

    if (isFetching || fetchAttempts >= maxAttempts) {
      console.warn(
        isFetching
          ? 'Already fetching, skipping.'
          : 'Max fetch attempts reached.'
      );
      setFetchAttempts(0);
      setProcessedDiscussions([]);
      setIsFetching(false);
      return;
    }

    setIsFetching(true);
    try {
      setFetchAttempts((prev) => prev + 1);

      // Use local Realm database instead of Firestore
      const { snapshot, hasMore } = await getNextOpenDiscussion();
      // Ensure snapshot is always an array and map to local Discussion type
      const snapshotArr = Array.isArray(snapshot)
        ? snapshot.map((d: {
            id: string;
            discussionId?: string;
            description?: string;
            timestamp?: Date | string;
            typeSay?: string;
            cleared?: boolean;
            uid?: string;
          }) => ({
            id: d.id,
            discussionId: d.discussionId ?? d.id,
            description: d.description ?? 'No description',
            timestamp: d.timestamp ?? new Date(),
            typeSay: d.typeSay ?? 'ask',
            cleared: d.cleared ?? false,
            uid: d.uid,
          }))
        : [];
      if (snapshotArr.length > 0) {
        console.log('Found discussions:', snapshotArr.length);
        const discussionTyped: Discussion = snapshotArr[0]; // Already mapped to correct type
        console.log('Processing discussion:', discussionTyped.description);

        setCurrentDiscussion(discussionTyped);
        setFetchAttempts(0);
        setIsFetching(false);
        return;
      }

      if (hasMore) {
        console.log('More discussions available, trying again...');
        await delay(2000);
        await fetchDiscussions(maxAttempts);
      } else {
        console.log('No more discussions available');
        setFetchAttempts(0);
        setIsFetching(false);
      }
    } catch (error) {
      console.error('Error fetching discussions:', error);
      setFetchAttempts(0);
      setIsFetching(false);
    }
  }

  const checkUniqueActivityLog = async (
    discussionId: string,
    category: string,
    description: string
  ) => {
    try {
      // Use dbServices broker instead of direct Firebase calls
      // Remove extra argument to match function signature
      const isDuplicate = await findDuplicateActivityLog(
        discussionId,
        category,
        description
      );
      return !isDuplicate; // Return true if unique (no duplicate found)
    } catch (error) {
      console.error('Unique err:', error);
      return false;
    }
  };

  const handleAddActivityLog = async () => {
    if (!currentDiscussion) {
      console.error('No discussion.');
      Alert.alert('Error', 'No discussion.');
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setProcessedDiscussions([]);
      return;
    }

    const category = selectedCategories.join(', ') || 'uncategorized';
    const description = dialogQuestion || 'No question';
    const discussionId = currentDiscussion.id;

    try {
      const isUnique = await checkUniqueActivityLog(
        discussionId,
        category,
        description
      );
      if (!isUnique) {
        Alert.alert('Error', 'Duplicate.');
        await markDiscussionAsCleared(currentDiscussion.id);
        setDialogVisible(false);
        setCurrentDiscussion(null);
        setProcessedDiscussions([]);
        return;
      }

      // Use dbServices broker to add activity log (handles local/remote based on user type)
      const activityLogEntry = {
        discussionId,
        description,
        category,
        timestamp: new Date(),
        cleared: false,
        uid: userUID || 'local-user',
        lockedCategory: false,
        lockedDescription: false,
        attachedFile:
          selectedFile?.assets && selectedFile?.assets[0]?.uri
            ? selectedFile?.assets[0]?.uri
            : null,
      };

      // Use dbServices function to add the activity log
      const newActivityLogId = await createActivityLog(activityLogEntry);
      console.log('Added activity log via dbServices:', newActivityLogId);
      Alert.alert('Success', 'Added.');
      await markDiscussionAsCleared(currentDiscussion.id);
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setProcessedDiscussions([]);
      fetchDiscussions();
    } catch (error) {
      console.error('Add err:', error);
      Alert.alert('Error', 'Failed.');
      await markDiscussionAsCleared(currentDiscussion.id);
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setProcessedDiscussions([]);
    }
  };

  const handleDeleteActivityLog = async () => {
    if (!currentDiscussion) {
      console.error('No discussion.');
      Alert.alert('Error', 'No discussion.');
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setProcessedDiscussions([]);
      return;
    }

    try {
      // Use dbServices to get activity logs and find the one with matching discussionId
      const activityLogs = await getActivityLogs();
      const targetLog = activityLogs.find(
        (log) => log.discussionId === currentDiscussion.id
      );

      if (targetLog) {
        await deleteActivityLog(targetLog.id);
        console.log('Deleted activity log:', targetLog.id);
        Alert.alert('Success', 'Deleted.');
      } else {
        console.log('No entry found for discussion:', currentDiscussion.id);
        Alert.alert('Info', 'No entry.');
      }

      await markDiscussionAsCleared(currentDiscussion.id);
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setProcessedDiscussions([]);
      fetchDiscussions();
    } catch (error) {
      console.error('Delete err:', error);
      Alert.alert('Error', 'Failed.');
      await markDiscussionAsCleared(currentDiscussion.id);
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setProcessedDiscussions([]);
    }
  };

  const selectDestinationFolder = (
    callback: (folder: string) => Promise<void>
  ) => {
    Alert.alert('Select Folder', 'Choose save location:', [
      {
        text: 'Downloads',
        onPress: async () => {
          setDestinationFolder('Downloads');
          await callback('Downloads');
        },
      },
      {
        text: 'Pictures',
        onPress: async () => {
          setDestinationFolder('Pictures');
          await callback('Pictures');
        },
      },
      {
        text: 'Custom',
        onPress: () => {
          Alert.prompt(
            'Custom Folder',
            'Enter folder name:',
            async (folderName) => {
              if (folderName) {
                setDestinationFolder(folderName);
                await callback(folderName);
              }
            }
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleSaveTxt = async () => {
    // Prompt user for destination folder
    selectDestinationFolder(async (folder) => {
      if (!currentDiscussion) {
        console.error('No discussion.');
        setFilePath('Error');
        Alert.alert('Error', 'No discussion.');
        return;
      }
      let tempPath: string = '';
      let content: string = '';
      try {
        const permission =
          Platform.OS === 'android'
            ? PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE
            : null;
        let permissionGranted = true;
        if (permission) {
          const result = await check(permission);
          if (result !== RESULTS.GRANTED) {
            const requestResult = await request(permission);
            if (requestResult !== RESULTS.GRANTED) {
              permissionGranted = false;
            }
          }
        }
        const fileName = `question_${currentDiscussion.id}_${Date.now()}.txt`;
        const activityLogEntries = await getActivityLogEntries();
        content =
          `Question: ${dialogQuestion}\n` +
          `Categories: ${
            selectedCategories.length > 0
              ? selectedCategories.join(', ')
              : 'None'
          }\n` +
          `File: ${
            selectedFile?.assets ? selectedFile.assets[0]?.name : 'None'
          }\n` +
          `Description:\n${
            activityLogEntries.length > 0
              ? activityLogEntries.join('\n')
              : 'None'
          }`;
        let destPath: string;
        if (folder === 'Downloads') {
          destPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
        } else if (folder === 'Pictures') {
          destPath = `${RNFS.PicturesDirectoryPath}/${fileName}`;
        } else {
          destPath = `${RNFS.ExternalDirectoryPath}/${folder}/${fileName}`;
          await RNFS.mkdir(`${RNFS.ExternalDirectoryPath}/${folder}`);
        }
        await RNFS.writeFile(destPath, content, 'utf8');
        setFilePath(destPath);
        Clipboard.setString(`Question: ${dialogQuestion}\nPath: ${destPath}`);
        Alert.alert(
          'Success',
          `Saved to ${folder} as ${fileName}\nPath copied to clipboard.`
        );
        // Share the TXT file
        try {
          await Share.open({
            url: 'file://' + destPath,
            type: 'text/plain',
            showAppsToView: true,
            failOnCancel: false,
          });
        } catch (shareError) {
          console.error('Error sharing TXT file:', shareError);
        }
      } catch (error) {
        setFilePath('Error');
        Alert.alert(
          'Error',
          `Failed to save: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    });
  };

  const handlePickFile = async () => {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE
          : null;
      if (permission) {
        const result = await check(permission);
        if (result !== RESULTS.GRANTED) {
          const requestResult = await request(permission);
          if (requestResult !== RESULTS.GRANTED) {
            Alert.alert(
              'Permission Denied',
              'Storage permission is required to pick files.'
            );
            return;
          }
        }
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled) {
        setSelectedFile(result);
        Alert.alert('File Selected', `Selected: ${result.assets[0].name}`);
      } else {
        setSelectedFile(null);
        Alert.alert('Cancelled', 'File selection was cancelled.');
      }
    } catch (error) {
      console.error('Pick file err:', error);
      Alert.alert(
        'Error',
        'Failed to pick file: ' +
          (error instanceof Error ? error.message : String(error))
      );
    }
  };

  const handleSaveImage = async (format: 'jpg' | 'png') => {
    Alert.alert(
      'Error',
      `Image saving (${format.toUpperCase()}) is disabled in this version.`
    );
  };

  async function getActivityLogEntries(): Promise<string[]> {
    try {
      if (selectedCategories.length === 0) {
        return [];
      }

      // Use dbServices to get activity logs
      const activityLogs = await getActivityLogs();

      return activityLogs
        .filter((log) => selectedCategories.includes(log.category))
        .map((data) => {
          if (
            data.description === dialogQuestion &&
            data.discussionId === currentDiscussion?.id
          ) {
            return null;
          }
          const timestamp = new Date(data.timestamp);
          const formattedTimestamp = `${
            timestamp.getMonth() + 1
          }/${timestamp.getDate()}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
          return `${formattedTimestamp} ${data.description}`;
        })
        .filter((entry): entry is string => entry !== null);
    } catch (error) {
      console.error('Error fetching ActivityLog entries:', error);
      return [];
    }
  }


  const handleDialogCancel = async () => {
    console.log('Cancel dialog, marking as cleared');
    if (currentDiscussion) {
      await markDiscussionAsCleared(currentDiscussion.id);
    }
    setDialogVisible(false);
    setCurrentDiscussion(null);
    setResponses([]);
    setProcessedDiscussions([]);
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };

  const findExistingDiscussion = async (description: string) => {
    try {
      console.log('Searching for existing discussion:', description);
      // Use dbServices to get discussions and filter locally
      const discussions = await getDiscussions();
      const existingDiscussion = discussions.find(
        (discussion) =>
          discussion.description === description && discussion.typeSay === 'ask'
      );

      if (existingDiscussion) {
        console.log('Found existing discussion ID:', existingDiscussion.id);
        return existingDiscussion as Discussion;
      }

      console.log('No existing discussion found for:', description);
      return null;
    } catch (error) {
      console.error('Error checking existing discussion:', error);
      return null;
    }
  };

  const handleResubmitQuestion = async (question: string) => {
    console.log('Resubmitting question:', question);

    const existingDiscussion = await findExistingDiscussion(
      question,
      userUID || 'local-user'
    );
    if (existingDiscussion) {
      console.log('Reusing existing discussion:', existingDiscussion.id);
      try {
        // Use dbServices to update the discussion - we can use addOrUpdateDiscussion with the question
        await addOrUpdateDiscussion(question);
        console.log(
          'Updated existing discussion via dbServices:',
          existingDiscussion.id
        );
        setInput(question);
        setIsQuestion(true);
        setDialogQuestion(question);
        setCurrentDiscussion(existingDiscussion);
        setSelectedCategories([]);
        setDialogVisible(true);
      } catch (error) {
        console.error('Error updating existing discussion:', error);
        Alert.alert('Error', 'Failed to resubmit question.');
      }
    } else {
      console.log('No existing discussion, creating new one for:', question);
      handleInputChange(question);
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    try {
      const currentInput = input.trim();
      if (!currentInput) {
        console.log('No input to submit');
        return;
      }

      console.log('Submitting:', currentInput);
      const transformedInput = transformInput(currentInput);
      const newEntry = {
        text: transformedInput,
        type: isQuestion ? 'question' : 'fact',
      };
      setHistory((prev) => {
        console.log('Adding to history:', newEntry);
        return [...prev, newEntry];
      });

      const discussionId = await addOrUpdateDiscussion(
        transformedInput,
        isQuestion ? 'ask' : 'tell'
      );
      console.log('Discussion saved with ID:', discussionId ?? 'undefined');
      setInput('');
      if (isQuestion) {
        const newDiscussion: Discussion = {
          id: discussionId!,
          discussionId: discussionId!,
          description: transformedInput,
          timestamp: new Date(),
          typeSay: 'ask',
          cleared: false,
          uid: userUID || 'local-user',
        };
        setProcessedDiscussions((prev) => [...prev, discussionId!]);
        setDialogQuestion(transformedInput);
        setCurrentDiscussion(newDiscussion);
        setSelectedCategories([]);
        setFilePath('');
        setSelectedFile(null);
        setDialogVisible(true);
        const aiResponse =
          responses
            .filter((response) => response.responseType === 'gpt response')
            .map((response) => response.text)
            .join(', ') || '';
        setHistory((prev) =>
          prev.map((item) =>
            item.text === transformedInput && item.type === 'question'
              ? { ...item, aiResponse }
              : item
          )
        );
      } else {
        await processPendingTells();
      }
      console.log('Submission complete:', transformedInput);
    } catch (error: unknown) {
      console.error('Submit err:', error);
    }
  };

  const toggleMenu = () => setMenuVisible(!menuVisible);

  useEffect(() => {
    // Run legacy import and sync on app start if sync is enabled
    (async () => {
      try {
        const syncWithCloud =
          (await AsyncStorage.getItem('syncWithCloud')) === 'true';
        if (syncWithCloud) {
          console.log('🔄 Sync enabled, attempting Firebase operations...');
          
          // Check if we have a real Firebase user (not hardcoded)
          const firebaseUser = auth.currentUser;
          if (!firebaseUser) {
            console.warn('⚠️ No Firebase authentication - skipping Firebase sync operations');
            console.log('💡 Using hardcoded UID for local-only mode');
            return;
          }
          
          console.log('✅ Firebase user authenticated, proceeding with sync...');
          
          // First: Import legacy data from root Firestore to Realm
          try {
            await synchronizeDiscussions('1.0.0');
            await synchronizeActivityLog('1.0.0');
            console.log('✅ Legacy import completed on startup');
          } catch (error) {
            console.warn('❌ Legacy import failed on startup:', error);
            // Don't fail the entire app if legacy import fails
          }

          // Then: Sync Realm data to user-level Firestore
          try {
            await dbServices.syncToCloud('Discussion');
            console.log('✅ Discussion syncToCloud completed');
          } catch (e) {
            console.warn('❌ Discussion syncToCloud failed:', e);
          }
          
          try {
            await dbServices.syncToCloud('ActivityLog');
            console.log('✅ ActivityLog syncToCloud completed');
          } catch (e) {
            console.warn('❌ ActivityLog syncToCloud failed:', e);
          }
          
          try {
            await dbServices.syncToCloud('Category');
            console.log('✅ Category syncToCloud completed');
          } catch (e) {
            console.warn('❌ Category syncToCloud failed:', e);
          }
        } else {
          console.log('🚫 Sync disabled - skipping Firebase operations');
        }
      } catch (e) {
        console.warn('❌ Could not check syncWithCloud:', e);
      }
    })();
  }, []);

  // Remove the automatic redirect to login - let the user stay logged in

  // --- IAP Subscription Listener Integration ---
  useEffect(() => {
    console.warn('IAP functionality temporarily disabled to prevent crashes');
    // IAP code disabled until react-native-iap is properly installed
    return () => {
      // No cleanup needed when IAP is disabled
    };
  }, []);

  if (loadingAuth || authLoading)
    return <ActivityIndicator size="large" color="#0000ff" />;

  return (
    <View style={styles.container}>
      <IndexScreen onApiKeyLoaded={setApiKey} />
      <Header />
      <InputField input={input} onChange={handleInputChange} />
      <ActionButtons isQuestion={isQuestion} onSubmit={handleSubmit} />
      {/* --- TEMP BUTTONS: Print ActivityLog and Discussion separately, and copy Realm file --- */}
      {/* <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: 10,
        }}
      >
          <TouchableOpacity
          style={{
            backgroundColor: '#007AFF',
            padding: 10,
            borderRadius: 5,
            marginRight: 10,
          }}
          onPress={async () => {
            await debugPrintAllActivityLogs();
            Alert.alert(
              'Realm Dump',
              'Printed all ActivityLog data to terminal.'
            );
          }}
        >
          {/*  <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            Print ActivityLog
          </Text> }
       </TouchableOpacity> */}
      {/*  <TouchableOpacity
          style={{
            backgroundColor: '#28A745',
            padding: 10,
            borderRadius: 5,
            marginRight: 10,
          }}
          onPress={async () => {
            await debugPrintAllDiscussions();
            Alert.alert(
              'Realm Dump',
              'Printed all Discussion data to terminal.'
            );
          }}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>
            Print Discussion
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{
            backgroundColor: '#FF9500',
            padding: 10,
            borderRadius: 5,
          }}
          onPress={async () => {
            try {
              const src = RNFS.DocumentDirectoryPath + '/lifelog.realm';
              const dest = 'C:/Users/philk/Downloads/lifelog.realm';
              await RNFS.copyFile(src, dest);
              Alert.alert('Realm File', 'Copied lifelog.realm to Downloads!');
            } catch (e) {
              Alert.alert('Copy Failed', String(e));
            }
          }}
        >
          {
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>
              Copy Realm to Downloads
            </Text>
          }
        </TouchableOpacity> 
      </View>
      {/* NEW: Legacy Import All Tables Button */}
      {/*  <TouchableOpacity
        style={{
          backgroundColor: '#6C63FF',
          padding: 10,
          borderRadius: 5,
        }}
        onPress={async () => {
          try {
            const result = await extractAndImportLegacyFirestoreData();
            Alert.alert(
              'Legacy Import Complete',
              `Imported ${result.discussionCount} Discussion and ${result.activityLogCount} ActivityLog records.`
            );
          } catch (e) {
            Alert.alert('Legacy Import Failed', String(e));
          }
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>
          Import All Legacy Firestore Tables
        </Text>
      </TouchableOpacity> */}
      <FlatList
        data={history}
        keyExtractor={(item, index) => `${item.text}-${index}`}
        style={styles.historyList}
        contentContainerStyle={styles.historyContentContainer}
        showsVerticalScrollIndicator={true}
        scrollEnabled={true}
        bounces={true}
        removeClippedSubviews={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {}}
        onScrollEndDrag={() => {}}
        scrollsToTop={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.historyItem,
              item.type === 'question' ? styles.questionItem : styles.factItem,
            ]}
            onPress={() => {
              console.log(
                'FlatList: Pressed item:',
                item.text,
                'Type:',
                item.type
              );
              if (item.type === 'question') {
                handleResubmitQuestion(item.text);
              } else {
                console.log('FlatList: Ignoring click: Not a question');
              }
            }}
            disabled={item.type !== 'question'}
          >
            <Text
              style={[
                styles.historyText,
                item.type === 'question'
                  ? styles.questionText
                  : styles.factText,
              ]}
            >
              {item.text}
            </Text>
            {item.aiResponse && (
              <Text style={styles.aiResponse}>{item.aiResponse}</Text>
            )}
          </TouchableOpacity>
        )}
      />
      <View style={styles.bottomContainer}>
        <Pressable onPress={toggleMenu} style={styles.hamburger}>
          <Icon name="menu" size={24} color="#333" />
        </Pressable>
        <SettingsButton />
      </View>
      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={toggleMenu}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.menu}>
            <Text style={styles.menuItem}>User: {userEmail || 'Loading'}</Text>
            <Text style={styles.menuItem}>
              Key: {apiKey ? `${apiKey.slice(0, 4)}...` : 'None'}
            </Text>
            <Pressable onPress={handleSignOut} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>Sign Out</Text>
            </Pressable>
            <Pressable onPress={toggleMenu} style={styles.menuButton}>
              <Text style={styles.menuButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal
        visible={dialogVisible}
        transparent
        animationType="slide"
        onRequestClose={handleDialogCancel}
      >
        <View style={styles.modalOverlay}>
          <View ref={dialogRef} style={styles.dialogContainer}>
            {/* Debug log for dialogQuestion */}
            {console.log('Modal dialogQuestion:', dialogQuestion)}
            <Text style={styles.modalTitle}>
              {currentDiscussion?.typeSay === 'ask'
                ? 'Question Details'
                : 'Fact Details'}
            </Text>
            <Text style={styles.modalLabel}>
              Question: {typeof dialogQuestion === 'string' ? dialogQuestion : JSON.stringify(dialogQuestion) || 'None'}
            </Text>
            <Text style={styles.modalLabel}>Categories:</Text>
            {/* Debug log for distinctCategories */}
            {console.log('Modal distinctCategories:', distinctCategories)}
            <FlatList
              data={distinctCategories}
              keyExtractor={(item) => String(item)}
              style={styles.categoryList}
              contentContainerStyle={styles.categoryContentContainer}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => toggleCategory(String(item))}
                >
                  {console.log('Modal category item:', item)}
                  <Text style={styles.categoryText}>{typeof item === 'string' ? item : JSON.stringify(item)}</Text>
                  <Text>{selectedCategories.includes(String(item)) ? '✔' : '⬜'}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.modalLabel}>No categories available</Text>
              }
            />
            <Text style={styles.modalLabel}>Activity Log Entries:</Text>
            {/* Debug log for activityLogEntries */}
            {console.log('Modal activityLogEntries:', activityLogEntries)}
            <FlatList
              data={activityLogEntries}
              keyExtractor={(item, index) => `${String(item)}-${index}`}
              style={styles.activityLogList}
              contentContainerStyle={styles.activityLogContentContainer}
              showsVerticalScrollIndicator={true}
              scrollEnabled={true}
              nestedScrollEnabled={true}
              renderItem={({ item }) => (
                <>
                  {console.log('Modal activityLogEntry item:', item)}
                  <Text style={styles.modalLabel}>{typeof item === 'string' ? item : JSON.stringify(item)}</Text>
                </>
              )}
              ListEmptyComponent={<Text style={styles.modalLabel}>None</Text>}
            />
            {/* Debug log for selectedFile */}
            {console.log('Modal selectedFile:', selectedFile)}
            <Text style={styles.modalLabel}>
              File:{' '}
              {selectedFile?.assets && typeof selectedFile.assets[0]?.name === 'string'
                ? selectedFile.assets[0].name
                : selectedFile?.assets && selectedFile.assets[0]?.name
                  ? JSON.stringify(selectedFile.assets[0].name)
                  : 'None'}
            </Text>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handlePickFile}
            >
              <Text style={styles.saveButtonText}>Pick File</Text>
            </TouchableOpacity>
            <View style={styles.saveButtons}>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveTxt}
              >
                <Text style={styles.saveButtonText}>TXT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSaveImage('png')}
              >
                <Text style={styles.saveButtonText}>PNG</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={() => handleSaveImage('jpg')}
              >
                <Text style={styles.saveButtonText}>JPG</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleDialogCancel}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteActivityLog}
              >
                <Text style={styles.modalButtonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddActivityLog}
              >
                <Text style={styles.modalButtonText}>Add</Text>
              </TouchableOpacity>
              {/* Confirm button removed */}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    width: '100%',
  },
  historyList: {
    flex: 1,
  },
  historyContentContainer: {
    paddingBottom: 100, // Add padding to account for bottom container
    flexGrow: 1,
  },
  bottomContainer: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  hamburger: {
    padding: 10,
  },
  settingsButton: {
    marginRight: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menu: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    width: '100%',
  },
  menuItem: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  menuButton: {
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dialogContainer: {
    backgroundColor: '#fff',
    padding: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    width: '100%',
    maxHeight: '85%',
    flex: 0,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalLabel: {
    fontSize: 16,
    marginBottom: 10,
    color: '#333',
  },
  categoryList: {
    maxHeight: 120,
    marginBottom: 10,
  },
  categoryContentContainer: {
    paddingBottom: 10,
  },
  categoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  categoryText: {
    fontSize: 16,
  },
  activityLogList: {
    maxHeight: 100,
    marginBottom: 10,
  },
  activityLogContentContainer: {
    paddingBottom: 10,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 20,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
    width: '22%',
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: '#007bff',
  },
  deleteButton: {
    backgroundColor: '#dc3545',
  },
  addButton: {
    backgroundColor: '#28a745',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  saveButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
    marginBottom: 10,
  },
  saveButton: {
    padding: 8,
    borderRadius: 5,
    backgroundColor: '#28a745',
    width: '30%',
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  historyItem: {
    padding: 10,
    marginVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  questionItem: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
  },
  factItem: {
    backgroundColor: 'rgba(40, 167, 69, 0.1)',
  },
  historyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  questionText: {
    color: '#007AFF',
  },
  factText: {
    color: '#28A745',
  },
  aiResponse: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});
