import React, { useState, useEffect, memo, useCallback } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Alert, Switch, ScrollView, Dimensions } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { db } from "../firebaseConfig";
import { collection, doc, getDocs, deleteDoc, updateDoc, addDoc, DocumentData, QuerySnapshot, query, getDoc, writeBatch } from "firebase/firestore";
import { getUID } from "../utils/uidManager";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { addOrUpdateActivityLog, addOrUpdateGPTResponse, getDistinctCategories } from "@/services/databaseService";
import { processPhrase } from "@/services/phraseProcessor";

// Screen width for responsive design
const SCREEN_WIDTH = Dimensions.get("window").width;

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

// Memoized RelatedLogEntry
const RelatedLogEntry = memo(({ log, description, onDescriptionChange, onCategoryChange }: {
  log: ActivityLog;
  description: string;
  onDescriptionChange: (id: string, text: string) => void;
  onCategoryChange: (id: string) => void;
}) => {
  console.log(`Rendering RelatedLogEntry for ID: ${log.id}`);
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
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.log.id === nextProps.log.id &&
    prevProps.description === nextProps.description &&
    prevProps.log.category === nextProps.log.category
  );
});

// Memoized RowItem for FlatList
const RowItem = memo(({ item, columns, renderRightActions, renderLeftActions }: {
  item: any;
  columns: { Header: string; accessor: string; hidden?: boolean; style?: any; flex?: number }[];
  renderRightActions: (tableName: string, itemId: string) => JSX.Element;
  renderLeftActions: (tableName: string, itemId: string, currentDesc: string, currentCleared: string, currentTypeSay: string) => JSX.Element;
}) => {
  console.log(`Rendering RowItem for ID: ${item.id}`);
  return (
    <Swipeable
      renderRightActions={() => renderRightActions(item.tableName, item.id)}
      renderLeftActions={() => renderLeftActions(item.tableName, item.id, item.description, item.cleared, item.typeSay)}
    >
      <View style={styles.row}>
        {columns.map((col) => (
          !col.hidden ? (
            <Text
              key={`${item.id}-${col.accessor}`}
              style={[styles.cell, col.style, { flex: col.flex }]}
            >
              {item[col.accessor] ?? "N/A"}
            </Text>
          ) : null
        ))}
      </View>
    </Swipeable>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.description === nextProps.item.description &&
    prevProps.item.cleared === nextProps.item.cleared &&
    prevProps.item.typeSay === nextProps.item.typeSay
  );
});

