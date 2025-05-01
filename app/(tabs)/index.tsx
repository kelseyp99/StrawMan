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
} from 'react-native';
import { auth } from '../../src/firebaseConfig';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { getModelAPIkey } from '../../src/services/apiUtils';
import { useRouter } from 'expo-router';
import {
  disperseQuestion,
  addQuestionDiscussion,
  addOrUpdateDiscussion,
  getDistinctCategories,
  getNextOpenDiscussion,
  fetchInitialDiscussion,
} from '../../src/services/databaseService';
import { transformInput } from '../../src/services/phraseProcessor';
import { db } from '../../src/firebaseConfig';
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import Header from '../../src/components/Header';
import InputField from '../../src/components/InputField';
import ActionButtons from '../../src/components/ActionButtons';
import SettingsButton from '../../src/components/SettingsButton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import { setUID } from '../../src/utils/uidManager';
import * as FileSystem from 'expo-file-system';

// Log application load
console.log('LifeLog init:', new Date().toISOString());

// Interfaces for data structures
interface ActivityLog {
  id: string;
  discussionId: string;
  description: string;
  category: string;
  timestamp: any;
  cleared: boolean;
  uid: string;
  lockedCategory?: boolean;
  lockedDescription?: boolean;
}

interface Discussion {
  id: string;
  discussionId: string;
  description: string;
  timestamp: any;
  typeSay: string;
  cleared?: boolean;
}

// API key loader component
const IndexScreen: React.FC<{
  onApiKeyLoaded: (cachedApiKey: string | null) => void;
}> = ({ onApiKeyLoaded }) => {
  const [loading, setLoading] = useState(true);

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
  }, [onApiKeyLoaded]);

  if (loading) return <ActivityIndicator size="large" color="#0000ff" />;
  return null;
};

