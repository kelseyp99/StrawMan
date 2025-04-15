import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Alert, Switch, ScrollView } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { format } from "date-fns";
import { db } from "../firebaseConfig";
import { collection, doc, getDocs, deleteDoc, updateDoc, addDoc, DocumentData, QuerySnapshot, query, getDoc } from "firebase/firestore";
import { getUID } from "../utils/uidManager";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { addOrUpdateActivityLog, addOrUpdateGPTResponse, getDistinctCategories } from "@/services/databaseService";
import { processPhrase } from "@/services/phraseProcessor";

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
  }[];
}

const MainComponent: React.FC = () => {
  const [tables, setTables] = useState<SwipeableTablePropsType[]>([]);
  const [sortBy, setSortBy] = useState<{ column: string; order: "asc" | "desc" } | null>(null);
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [initialized, setInitialized] = useState(false);
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
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [selectedActivityLogId, setSelectedActivityLogId] = useState<string | null>(null);
  const [allCategories, setAllCategories] = useState<string[]>(["Blood Pressure"]);
  const [newCategory, setNewCategory] = useState("");
  const [discussionCounts, setDiscussionCounts] = useState<(DiscussionCount & { description: string })[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching data from Firestore...");
        const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
        const discussionSnap = await getDocs(collection(db, "Discussion"));
        setDiscussionSnapshot(discussionSnap);
        const uid = getUID();
        
        const categories = await getDistinctCategories();
        setAllCategories((prev) => [...new Set([...prev, ...categories])]);
        
        if (uid) {
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
                description: activityLogData.description,
              };
            }
            return null;
          });

          const counts = (await Promise.all(countsPromises))
            .filter((count): count is DiscussionCount & { description: string } => count !== null)
            .sort((a, b) => b.count - a.count);
          setDiscussionCounts(counts);
          console.log("✅ Fetched DiscussionCounts:", counts);
        }

        console.log("fetching table data");
        setTables([
          {
            name: "Activity Log Data",
            columns: [
              { Header: "ID", accessor: "id", hidden: true },
              { Header: "Date", accessor: "timestamp" },
              { Header: "Category", accessor: "category", style: styles.leftAlignCell },
              { Header: "Desc", accessor: "description", style: styles.leftAlignCell },
              { Header: "Cleared", accessor: "cleared", hidden: true, style: styles.leftAlignCell },
            ],
            data: activityLogSnapshot.docs
              .map((doc) => {
                const data = doc.data() as ActivityLog;
                return {
                  ...data,
                  timestamp: data.timestamp
                    ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
                    : "N/A",
                  cleared: data.cleared ? "✔️ Yes" : "❌ No",
                  uid: data.uid,
                  rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
                };
              })
              .filter((doc) => doc.uid === uid)
              .sort((a, b) => b.rawTimestamp - a.rawTimestamp),
          },
          {
            name: "Discussion Data",
            columns: [
              { Header: "ID", accessor: "id", hidden: true },
              { Header: "Date", accessor: "timestamp" },
              { Header: "Type", accessor: "typeSay", style: styles.leftAlignCell },
              { Header: "Desc", accessor: "description", style: styles.leftAlignCell },
              { Header: "Cleared", accessor: "cleared", style: styles.leftAlignCell },
            ],
            data: discussionSnap.docs
              .map((doc) => {
                const data = doc.data();
                return {
                  ...data,
                  timestamp: data.timestamp
                    ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
                    : "N/A",
                  cleared: data.cleared ? "✔️ Yes" : "❌ No",
                  typeSay: data.typeSay || "tell",
                  uid: data.uid,
                  rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
                };
              })
              .filter((doc) => doc.uid === uid)
              .sort((a, b) => b.rawTimestamp - a.rawTimestamp),
          },
        ]);
      } catch (error) {
        console.error("Error fetching data from Firestore:", error);
      }
    };

    if (tables.length === 0) {
      fetchData();
    }
  }, [tables.length]);

  useEffect(() => {
    if (initialized && currentTableIndex === 0 && discussionSnapshot) {
      prompt2UpdateActivityLog(discussionSnapshot);
    }
  }, [currentTableIndex, initialized, discussionSnapshot]);

  useEffect(() => {
    if (tables.length > 0) {
      setInitialized(true);
    }
  }, [tables]);

  const handleSort = (column: string) => {
    setSortBy((prev) => {
      const newOrder = prev?.column === column && prev.order === "asc" ? "desc" : "asc";
      return { column, order: newOrder };
    });
  };

  const filteredData = () => {
    if (tables.length === 0) return sortedData();
    return sortedData().filter((row) =>
      Object.entries(filters).every(([column, value]) =>
        row[column]?.toString().toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  const sortedData = () => {
    if (!sortBy || tables.length === 0) return tables[currentTableIndex].data;
    const { column, order } = sortBy;
    return [...tables[currentTableIndex].data].sort((a, b) => {
      const valueA = a[column] || "";
      const valueB = b[column] || "";
      if (typeof valueA === "string" && typeof valueB === "string") {
        return order === "asc" ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
      }
      return order === "asc" ? (valueA > valueB ? 1 : -1) : (valueA < valueB ? 1 : -1);
    });
  };

  const handleDelete = async (tableName: string, itemId: string) => {
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
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const handleEdit = async (tableName: string, itemId: string, currentDesc: string, currentCleared: string, currentTypeSay: string) => {
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

    if (tableName === "Discussion Data") {
      try {
        const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
        const relatedLogs = activityLogSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() } as ActivityLog))
          .filter((log) => log.discussionId === itemId);
        console.log(`Found ${relatedLogs.length} related ActivityLog entries for discussionId ${itemId}`, relatedLogs);
        setRelatedActivityLogs(relatedLogs);
        const descriptions = relatedLogs.reduce((acc, log) => {
          acc[log.id] = log.description || "";
          return acc;
        }, {} as { [key: string]: string });
        setActivityLogDescriptions(descriptions);
      } catch (error) {
        console.error("Error fetching related ActivityLog entries:", error);
        setRelatedActivityLogs([]);
        setActivityLogDescriptions({});
      }

      const uid = getUID();
      if (uid) {
        const activityAnalysis = await processPhrase(
          { categories: allCategories, description: descriptionToProcess },
          discussionCounts,
          setDiscussionCounts,
          itemId,
          uid
        );

        if (activityAnalysis.category !== "uncategorized") {
          const newActivityLog = await addDoc(collection(db, "ActivityLog"), {
            discussionId: itemId,
            category: activityAnalysis.category,
            description: activityAnalysis.parsedDescription,
            timestamp: editTimestamp,
            cleared: false,
            uid: uid,
            lockedCategory: false,
            lockedDescription: false,
          });
          console.log(`Created new ActivityLog entry for discussionId ${itemId}`);

          const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
          const relatedLogs = activityLogSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() } as ActivityLog))
            .filter((log) => log.discussionId === itemId);
          setRelatedActivityLogs(relatedLogs);
          const descriptions = relatedLogs.reduce((acc, log) => {
            acc[log.id] = log.description || "";
            return acc;
          }, {} as { [key: string]: string });
          setActivityLogDescriptions(descriptions);

          const discussionRef = doc(db, "Discussion", itemId);
          await updateDoc(discussionRef, { cleared: true });
          setEditCleared(true);
        }
      }
    } else if (tableName === "Activity Log Data") {
      try {
        const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
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
            setActivityLogDescriptions(descriptions);

            const uid = getUID();
            if (uid) {
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

                if (existingLogs.length > 0) {
                  for (const log of existingLogs) {
                    const updates: { description?: string; category?: string; timestamp: Date; lockedCategory?: boolean; lockedDescription?: boolean } = { timestamp: editTimestamp };
                    if (!log.lockedCategory) {
                      updates.category = activityAnalysis.category;
                    }
                    if (!log.lockedDescription) {
                      updates.description = activityAnalysis.parsedDescription;
                    }
                    updates.lockedCategory = log.lockedCategory || false;
                    updates.lockedDescription = log.lockedDescription || false;
                    const logRef = doc(db, "ActivityLog", log.id);
                    await updateDoc(logRef, updates);
                    console.log(`Updated ActivityLog ${log.id} based on related Discussion description`);
                  }
                } else {
                  await addDoc(collection(db, "ActivityLog"), {
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
                }

                const discussionRef = doc(db, "Discussion", discussionId);
                await updateDoc(discussionRef, { cleared: true });
                setEditCleared(true);

                const updatedLogs = activityLogSnapshot.docs
                  .map((doc) => ({ id: doc.id, ...doc.data() } as ActivityLog))
                  .filter((log) => log.discussionId === discussionId && log.id !== itemId);
                setRelatedActivityLogs(updatedLogs);
                const updatedDescriptions = updatedLogs.reduce((acc, log) => {
                  acc[log.id] = log.description || "";
                  return acc;
                }, {} as { [key: string]: string });
                setActivityLogDescriptions(updatedDescriptions);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching related Discussion or ActivityLog entries:", error);
        setRelatedActivityLogs([]);
        setActivityLogDescriptions({});
      }
    }

    setEditModalVisible(true);
  };

  const handleCategorySelect = async (category: string) => {
    if (!selectedActivityLogId) return;

    setRelatedActivityLogs((prev) =>
      prev.map((log) =>
        log.id === selectedActivityLogId ? { ...log, category, lockedCategory: true } : log
      )
    );

    if (!allCategories.includes(category)) {
      setAllCategories((prev) => [...prev, category]);
    }

    await addDoc(collection(db, "RuleCandidates"), {
      discussionId: editItemId,
      category,
      description: relatedActivityLogs.find((log) => log.id === selectedActivityLogId)?.description || "",
    });

    const discussionRef = doc(db, "Discussion", editItemId);
    await updateDoc(discussionRef, { cleared: true });
    setEditCleared(true);

    setCategoryModalVisible(false);
    setNewCategory("");
    setSelectedActivityLogId(null);
  };

  const handleAddNewCategory = () => {
    if (newCategory.trim()) {
      handleCategorySelect(newCategory.trim());
    }
  };

  const saveEdit = async () => {
    if (editDesc && editDesc.trim()) {
      try {
        const collectionName = editTableName === "Activity Log Data" ? "ActivityLog" : "Discussion";
        const docRef = doc(db, collectionName, editItemId);
        await updateDoc(docRef, { 
          description: editDesc,
          cleared: editCleared,
          typeSay: editTypeSay,
          timestamp: editTimestamp,
        });

        const uid = getUID();
        if (editTableName === "Discussion Data" && relatedActivityLogs.length > 0) {
          for (const log of relatedActivityLogs) {
            const newDescription = activityLogDescriptions[log.id]?.trim();
            const updates: { description?: string; timestamp: Date; category?: string; lockedCategory?: boolean; lockedDescription?: boolean } = { timestamp: editTimestamp };
            if (newDescription && newDescription !== log.description) {
              updates.description = newDescription;
              updates.lockedDescription = true;
              await addDoc(collection(db, "RuleCandidates"), {
                discussionId: editItemId,
                category: log.category,
                description: newDescription,
              });

              if (uid) {
                const newDiscussionCount = {
                  discussionID: editItemId,
                  activityLogId: log.id,
                  count: 1,
                  description: newDescription
                };
                await addDoc(collection(db, `Users/${uid}/DiscussionCounts`), newDiscussionCount);
                setDiscussionCounts(prev => [...prev, newDiscussionCount].sort((a, b) => b.count - a.count));
              }

              await updateDoc(doc(db, "Discussion", editItemId), { cleared: true });
              setEditCleared(true);
            }
            updates.category = log.category;
            updates.lockedCategory = log.lockedCategory || false;
            updates.lockedDescription = log.lockedDescription || false;
            const logRef = doc(db, "ActivityLog", log.id);
            await updateDoc(logRef, updates);
            console.log(`Updated ActivityLog ${log.id} timestamp to ${editTimestamp}, category to ${log.category}`);
          }
        }

        if (editTableName === "Discussion Data") {
          const gptSnapshot = await getDocs(collection(db, "GPTResponses"));
          const relatedGPT = gptSnapshot.docs.find((doc) => doc.id === editItemId);
          if (relatedGPT) {
            const gptRef = doc(db, "GPTResponses", editItemId);
            await updateDoc(gptRef, { timestamp: editTimestamp });
            console.log(`Updated GPTResponses ${editItemId} timestamp to ${editTimestamp}`);
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
              : table
          )
        );

        if (editTableName === "Discussion Data") {
          const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
          const uid = getUID();
          setTables((prevTables) =>
            prevTables.map((table) =>
              table.name === "Activity Log Data"
                ? {
                    ...table,
                    data: activityLogSnapshot.docs
                      .map((doc) => {
                        const data = doc.data() as ActivityLog;
                        return {
                          ...data,
                          timestamp: data.timestamp
                            ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
                            : "N/A",
                          cleared: data.cleared ? "✔️ Yes" : "❌ No",
                          uid: data.uid,
                          rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
                        };
                      })
                      .filter((doc) => doc.uid === uid)
                      .sort((a, b) => b.rawTimestamp - a.rawTimestamp),
                  }
                : table
            )
          );
        }

        console.log(`Updated item ${editItemId} in ${collectionName}`);
        setEditModalVisible(false);
        setShowDatePicker(false);
        setShowTimePicker(false);
        setRelatedActivityLogs([]);
        setActivityLogDescriptions({});
      } catch (error) {
        console.error("Error updating item:", error);
      }
    }
  };

  function prompt2UpdateActivityLog(discussionSnapshot: QuerySnapshot<DocumentData, DocumentData>): void {
    console.log("inside prompt2UpdateActivityLog");
    if (!discussionSnapshot || discussionSnapshot.empty) {
      console.log('No documents in snapshot to process.');
      return;
    }

    const unclearedDocs = discussionSnapshot.docs.filter(
      (doc) => doc.data().cleared === false
    );

    if (unclearedDocs.length === 0) {
      console.log('No uncleared documents to process.');
      return;
    }

    const discussionList = unclearedDocs
      .map((doc) => `"${doc.data().description}"`)
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
              const distinctCategories = await getDistinctCategories();
              const uid = getUID();
              if (!uid) {
                console.error("User ID is null, cannot proceed with ActivityLog update.");
                Alert.alert('Error', 'User ID not found. Please sign in again.');
                return;
              }

              for (const docSnapshot of unclearedDocs) {
                const discussionTyped = {
                  id: docSnapshot.id,
                  discussionId: docSnapshot.data().id,
                  description: docSnapshot.data().description,
                  timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
                  typeSay: docSnapshot.data().typeSay || "tell",
                  cleared: docSnapshot.data().cleared,
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
                  if (activityAnalysis.category === "uncategorized") {
                    await addDoc(collection(db, "ActivityLog"), {
                      discussionId: discussionTyped.id,
                      category: "uncategorized",
                      description: "",
                      timestamp: discussionTyped.timestamp,
                      cleared: false,
                      uid: uid,
                      lockedCategory: false,
                      lockedDescription: false,
                    });
                    console.log(`Created new ActivityLog entry for discussionId ${discussionTyped.id} (uncategorized)`);
                  } else {
                    console.log(`ActivityLog entry for discussionId ${discussionTyped.id} auto-populated`);
                  }
                  const docRef = doc(db, 'Discussion', discussionTyped.id);
                  await updateDoc(docRef, { cleared: true });
                  console.log(`Marked Discussion ${discussionTyped.id} as cleared`);
                }
              }
              Alert.alert('Success', `${unclearedDocs.length} Activity Log entries updated successfully!`);
            } catch (error) {
              console.error('Error updating Activity Log:', error);
              Alert.alert('Error', 'Failed to update Activity Log.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  }

  const renderRightActions = (tableName: string, itemId: string) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(tableName, itemId)}
    >
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  );

  const renderLeftActions = (tableName: string, itemId: string, currentDesc: string, currentCleared: string, currentTypeSay: string) => (
    <TouchableOpacity
      style={styles.editButton}
      onPress={() => handleEdit(tableName, itemId, currentDesc, currentCleared, currentTypeSay)}
    >
      <Text style={styles.editButtonText}>Edit</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      {initialized && (
        <>
          <View style={styles.navigation}>
            {tables.map((table, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.navButton, currentTableIndex === index && styles.navButtonActive]}
                onPress={() => setCurrentTableIndex(index)}
              >
                <Text style={styles.navButtonText}>{table.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.tableHeader}>{tables[currentTableIndex].name}</Text>

          <View style={styles.filterRow}>
            {tables[currentTableIndex].columns.map((col) =>
              !col.hidden ? (
                <TextInput
                  key={col.accessor}
                  style={styles.filterInput}
                  placeholder={`Filter ${col.Header}`}
                  value={filters[col.accessor] || ""}
                  onChangeText={(text) => setFilters((prev) => ({ ...prev, [col.accessor]: text }))}
                />
              ) : null
            )}
          </View>

          <View style={styles.headerRow}>
            {tables[currentTableIndex].columns.map((col) =>
              !col.hidden ? (
                <TouchableOpacity key={col.accessor} onPress={() => handleSort(col.accessor)} style={styles.headerCell}>
                  <Text>
                    {col.Header} {sortBy?.column === col.accessor ? (sortBy.order === "asc" ? "↑" : "↓") : ""}
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
          </View>

          <FlatList
            data={filteredData()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable
                renderRightActions={() => renderRightActions(tables[currentTableIndex].name, item.id)}
                renderLeftActions={() => renderLeftActions(tables[currentTableIndex].name, item.id, item.description, item.cleared, item.typeSay)}
              >
                <View style={styles.row}>
                  {tables[currentTableIndex].columns.map((col) =>
                    !col.hidden ? (
                      <Text key={col.accessor} style={[styles.cell, col.style]}>
                        {item[col.accessor]}
                      </Text>
                    ) : null
                  )}
                </View>
              </Swipeable>
            )}
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
              <ScrollView contentContainerStyle={styles.modalContainer}>
                <Text style={styles.modalTitle}>Edit Discussion Entry</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  placeholder="Enter new description"
                />
                <View style={styles.switchContainer}>
                  <Text style={styles.modalLabel}>Cleared:</Text>
                  <Switch value={editCleared} onValueChange={setEditCleared} />
                </View>
                {editTableName === "Discussion Data" && (
                  <View style={styles.switchContainer}>
                    <Text style={styles.modalLabel}>Type: {editTypeSay === "ask" ? "Ask" : "Tell"}</Text>
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
                    <Text style={styles.modalTitle}>Related Activity Log Entries</Text>
                    {relatedActivityLogs.map((log) => (
                      <View key={log.id} style={styles.relatedLogEntry}>
                        <Text style={styles.modalLabel}>Activity Log ID: {log.id}</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setSelectedActivityLogId(log.id);
                            setCategoryModalVisible(true);
                          }}
                        >
                          <Text style={styles.modalLabel}>Category: {log.category}</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={styles.modalInput}
                          value={activityLogDescriptions[log.id] || ""}
                          onChangeText={(text) => {
                            setActivityLogDescriptions((prev) => ({ ...prev, [log.id]: text }));
                            setRelatedActivityLogs((prev) =>
                              prev.map((l) =>
                                l.id === log.id ? { ...l, lockedDescription: true } : l
                              )
                            );
                            addDoc(collection(db, "RuleCandidates"), {
                              discussionId: editItemId,
                              category: log.category,
                              description: text,
                            });
                            updateDoc(doc(db, "Discussion", editItemId), { cleared: true });
                            setEditCleared(true);
                          }}
                          multiline
                          placeholder="Edit Activity Log description"
                        />
                      </View>
                    ))}
                  </View>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalButton} onPress={() => {
                    setEditModalVisible(false);
                    setShowDatePicker(false);
                    setShowTimePicker(false);
                    setRelatedActivityLogs([]);
                    setActivityLogDescriptions({});
                  }}>
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
            onRequestClose={() => setCategoryModalVisible(false)}
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
        </>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10, backgroundColor: "#f9f9f9" },
  navigation: { flexDirection: "row", justifyContent: "center", marginBottom: 10 },
  navButton: { padding: 8, marginHorizontal: 5, backgroundColor: "#ddd", borderRadius: 5 },
  navButtonActive: { backgroundColor: "#007bff" },
  navButtonText: { fontSize: 12, fontWeight: "bold", color: "#fff" },
  filterRow: { flexDirection: "row", marginBottom: 8 },
  filterInput: { flex: 1, padding: 4, margin: 2, borderWidth: 1, borderRadius: 5, borderColor: "#ccc", fontSize: 12 },
  tableHeader: { fontSize: 16, fontWeight: "bold", textAlign: "center" },
  headerRow: { flexDirection: "row", backgroundColor: "#f2f2f2", padding: 6 },
  headerCell: { flex: 1, fontWeight: "bold", textAlign: "center" },
  row: { flexDirection: "row", padding: 6, backgroundColor: "#fff" },
  cell: { flex: 1, textAlign: "center" },
  leftAlignCell: { textAlign: "left" },
  deleteButton: { backgroundColor: "#ff4444", justifyContent: "center", alignItems: "center", width: 80, height: "100%" },
  deleteButtonText: { color: "#fff", fontWeight: "bold" },
  editButton: { backgroundColor: "#007bff", justifyContent: "center", alignItems: "center", width: 80, height: "100%" },
  editButtonText: { color: "#fff", fontWeight: "bold" },
  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0, 0, 0, 0.5)" },
  modalContainer: { width: "80%", backgroundColor: "#fff", padding: 20, borderRadius: 10, alignItems: "center" },
  categoryModalContainer: { width: "80%", backgroundColor: "#fff", padding: 20, borderRadius: 10, maxHeight: "60%" },
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  modalInput: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 20, minHeight: 60 },
  switchContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  modalLabel: { fontSize: 16, marginRight: 10 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: 20 },
  modalButton: { padding: 10, borderRadius: 5, backgroundColor: "#ddd", width: "45%", alignItems: "center" },
  saveButton: { backgroundColor: "#007bff" },
  modalButtonText: { color: "#fff", fontWeight: "bold" },
  relatedLogsContainer: { width: "100%", marginVertical: 10 },
  relatedLogEntry: { marginBottom: 15 },
  categoryItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: "#ccc" },
  categoryText: { fontSize: 16 },
});

export default MainComponent;