const MainComponent: React.FC = () => {
  const [tables, setTables] = useState<SwipeableTablePropsType[]>([]);
  const [sortBy, setSortBy] = useState<{ column: string; order: "asc" | "desc" } | null>(null);
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [originalDesc, setOriginalDesc] = useState("");
  const [editCleared, setEditCleared] = useState(false);
  const [editTypeSay, setEditTypeSay] = useState<"ask" | "tell">("tell");
  const [editTimestamp, setEditTimestamp] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [editTableName, setEditTableName] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [discussionSnapshot, setDiscussionSnapshot] = useState<QuerySnapshot<DocumentData, DocumentData> | null>(null);
  const [relatedActivityLogs, setRelatedActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogDescriptions, setActivityLogDescriptions] = useState<{ [key: string]: string }>({});
  const [activityLogCategories, setActivityLogCategories] = useState<{ [key: string]: string }>({});
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedActivityLogId, setSelectedActivityLogId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>(["Blood Pressure"]);
  const [newCategory, setNewCategory] = useState("");
  const [discussionCounts, setDiscussionCounts] = useState<(DiscussionCount & { description: string })[]>([]);
  const [uid, setUid] = useState<string | null>(null);

  // Fetch UID once on mount
  useEffect(() => {
    const fetchUid = async () => {
      const userId = await getUID();
      setUid(userId);
      if (!userId) {
        setError("User ID not found. Please sign in again.");
        setLoading(false);
      }
    };
    fetchUid();
  }, []);

  const fetchData = useCallback(async () => {
    if (!uid) return;
    try {
      setLoading(true);
      console.log("Fetching data from Firestore...");
      const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
      const discussionSnap = await getDocs(collection(db, "Discussion"));
      setDiscussionSnapshot(discussionSnap);

      const categories = await getDistinctCategories();
      setAllCategories((prev) => [...new Set([...prev, ...categories])]);

      const q = query(collection(db, `Users/${uid}/DiscussionCounts`));
      const querySnapshot = await getDocs(q);
      const countsPromises = querySnapshot.docs.map(async document => {
        const data = document.data() as DiscussionCount;
        const activityLogRef = doc(db, "ActivityLog", data.activityLogId);
        const activityLogSnap = await getDoc(activityLogRef);
        if (activityLogSnap.exists()) {
          const activityLogData = activityLogSnap.data() as ActivityLog;
          return {
            discussionID: document.id,
            activityLogId: data.activityLogId,
            count: data.count,
            description: activityLogData.description || "",
          };
        }
        return null;
      });

      const counts = (await Promise.all(countsPromises))
        .filter((count): count is DiscussionCount & { description: string } => count !== null)
        .sort((a, b) => b.count - a.count);
      setDiscussionCounts(counts);
      console.log("✅ Fetched DiscussionCounts:", counts);

      console.log("Fetching table data...");
      const activityLogData = activityLogSnapshot.docs
        .map((doc) => {
          const data = doc.data() as ActivityLog;
          if (!doc.id || !data.uid) {
            console.warn(`Invalid ActivityLog document: ${JSON.stringify(data)}`);
            return null;
          }
          return {
            ...data,
            id: doc.id,
            timestamp: data.timestamp
              ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
              : "N/A",
            cleared: data.cleared ? "✔️ Yes" : "❌ No",
            uid: data.uid,
            rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
            tableName: "Activity Log Data",
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.id !== undefined)
        .filter((doc) => doc.uid === uid)
        .sort((a, b) => b.rawTimestamp - a.rawTimestamp);

      const discussionData = discussionSnap.docs
        .map((doc) => {
          const data = doc.data();
          if (!doc.id || !data.uid) {
            console.warn(`Invalid Discussion document: ${JSON.stringify(data)}`);
            return null;
          }
          return {
            ...data,
            id: doc.id,
            timestamp: data.timestamp
              ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
              : "N/A",
            cleared: data.cleared ? "✔️ Yes" : "❌ No",
            typeSay: data.typeSay || "tell",
            uid: data.uid,
            rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
            tableName: "Discussion Data",
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null && item.id !== undefined)
        .filter((doc) => doc.uid === uid)
        .sort((a, b) => b.rawTimestamp - a.rawTimestamp);

      setTables([
        {
          name: "Activity Log Data",
          columns: [
            { Header: "ID", accessor: "id", hidden: true },
            { Header: "Date", accessor: "timestamp", flex: 1 },
            { Header: "Category", accessor: "category", style: styles.leftAlignCell, flex: 1 },
            { Header: "Desc", accessor: "description", style: styles.leftAlignCell, flex: 2 },
            { Header: "Cleared", accessor: "cleared", hidden: true, style: styles.leftAlignCell },
          ],
          data: activityLogData,
        },
        {
          name: "Discussion Data",
          columns: [
            { Header: "ID", accessor: "id", hidden: true },
            { Header: "Date", accessor: "timestamp", flex: 1 },
            { Header: "Type", accessor: "typeSay", style: styles.leftAlignCell, flex: 1 },
            { Header: "Desc", accessor: "description", style: styles.leftAlignCell, flex: 2 },
            { Header: "Cleared", accessor: "cleared", style: styles.leftAlignCell, flex: 1 },
          ],
          data: discussionData,
        },
      ]);
      setInitialized(true);
    } catch (error) {
      console.error("Error fetching data from Firestore:", error);
      setError("Failed to fetch data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    if (uid) {
      console.log("Mounting MainComponent, fetching data...");
      fetchData();
    }
  }, [uid, fetchData]);

  useEffect(() => {
    if (initialized && currentTableIndex === 0 && discussionSnapshot) {
      console.log("Triggering prompt2UpdateActivityLog with snapshot size:", discussionSnapshot?.size);
      prompt2UpdateActivityLog(discussionSnapshot);
    }
  }, [currentTableIndex, initialized, discussionSnapshot]);

  const prompt2UpdateActivityLog = useCallback((discussionSnapshot: QuerySnapshot<DocumentData, DocumentData>): void => {
    console.log("Inside prompt2UpdateActivityLog, snapshot size:", discussionSnapshot.size);
    if (!discussionSnapshot || discussionSnapshot.empty) {
      console.log('No documents in snapshot to process.');
      return;
    }

    const unclearedDocs = discussionSnapshot.docs.filter(
      (doc) => doc.data().cleared === false
    );

    console.log("Uncleared documents:", unclearedDocs.length);
    if (unclearedDocs.length === 0) {
      console.log('No uncleared documents to process.');
      return;
    }

    const discussionList = unclearedDocs
      .map((doc) => `"${doc.data().description || 'No description'}"`)
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
              console.log('Starting Activity Log update...');
              const distinctCategories = await getDistinctCategories();
              if (!uid) {
                console.error("User ID is null, cannot proceed with ActivityLog update.");
                Alert.alert('Error', 'User ID not found. Please sign in again.');
                return;
              }

              for (const docSnapshot of unclearedDocs) {
                const discussionTyped = {
                  id: docSnapshot.id,
                  discussionId: docSnapshot.data().id || docSnapshot.id,
                  description: docSnapshot.data().description || "",
                  timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
                  typeSay: docSnapshot.data().typeSay || "tell",
                  cleared: docSnapshot.data().cleared || false,
                };
                if (!discussionTyped.cleared) {
                  console.log('Processing Discussion:', discussionTyped.id);
                  const activityAnalysis = await processPhrase(
                    { categories: distinctCategories, description: discussionTyped.description },
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
                  let newActivityLogId: string;
                  if (activityAnalysis.category === "uncategorized") {
                    const newActivityLog = await addDoc(collection(db, "ActivityLog"), {
                      discussionId: discussionTyped.id,
                      category: "uncategorized",
                      description: "",
                      timestamp: discussionTyped.timestamp,
                      cleared: false,
                      uid: uid,
                      lockedCategory: false,
                      lockedDescription: false,
                    });
                    newActivityLogId = newActivityLog.id;
                    console.log(`Created new ActivityLog entry for discussionId ${discussionTyped.id} (uncategorized)`);
                  } else {
                    const newActivityLog = await addDoc(collection(db, "ActivityLog"), {
                      discussionId: discussionTyped.id,
                      category: activityAnalysis.category,
                      description: activityAnalysis.parsedDescription,
                      timestamp: discussionTyped.timestamp,
                      cleared: false,
                      uid: uid,
                      lockedCategory: false,
                      lockedDescription: false,
                    });
                    newActivityLogId = newActivityLog.id;
                    console.log(`Created new ActivityLog entry for discussionId ${discussionTyped.id} with category ${activityAnalysis.category}`);
                  }
                  const docRef = doc(db, 'Discussion', discussionTyped.id);
                  await updateDoc(docRef, { cleared: true });
                  console.log(`Marked Discussion ${discussionTyped.id} as cleared`);

                  const newDiscussionCount = {
                    discussionID: discussionTyped.id,
                    activityLogId: newActivityLogId,
                    count: 1,
                    description: activityAnalysis.parsedDescription || "",
                  };
                  await addDoc(collection(db, `Users/${uid}/DiscussionCounts`), newDiscussionCount);
                  setDiscussionCounts((prev) => [...prev, newDiscussionCount].sort((a, b) => b.count - a.count));
                }
              }
              console.log('Activity Log update completed successfully.');
              Alert.alert('Success', `${unclearedDocs.length} Activity Log entries updated successfully!`);
            } catch (error) {
              console.error('Error updating Activity Log:', error);
              Alert.alert('Error', `Failed to update Activity Log: ${(error as any).message}`);
            }
          },
        },
      ],
      { cancelable: true }
    );
  }, [uid, discussionCounts]);

  const handleSort = useCallback((column: string) => {
    setSortBy((prev) => {
      const newOrder = prev?.column === column && prev.order === "asc" ? "desc" : "asc";
      return { column, order: newOrder };
    });
  }, []);

  const sortedData = useCallback(() => {
    if (!sortBy || tables.length === 0) return tables[currentTableIndex]?.data || [];
    const { column, order } = sortBy;
    return [...tables[currentTableIndex].data].sort((a, b) => {
      const valueA = a[column] || "";
      const valueB = b[column] || "";
      if (typeof valueA === "string" && typeof valueB === "string") {
        return order === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return order === "asc" ? (valueA > valueB ? 1 : -1) : (valueA < valueB ? 1 : -1);
    });
  }, [sortBy, tables, currentTableIndex]);

  const filteredData = useCallback(() => {
    if (tables.length === 0) return sortedData();
    const data = sortedData().filter((row) =>
      Object.entries(filters).every(([column, value]) =>
        row[column]?.toString().toLowerCase().includes(value.toLowerCase())
      )
    );
    console.log("Filtered data:", data.map(item => item.id));
    return data;
  }, [tables, filters, sortBy, currentTableIndex, sortedData]);

  const handleDelete = useCallback(async (tableName: string, itemId: string) => {
    try {
      const collectionName = tableName === "Activity Log Data" ? "ActivityLog" : "Discussion";
      await deleteDoc(doc(db, collectionName, itemId));
      setTables((prevTables) =>
        prevTables.map((table) =>
          table.name === tableName
            ? { ...table, data: table.data.filter((item) => item.id !== itemId) }
            : table
        )
      );
      console.log(`Deleted item ${itemId} from ${collectionName}`);
      Alert.alert("Success", "Item deleted successfully.");
    } catch (error) {
      console.error("Error deleting item:", error);
      Alert.alert("Error", "Failed to delete item.");
    }
  }, []);

  const handleEdit = useCallback(async (tableName: string, itemId: string, currentDesc: string, currentCleared: string, currentTypeSay: string) => {
    setEditTableName(tableName);
    setEditItemId(itemId);
    setEditDesc(currentDesc || "");
    setOriginalDesc(currentDesc || "");
    setEditCleared(currentCleared === "✔️ Yes");
    setEditTypeSay(currentTypeSay === "ask" ? "ask" : "tell");
    const table = tables.find((t) => t.name === tableName);
    const item = table?.data.find((i) => i.id === itemId);
    setEditTimestamp(item?.rawTimestamp || new Date());

    let descriptionToProcess = currentDesc || "";
    let discussionId = itemId;

    try {
      const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
      if (tableName === "Discussion Data") {
        const relatedLogs = activityLogSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as ActivityLog))
          .filter((log) => log.discussionId === itemId);
        console.log(`Found ${relatedLogs.length} related ActivityLog entries for discussionId ${itemId}`);
        setRelatedActivityLogs(relatedLogs);
        const descriptions = relatedLogs.reduce((acc, log) => {
          acc[log.id] = log.description || "";
          return acc;
        }, {} as { [key: string]: string });
        const categories = relatedLogs.reduce((acc, log) => {
          acc[log.id] = log.category || "uncategorized";
          return acc;
        }, {} as { [key: string]: string });
        setActivityLogDescriptions(descriptions);
        setActivityLogCategories(categories);
      } else if (tableName === "Activity Log Data") {
        const activityLog = activityLogSnapshot.docs.find((doc) => doc.id === itemId);
        if (activityLog) {
          const activityData = activityLog.data() as ActivityLog;
          discussionId = activityData.discussionId;
          const discussionSnapshot = await getDocs(collection(db, "Discussion"));
          const relatedDiscussion = discussionSnapshot.docs.find((doc) => doc.id === discussionId);
          if (relatedDiscussion) {
            const discussionData = relatedDiscussion.data();
            descriptionToProcess = discussionData.description || "";
            const relatedLogs = activityLogSnapshot.docs
              .map((doc) => ({ id: doc.id, ...doc.data() } as ActivityLog))
              .filter((log) => log.discussionId === discussionId && log.id !== itemId);
            setRelatedActivityLogs(relatedLogs);
            const descriptions = relatedLogs.reduce((acc, log) => {
              acc[log.id] = log.description || "";
              return acc;
            }, {} as { [key: string]: string });
            const categories = relatedLogs.reduce((acc, log) => {
              acc[log.id] = log.category || "uncategorized";
              return acc;
            }, {} as { [key: string]: string });
            setActivityLogDescriptions(descriptions);
            setActivityLogCategories(categories);
          }
        }
      }

      if (descriptionToProcess && uid) {
        const activityAnalysis = await processPhrase(
          { categories: allCategories, description: descriptionToProcess },
          discussionCounts,
          setDiscussionCounts,
          discussionId,
          uid
        );

        if (activityAnalysis.category !== "uncategorized") {
          const existingLogs = activityLogSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ActivityLog))
            .filter((log) => log.discussionId === discussionId);
          
          if (existingLogs.length === 0) {
            const newActivityLog = await addDoc(collection(db, "ActivityLog"), {
              discussionId: discussionId,
              category: activityAnalysis.category,
              description: activityAnalysis.parsedDescription,
              timestamp: editTimestamp,
              cleared: false,
              uid: uid,
              lockedCategory: false,
              lockedDescription: false,
            });
            console.log(`Created new ActivityLog entry for discussionId ${discussionId}`);
            setRelatedActivityLogs((prev) => [
              ...prev,
              {
                id: newActivityLog.id,
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
              [newActivityLog.id]: activityAnalysis.parsedDescription,
            }));
            setActivityLogCategories((prev) => ({
              ...prev,
              [newActivityLog.id]: activityAnalysis.category,
            }));
          }

          const discussionRef = doc(db, "Discussion", discussionId);
          await updateDoc(discussionRef, { cleared: true });
          setEditCleared(true);
        }
      }
    } catch (error) {
      console.error("Error fetching related ActivityLog entries:", error);
      setRelatedActivityLogs([]);
      setActivityLogDescriptions({});
      setActivityLogCategories({});
      Alert.alert("Error", "Failed to fetch related entries.");
    }

    setEditModalVisible(true);
  }, [tables, allCategories, discussionCounts, uid, editTimestamp]);

  const handleCategorySelect = useCallback(async (category: string) => {
    if (!selectedActivityLogId) return;

    try {
      setRelatedActivityLogs((prev) =>
        prev.map((log) =>
          log.id === selectedActivityLogId ? { ...log, category, lockedCategory: true } : log
        )
      );
      setActivityLogCategories((prev) => ({
        ...prev,
        [selectedActivityLogId]: category,
      }));

      const logRef = doc(db, "ActivityLog", selectedActivityLogId);
      await updateDoc(logRef, {
        category,
        lockedCategory: true,
      });
      console.log(`Updated ActivityLog ${selectedActivityLogId} category to ${category}`);

      if (!allCategories.includes(category)) {
        setAllCategories((prev) => [...prev, category]);
      }

      await addDoc(collection(db, "RuleCandidates"), {
        discussionId: editItemId,
        category,
        description: activityLogDescriptions[selectedActivityLogId] || "",
      });

      const discussionRef = doc(db, "Discussion", editItemId);
      await updateDoc(discussionRef, { cleared: true });
      setEditCleared(true);

      setCategoryModalVisible(false);
      setNewCategory("");
      setSelectedActivityLogId(null);
    } catch (error) {
      console.error("Error updating category:", error);
      Alert.alert("Error", "Failed to update category.");
    }
  }, [selectedActivityLogId, activityLogDescriptions, editItemId, allCategories]);

  const handleAddNewCategory = useCallback(() => {
    if (newCategory.trim()) {
      handleCategorySelect(newCategory.trim());
    } else {
      Alert.alert("Error", "New category cannot be empty.");
    }
  }, [newCategory, handleCategorySelect]);

  const saveEdit = useCallback(async () => {
    if (!editDesc || !editDesc.trim()) {
      Alert.alert("Error", "Description cannot be empty.");
      return;
    }

    if (!uid || !editItemId || !editTableName) {
      console.error("Invalid saveEdit inputs:", { uid, editItemId, editTableName });
      Alert.alert("Error", "Missing user ID or item data. Please try again.");
      return;
    }

    try {
      console.log("Starting saveEdit for:", { editTableName, editItemId, editDesc, editCleared, editTypeSay, editTimestamp });

      const batch = writeBatch(db);
      const collectionName = editTableName === "Activity Log Data" ? "ActivityLog" : "Discussion";
      const primaryRef = doc(db, collectionName, editItemId);
      const primaryUpdates = {
        description: editDesc,
        cleared: editCleared,
        typeSay: editTypeSay,
        timestamp: editTimestamp,
      };
      console.log(`Updating ${collectionName} ${editItemId}:`, primaryUpdates);
      batch.update(primaryRef, primaryUpdates);

      if (relatedActivityLogs.length > 0) {
        for (const log of relatedActivityLogs) {
          const newDescription = activityLogDescriptions[log.id]?.trim();
          const newCategory = activityLogCategories[log.id];
          const updates: {
            description?: string;
            category?: string;
            cleared?: boolean;
            timestamp: Date;
            lockedCategory?: boolean;
            lockedDescription?: boolean;
          } = { timestamp: editTimestamp };

          if (newDescription && newDescription !== log.description) {
            updates.description = newDescription;
            updates.lockedDescription = true;
            const ruleCandidateRef = doc(collection(db, "RuleCandidates"));
            batch.set(ruleCandidateRef, {
              discussionId: editItemId,
              category: newCategory || log.category,
              description: newDescription,
            });
            console.log(`Adding RuleCandidate for ActivityLog ${log.id}:`, {
              discussionId: editItemId,
              category: newCategory || log.category,
              description: newDescription,
            });

            if (uid) {
              const discussionCountRef = doc(collection(db, `Users/${uid}/DiscussionCounts`));
              const newDiscussionCount = {
                discussionID: editItemId,
                activityLogId: log.id,
                count: 1,
                description: newDescription,
              };
              batch.set(discussionCountRef, newDiscussionCount);
              console.log(`Adding DiscussionCount for ${log.id}:`, newDiscussionCount);
            }
          }

          if (newCategory && newCategory !== log.category && !log.lockedCategory) {
            updates.category = newCategory;
          }
          updates.lockedCategory = log.lockedCategory || false;
          updates.lockedDescription = log.lockedDescription || false;

          const logRef = doc(db, "ActivityLog", log.id);
          console.log(`Updating ActivityLog ${log.id}:`, updates);
          batch.update(logRef, updates);
        }

        if (editTableName === "Discussion Data") {
          const discussionRef = doc(db, "Discussion", editItemId);
          batch.update(discussionRef, { cleared: true });
          console.log(`Marking Discussion ${editItemId} as cleared`);
        }
      }

      if (editTableName === "Discussion Data") {
        const gptSnapshot = await getDocs(collection(db, "GPTResponses"));
        const relatedGPT = gptSnapshot.docs.find((doc) => doc.id === editItemId);
        if (relatedGPT) {
          const gptRef = doc(db, "GPTResponses", editItemId);
          batch.update(gptRef, { timestamp: editTimestamp });
          console.log(`Updating GPTResponses ${editItemId} timestamp to ${editTimestamp}`);
        }
      }

      console.log("Committing Firestore batch...");
      await batch.commit();
      console.log("Firestore batch committed successfully");

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
                        cleared: editCleared ? "✔️ Yes" : "❌ No",
                        typeSay: editTypeSay,
                        timestamp: editTimestamp
                          ? format(new Date(editTimestamp), "M/d/yy \n h:mm a")
                          : "N/A",
                        rawTimestamp: editTimestamp || new Date(),
                      }
                    : item
                ),
              }
            : table.name === "Activity Log Data"
            ? {
                ...table,
                data: table.data.map((item) =>
                  relatedActivityLogs.some((log) => log.id === item.id)
                    ? {
                        ...item,
                        description: activityLogDescriptions[item.id] || item.description,
                        category: activityLogCategories[item.id] || item.category,
                        cleared: item.cleared,
                        timestamp: editTimestamp
                          ? format(new Date(editTimestamp), "M/d/yy \n h:mm a")
                          : item.timestamp,
                        rawTimestamp: editTimestamp || item.rawTimestamp,
                      }
                    : item
                ),
              }
            : table
        )
      );

      console.log(`Updated item ${editItemId} in ${collectionName} and related data`);
      setEditModalVisible(false);
      setShowDatePicker(false);
      setShowTimePicker(false);
      setRelatedActivityLogs([]);
      setActivityLogDescriptions({});
      setActivityLogCategories({});
      Alert.alert("Success", "Item and related ActivityLog entries updated successfully.");
    } catch (error) {
      console.error("Error in saveEdit:", error, { editTableName, editItemId, editDesc, editCleared, editTypeSay, editTimestamp, relatedActivityLogs });
      Alert.alert("Error", `Failed to save changes: ${error}`);
    }
  }, [editDesc, editCleared, editTypeSay, editTimestamp, editTableName, editItemId, relatedActivityLogs, activityLogDescriptions, activityLogCategories, uid]);

  const renderRightActions = useCallback((tableName: string, itemId: string) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(tableName, itemId)}
    >
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  ), [handleDelete]);

  const renderLeftActions = useCallback((tableName: string, itemId: string, currentDesc: string, currentCleared: string, currentTypeSay: string) => (
    <TouchableOpacity
      style={styles.editButton}
      onPress={() => handleEdit(tableName, itemId, currentDesc, currentCleared, currentTypeSay)}
    >
      <Text style={styles.editButtonText}>Edit</Text>
    </TouchableOpacity>
  ), [handleEdit]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 48,
    offset: 48 * index,
    index,
  }), []);

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
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {initialized && tables.length > 0 ? (
        <View style={styles.tableContainer}>
          <View style={styles.navigation}>
            {tables.map((table) => (
              <TouchableOpacity
                key={table.name}
                style={[styles.navButton, currentTableIndex === tables.findIndex(t => t.name === table.name) && styles.navButtonActive]}
                onPress={() => setCurrentTableIndex(tables.findIndex(t => t.name === table.name))}
              >
                <Text style={styles.navButtonText}>{table.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.tableHeader}>{tables[currentTableIndex]?.name || "Loading..."}</Text>

          <View style={styles.filterRow}>
            {tables[currentTableIndex]?.columns.map((col) => (
              !col.hidden ? (
                <TextInput
                  key={col.accessor}
                  style={[styles.filterInput, { flex: col.flex }]}
                  placeholder={`Filter ${col.Header}`}
                  value={filters[col.accessor] || ""}
                  onChangeText={(text) => setFilters((prev) => ({ ...prev, [col.accessor]: text }))}
                />
              ) : null
            ))}
          </View>

          <View style={styles.headerRow}>
            {tables[currentTableIndex]?.columns.map((col) => (
              !col.hidden ? (
                <TouchableOpacity
                  key={col.accessor}
                  onPress={() => handleSort(col.accessor)}
                  style={[styles.headerCell, { flex: col.flex }]}
                >
                  <Text style={styles.headerText}>
                    {col.Header} {sortBy?.column === col.accessor ? (sortBy.order === "asc" ? "↑" : "↓") : ""}
                  </Text>
                </TouchableOpacity>
              ) : null
            ))}
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
                <Text style={styles.modalTitle}>Edit {editTableName} Entry</Text>
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
                {editTableName === "Discussion Data" && (
                  <View style={styles.switchContainer}>
                    <Text style={styles.modalLabel}>Type: ${editTypeSay === "ask" ? "Ask" : "Tell"}</Text>
                    <Switch
                      value={editTypeSay === "ask"}
                      onValueChange={(value) => setEditTypeSay(value ? "ask" : "tell")}
                    />
                  </View>
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Date:</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                    <Text>{editTimestamp ? format(editTimestamp, "M/d/yy") : "Select Date"}</Text>
                  </TouchableOpacity>
                </View>
                {showDatePicker && (
                  <DateTimePicker
                    value={editTimestamp}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowDatePicker(Platform.OS === "ios");
                      if (selectedDate) {
                        setEditTimestamp(selectedDate);
                      }
                    }}
                  />
                )}
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Time:</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                    <Text>{editTimestamp ? format(editTimestamp, "h:mm a") : "Select Time"}</Text>
                  </TouchableOpacity>
                </View>
                {showTimePicker && (
                  <DateTimePicker
                    value={editTimestamp}
                    mode="time"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowTimePicker(Platform.OS === "ios");
                      if (selectedDate) {
                        setEditTimestamp(selectedDate);
                      }
                    }}
                  />
                )}
                {(editTableName === "Discussion Data" || editTableName === "Activity Log Data") && relatedActivityLogs.length > 0 && (
                  <View style={styles.relatedLogsContainer}>
                    <Text style={styles.modalSubtitle}>Related Activity Log Entries</Text>
                    {relatedActivityLogs.slice(0, 5).map((item) => (
                      <RelatedLogEntry
                        key={item.id}
                        log={item}
                        description={activityLogDescriptions[item.id] || ""}
                        onDescriptionChange={(id, text) => setActivityLogDescriptions((prev) => ({ ...prev, [id]: text }))}
                        onCategoryChange={(id) => {
                          setSelectedActivityLogId(id);
                          setCategoryModalVisible(true);
                        }}
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
                  <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEdit}>
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
              setNewCategory("");
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
                      setNewCategory("");
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
          <Text style={styles.errorText}>No data available. Please try again.</Text>
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
    backgroundColor: "#f9f9f9", 
    justifyContent: "center", 
    alignItems: "center" 
  },
  tableContainer: { 
    flex: 1, 
    width: SCREEN_WIDTH - 20, 
    alignSelf: "center" 
  },
  navigation: { 
    flexDirection: "row", 
    justifyContent: "center", 
    marginBottom: 10, 
    width: "100%" 
  },
  navButton: { 
    padding: 8, 
    marginHorizontal: 5, 
    backgroundColor: "#ddd", 
    borderRadius: 5 
  },
  navButtonActive: { 
    backgroundColor: "#007bff" 
  },
  navButtonText: { 
    fontSize: 12, 
    fontWeight: "bold", 
    color: "#fff" 
  },
  filterRow: { 
    flexDirection: "row", 
    marginBottom: 8, 
    width: "100%" 
  },
  filterInput: { 
    padding: 4, 
    marginHorizontal: 2, 
    borderWidth: 1, 
    borderRadius: 5, 
    borderColor: "#ccc", 
    fontSize: 12 
  },
  tableHeader: { 
    fontSize: 16, 
    fontWeight: "bold", 
    textAlign: "center", 
    marginBottom: 10 
  },
  headerRow: { 
    flexDirection: "row", 
    backgroundColor: "#f2f2f2", 
    padding: 6, 
    width: "100%" 
  },
  headerCell: { 
    fontWeight: "bold", 
    textAlign: "center", 
    paddingVertical: 4 
  },
  headerText: { 
    fontSize: 12 
  },
  row: { 
    flexDirection: "row", 
    padding: 6, 
    backgroundColor: "#fff", 
    width: "100%", 
    minHeight: 48 
  },
  cell: { 
    textAlign: "center", 
    fontSize: 12, 
    paddingVertical: 4, 
    paddingHorizontal: 2 
  },
  leftAlignCell: { 
    textAlign: "left" 
  },
  tableList: { 
    flex: 1, 
    width: "100%" 
  },
  deleteButton: { 
    backgroundColor: "#ff4444", 
    justifyContent: "center", 
    alignItems: "center", 
    width: 80, 
    height: "100%" 
  },
  deleteButtonText: { 
    color: "#fff", 
    fontWeight: "bold" 
  },
  editButton: { 
    backgroundColor: "#007bff", 
    justifyContent: "center", 
    alignItems: "center", 
    width: 80, 
    height: "100%" 
  },
  editButtonText: { 
    color: "#fff", 
    fontWeight: "bold" 
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "rgba(0, 0, 0, 0.5)" 
  },
  modalContainer: { 
    width: "90%", 
    maxHeight: "80%", 
    backgroundColor: "#fff", 
    padding: 15, 
    borderRadius: 10 
  },
  categoryModalContainer: { 
    width: "80%", 
    maxHeight: "60%", 
    backgroundColor: "#fff", 
    padding: 15, 
    borderRadius: 10 
  },
  modalTitle: { 
    fontSize: 16, 
    fontWeight: "bold", 
    marginBottom: 8 
  },
  modalSubtitle: { 
    fontSize: 14, 
    fontWeight: "bold", 
    marginTop: 8, 
    marginBottom: 5 
  },
  modalInput: { 
    width: "100%", 
    borderWidth: 1, 
    borderColor: "#ccc", 
    borderRadius: 5, 
    padding: 6, 
    marginBottom: 8, 
    minHeight: 30 
  },
  switchContainer: { 
    flexDirection: "row", 
    alignItems: "center", 
    marginBottom: 8 
  },
  modalLabel: { 
    fontSize: 12, 
    marginRight: 6 
  },
  modalButtons: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    width: "100%", 
    marginTop: 8 
  },
  modalButton: { 
    padding: 6, 
    borderRadius: 5, 
    backgroundColor: "#ddd", 
    width: "45%", 
    alignItems: "center" 
  },
  saveButton: { 
    backgroundColor: "#007bff" 
  },
  modalButtonText: { 
    color: "#fff", 
    fontWeight: "bold", 
    fontSize: 12 
  },
  relatedLogsContainer: { 
    width: "100%", 
    marginVertical: 8 
  },
  relatedLogEntry: { 
    marginBottom: 8 
  },
  categoryItem: { 
    padding: 6, 
    borderBottomWidth: 1, 
    borderBottomColor: "#ccc" 
  },
  categoryText: { 
    fontSize: 12 
  },
  loadingText: { 
    fontSize: 16, 
    color: "#333" 
  },
  errorText: { 
    fontSize: 16, 
    color: "#ff4444", 
    textAlign: "center", 
    marginBottom: 20 
  },
  retryButton: { 
    padding: 10, 
    backgroundColor: "#007bff", 
    borderRadius: 5 
  },
  retryButtonText: { 
    color: "#fff", 
    fontWeight: "bold" 
  },
});

export default MainComponent;