// Main component
export default function AskJanet() {
  // State variables
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isQuestion, setIsQuestion] = useState(false);
  const [inDJ_Mode, setInDJ_Mode] = useState(false);
  const [history, setHistory] = useState<
    { text: string; type: string; aiResponse?: string }[]
  >([]);
  const [discussion, setDiscussion] = useState<Discussion | null>(null);
  const router = useRouter();
  const [responses, setResponses] = useState<
    { responseType: string; text: string }[]
  >([]);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [discussionCounts, setDiscussionCounts] = useState<
    {
      discussionID: string;
      activityLogId: string;
      count: number;
      description: string;
    }[]
  >([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogQuestion, setDialogQuestion] = useState('');
  const [distinctCategories, setDistinctCategories] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [filePath, setFilePath] = useState<string>('');
  const [currentDiscussion, setCurrentDiscussion] = useState<Discussion | null>(
    null
  );
  const [processedDiscussions, setProcessedDiscussions] = useState<string[]>(
    []
  );
  const dialogRef = useRef<View>(null);

  // Authentication state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserEmail(user.email);
        console.log('User:', user.email, 'UID:', user.uid);
        setUID(user.uid);
        setTimeout(async () => {
          try {
            await initializeUser();
            await loadInitialData();
          } catch (error) {
            console.error('Init err:', error);
          }
        }, 500);
      } else {
        console.log('No user, to login');
        setTimeout(() => router.replace('/login'), 500);
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, [router]);

  // Load initial Firestore data
  async function loadInitialData() {
    if (!auth.currentUser?.uid) {
      console.error('No UID.');
      return;
    }
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

      const uid = auth.currentUser.uid;
      const q = query(collection(db, `Users/${uid}/DiscussionCounts`));
      const querySnapshot = await getDocs(q);
      const countsPromises = querySnapshot.docs.map(async (docSnapshot) => {
        const activityLogRef = doc(
          db,
          'ActivityLog',
          docSnapshot.data().activityLogId as string
        );
        const activityLogSnap = await getDoc(activityLogRef);
        if (activityLogSnap.exists()) {
          const activityLogData = activityLogSnap.data() as ActivityLog;
          return {
            discussionID: docSnapshot.id,
            activityLogId: docSnapshot.data().activityLogId as string,
            count: docSnapshot.data().count as number,
            description: activityLogData.description || 'No description',
          };
        }
        return null;
      });

      const counts = (await Promise.all(countsPromises))
        .filter((count): count is NonNullable<typeof count> => count !== null)
        .sort((a, b) => b.count - a.count);
      setDiscussionCounts(counts);
      console.log('Counts:', counts);
    } catch (error) {
      console.error('Data err:', error);
    }
  }

  // Initialize user
  async function initializeUser() {
    console.log('User init...');
  }

  // Sign out handler
  const handleSignOut = async () => {
    try {
      await signOut(auth);
      console.log('Signed out');
      setMenuVisible(false);
      router.replace('/login');
    } catch (error: any) {
      console.error('Sign-out err:', error.message);
    }
  };

  // Input change handler
  const handleInputChange = (text: string) => {
    setInput(text);
    setIsQuestion(/\b(what|when|how|why|does|is|can)\b/i.test(text));
    setInDJ_Mode(/\b(DJ mode|dj mode|Dj mode|DJ|dj)\b/i.test(text));
  };

  // Fetch discussions
  async function fetchDiscussions() {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error('No user ID.');
      return;
    }

    console.log('Fetching discussion...');
    try {
      const { snapshot, hasMore } = await getNextOpenDiscussion();
      if (snapshot && !snapshot.empty) {
        console.log('Docs:', snapshot.docs.length);
        const docSnapshot = snapshot.docs[0];
        const discussionTyped: Discussion = {
          id: docSnapshot.id,
          discussionId: docSnapshot.data().id || docSnapshot.id,
          description: docSnapshot.data().description || 'No description',
          timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
          typeSay: docSnapshot.data().typeSay || 'ask',
          cleared: docSnapshot.data().cleared || false,
        };
        console.log('Process:', discussionTyped.description);

        if (
          processedDiscussions.includes(discussionTyped.id) ||
          discussionTyped.cleared
        ) {
          console.log('Skip:', discussionTyped.id);
          if (hasMore) fetchDiscussions();
          return;
        }

        setProcessedDiscussions((prev) => [...prev, discussionTyped.id]);

        // Open modal for both 'ask' and 'tell'
        console.log('Dialog:', discussionTyped.description);
        try {
          const categories = await getDistinctCategories();
          console.log('Cats:', categories);
          setDistinctCategories(categories);
          setDialogQuestion(discussionTyped.description || 'No description');
          setCurrentDiscussion(discussionTyped);
          setSelectedCategories([]);
          setFilePath('');
          setDialogVisible(true);
        } catch (error) {
          console.error('Dialog err:', error.message, error.code);
          setDialogQuestion('Error');
          setDialogVisible(false);
          setCurrentDiscussion(null);
          if (hasMore) fetchDiscussions();
        }
      } else {
        console.log('No discussions.');
      }
    } catch (error) {
      console.error('Fetch err:', error.message, error.code);
    }
  }

  // Check unique ActivityLog
  const checkUniqueActivityLog = async (
    discussionId: string,
    category: string,
    description: string
  ) => {
    try {
      const q = query(
        collection(db, 'ActivityLog'),
        where('discussionId', '==', discussionId),
        where('category', '==', category),
        where('description', '==', description)
      );
      const snapshot = await getDocs(q);
      return snapshot.empty;
    } catch (error) {
      console.error('Unique err:', error);
      return false;
    }
  };

  // Add ActivityLog
  const handleAddActivityLog = async () => {
    if (!currentDiscussion || !auth.currentUser?.uid) {
      console.error('No discussion/user.');
      Alert.alert('Error', 'No discussion/user.');
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
        return;
      }

      const activityLogDoc = doc(collection(db, 'ActivityLog'));
      await setDoc(activityLogDoc, {
        id: activityLogDoc.id,
        discussionId,
        description,
        category,
        timestamp: new Date(),
        cleared: false,
        uid: auth.currentUser.uid,
      });
      console.log('Added:', activityLogDoc.id);
      Alert.alert('Success', 'Added.');
      setDialogVisible(false);
      setCurrentDiscussion(null);
      fetchDiscussions();
    } catch (error) {
      console.error('Add err:', error);
      Alert.alert('Error', 'Failed.');
    }
  };

  // Delete ActivityLog
  const handleDeleteActivityLog = async () => {
    if (!currentDiscussion) {
      console.error('No discussion.');
      Alert.alert('Error', 'No discussion.');
      return;
    }

    try {
      const q = query(
        collection(db, 'ActivityLog'),
        where('discussionId', '==', currentDiscussion.id)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const docRef = doc(db, 'ActivityLog', snapshot.docs[0].id);
        await deleteDoc(docRef);
        console.log('Deleted:', snapshot.docs[0].id);
        Alert.alert('Success', 'Deleted.');
      } else {
        console.log('No entry:', currentDiscussion.id);
        Alert.alert('Info', 'No entry.');
      }
      setDialogVisible(false);
      setCurrentDiscussion(null);
      fetchDiscussions();
    } catch (error) {
      console.error('Delete err:', error);
      Alert.alert('Error', 'Failed.');
    }
  };

  // Save text file
  const handleSaveTxt = async () => {
    if (!currentDiscussion) {
      console.error('No discussion.');
      setFilePath('Error');
      Alert.alert('Error', 'No discussion.');
      return;
    }

    try {
      const content = `Question: ${dialogQuestion}\nCategories: ${
        selectedCategories.length > 0 ? selectedCategories.join(', ') : 'None'
      }\nDescription: ${await getActivityLogDescription()}`;
      const fileName = `question_${currentDiscussion.id}_${Date.now()}.txt`;
      const tempPath = `${FileSystem.documentDirectory}${fileName}`;

      await FileSystem.writeAsStringAsync(tempPath, content);
      setFilePath(tempPath);
      Clipboard.setString(`Question: ${dialogQuestion}\nPath: ${tempPath}`);
      Alert.alert(
        'Success',
        `Saved to app storage: ${tempPath}\nPath copied to clipboard.`
      );
    } catch (error) {
      console.error('Save TXT err:', error.message, error.code);
      setFilePath('Error');
      Alert.alert('Error', `Failed to save: ${error.message}`);
    }
  };

  // Save image (disabled)
  const handleSaveImage = async (format: 'jpg' | 'png') => {
    Alert.alert(
      'Error',
      `Image saving (${format.toUpperCase()}) is disabled in this version.`
    );
  };

  // Get ActivityLog description
  async function getActivityLogDescription() {
    try {
      if (!currentDiscussion) return 'None';
      const snapshot = await getDocs(collection(db, 'ActivityLog'));
      const relatedLog = snapshot.docs.find(
        (doc) => doc.data().discussionId === currentDiscussion.id
      );
      return relatedLog ? relatedLog.data().description || 'None' : 'None';
    } catch (error) {
      console.error('Desc err:', error);
      return 'None';
    }
  }

  // Confirm dialog
  const handleDialogConfirm = async () => {
    if (!currentDiscussion) {
      console.error('No discussion.');
      setDialogVisible(false);
      setCurrentDiscussion(null);
      fetchDiscussions();
      return;
    }

    try {
      console.log('Confirm:', currentDiscussion.id);
      const isUnique = await checkUniqueActivityLog(
        currentDiscussion.id,
        selectedCategories.join(', ') || 'uncategorized',
        dialogQuestion || 'No question'
      );
      if (!isUnique) {
        Alert.alert('Error', 'Duplicate.');
        return;
      }

      if (currentDiscussion.typeSay === 'ask') {
        const gptResponseId = await addQuestionDiscussion(
          input,
          currentDiscussion.id
        );
        const parsedResponses = await disperseQuestion(
          currentDiscussion.id,
          gptResponseId
        );
        if (parsedResponses) {
          const newResponses = parsedResponses.map((response) => ({
            responseType: 'gpt response',
            text: response.toString(),
          }));
          setHistory((prev) => [
            ...prev,
            ...newResponses.map((response) => ({
              text: response.text,
              type: 'answer',
            })),
          ]);
          setResponses(newResponses);
          console.log('Resp:', newResponses);
        }
      } else if (currentDiscussion.typeSay === 'tell') {
        // Handle 'tell' submission: save to ActivityLog
        const category = selectedCategories.join(', ') || 'uncategorized';
        const description = dialogQuestion || 'No question';
        const activityLogDoc = doc(collection(db, 'ActivityLog'));
        await setDoc(activityLogDoc, {
          id: activityLogDoc.id,
          discussionId: currentDiscussion.id,
          description,
          category,
          timestamp: new Date(),
          cleared: false,
          uid: auth.currentUser?.uid,
        });
        console.log('ActivityLog added for tell:', activityLogDoc.id);
      }

      setDialogVisible(false);
      setCurrentDiscussion(null);
      setResponses([]);
      fetchDiscussions();
    } catch (error) {
      console.error('Confirm err:', error);
      setDialogVisible(false);
      setCurrentDiscussion(null);
      setResponses([]);
      fetchDiscussions();
    }
  };

  // Cancel dialog
  const handleDialogCancel = async () => {
    console.log('Cancel dialog, no clearing');
    setDialogVisible(false);
    setCurrentDiscussion(null);
    setResponses([]);
    fetchDiscussions();
  };

  // Toggle category
  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((cat) => cat !== category)
        : [...prev, category]
    );
  };

  // Check for existing discussion
  const findExistingDiscussion = async (description: string, uid: string) => {
    try {
      console.log('Searching for existing discussion:', description);
      const q = query(
        collection(db, `Users/${uid}/Discussions`),
        where('description', '==', description),
        where('typeSay', '==', 'ask')
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        console.log('Found existing discussion ID:', doc.id);
        return {
          id: doc.id,
          ...doc.data(),
        } as Discussion;
      }
      console.log('No existing discussion found for:', description);
      return null;
    } catch (error) {
      console.error('Error checking existing discussion:', error);
      return null;
    }
  };

  // Handle resubmitting a previous question
  const handleResubmitQuestion = async (question: string) => {
    console.log('Resubmitting question:', question);
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.error('No user ID for resubmission.');
      return;
    }

    // Check for existing discussion
    const existingDiscussion = await findExistingDiscussion(question, uid);
    if (existingDiscussion) {
      console.log('Reusing existing discussion:', existingDiscussion.id);
      // Update timestamp and ensure cleared is false
      try {
        await setDoc(
          doc(db, `Users/${uid}/Discussions`, existingDiscussion.id),
          {
            ...existingDiscussion,
            timestamp: new Date(),
            cleared: false,
          },
          { merge: true }
        );
        console.log('Updated existing discussion:', existingDiscussion.id);
        setInput(question);
        setIsQuestion(true);
        setDialogQuestion(question);
        setCurrentDiscussion(existingDiscussion);
        setDialogVisible(true);
      } catch (error) {
        console.error('Error updating existing discussion:', error);
        Alert.alert('Error', 'Failed to resubmit question.');
      }
    } else {
      // No existing discussion, proceed with new submission
      console.log('No existing discussion, creating new one for:', question);
      handleInputChange(question);
      handleSubmit();
    }
  };

  // Submit input
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
      console.log('Discussion saved with ID:', discussionId || 'undefined');
      setInput('');
      fetchDiscussions();
      console.log('Submission complete:', transformedInput);

      if (isQuestion) {
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
      }
    } catch (error: any) {
      console.error('Submit err:', error);
    }
  };

  // Toggle menu
  const toggleMenu = () => setMenuVisible(!menuVisible);

  // Loading state
  if (loadingAuth) return <ActivityIndicator size="large" color="#0000ff" />;

  // Render UI
  return (
    <View style={styles.container}>
      <IndexScreen onApiKeyLoaded={setApiKey} />
      <Header />
      <InputField input={input} onChange={handleInputChange} />
      <ActionButtons isQuestion={isQuestion} onSubmit={handleSubmit} />
      <FlatList
        data={history}
        keyExtractor={(item, index) => `${item.text}-${index}`}
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
        <SettingsButton style={styles.settingsButton} />
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
            <Text style={styles.modalTitle}>
              {currentDiscussion?.typeSay === 'ask'
                ? 'Question Details'
                : 'Fact Details'}
            </Text>
            <Text style={styles.modalLabel}>
              Entry: {dialogQuestion || 'None'}
            </Text>
            <Text style={styles.modalLabel}>Categories:</Text>
            <FlatList
              data={distinctCategories}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.categoryItem}
                  onPress={() => toggleCategory(item)}
                >
                  <Text style={styles.categoryText}>{item}</Text>
                  <Text>{selectedCategories.includes(item) ? '✔' : '⬜'}</Text>
                </TouchableOpacity>
              )}
            />
            <Text style={styles.modalLabel}>File: {filePath || 'None'}</Text>
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
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleDialogConfirm}
              >
                <Text style={styles.modalButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
    width: '100%',
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
    backgroundColor: '#f5f5f5',
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
    maxHeight: '80%',
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
    backgroundColor: 'rgba(0, 122, 255, 0.1)', // Light blue background for questions
  },
  factItem: {
    backgroundColor: 'rgba(40, 167, 69, 0.1)', // Light green background for facts
  },
  historyText: {
    fontSize: 16,
    fontWeight: '500',
  },
  questionText: {
    color: '#007AFF', // Blue for questions
  },
  factText: {
    color: '#28A745', // Green for facts
  },
  aiResponse: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
});
