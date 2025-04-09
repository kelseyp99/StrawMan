import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal, Alert, Switch } from "react-native";
import { format } from "date-fns";
import { db } from "../firebaseConfig";
import { collection, doc, getDocs, deleteDoc, updateDoc, DocumentData, QuerySnapshot } from "firebase/firestore";
import { getUID } from "../utils/uidManager";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { addOrUpdateActivityLog, addOrUpdateGPTResponse, getDistinctCategories } from "@/services/databaseService";
import { processPhrase } from "@/services/phraseProcessor";

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
  const [editCleared, setEditCleared] = useState(false);
  const [editTypeSay, setEditTypeSay] = useState<"tell" | "ask">("tell"); // New state for type toggle
  const [editTableName, setEditTableName] = useState("");
  const [editItemId, setEditItemId] = useState("");
  const [discussionSnapshot, setDiscussionSnapshot] = useState<QuerySnapshot<DocumentData, DocumentData> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching data from Firestore...");
        const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
        const discussionSnap = await getDocs(collection(db, "Discussion"));
        setDiscussionSnapshot(discussionSnap);
        const uid = getUID();
        
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
                const data = doc.data();
                return {
                  id: doc.id,
                  ...data,
                  timestamp: data.timestamp
                    ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
                    : "N/A",
                  cleared: data.cleared ? "✔️ Yes" : "❌ No",
                  uid: data.uid,
                  rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(0),
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
                  id: doc.id,
                  ...data,
                  timestamp: data.timestamp
                    ? format(new Date(data.timestamp.toDate()), "M/d/yy \n h:mm a")
                    : "N/A",
                  cleared: data.cleared ? "✔️ Yes" : "❌ No",
                  uid: data.uid,
                  rawTimestamp: data.timestamp ? data.timestamp.toDate() : new Date(0),
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

  const handleEdit = (tableName: string, itemId: string, currentDesc: string, currentCleared: string, currentTypeSay: string) => {
    setEditTableName(tableName);
    setEditItemId(itemId);
    setEditDesc(currentDesc || "");
    setEditCleared(currentCleared === "✔️ Yes");
    setEditTypeSay(currentTypeSay === "ask" ? "ask" : "tell"); // Set initial type
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (editDesc && editDesc.trim()) {
      try {
        const collectionName = editTableName === "Activity Log Data" ? "ActivityLog" : "Discussion";
        const docRef = doc(db, collectionName, editItemId);
        const updateData = editTableName === "Discussion Data" 
          ? { description: editDesc.trim(), cleared: editCleared, typeSay: editTypeSay }
          : { description: editDesc.trim(), cleared: editCleared };
        await updateDoc(docRef, updateData);
        setTables((prevTables) =>
          prevTables.map((table) =>
            table.name === editTableName
              ? {
                  ...table,
                  data: table.data.map((item) =>
                    item.id === editItemId 
                      ? { 
                          ...item, 
                          description: editDesc.trim(),
                          cleared: editCleared ? "✔️ Yes" : "❌ No",
                          ...(editTableName === "Discussion Data" && { typeSay: editTypeSay })
                        } 
                      : item
                  ),
                }
              : table
          )
        );
        console.log(`Updated item ${editItemId} in ${collectionName}`);
        setEditModalVisible(false);
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
              for (const docSnapshot of unclearedDocs) {
                const discussionTyped = {
                  id: docSnapshot.id,
                  discussionId: docSnapshot.data().id,
                  description: docSnapshot.data().description,
                  timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
                  typeSay: docSnapshot.data().typeSay,
                  cleared: docSnapshot.data().cleared,
                };
                if (!discussionTyped.cleared) {
                  console.log('Processing Discussion:', discussionTyped.id);
                  const activityAnalysis = await processPhrase({
                    categories: distinctCategories,
                    description: discussionTyped.description,
                  });
                  await addOrUpdateGPTResponse(
                    discussionTyped.id,
                    JSON.stringify(activityAnalysis),
                    'updateDB'
                  );
                }
                const docRef = doc(db, 'Discussion', discussionTyped.id);
                await updateDoc(docRef, { cleared: true });
              }
              addOrUpdateActivityLog();
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
            onRequestClose={() => setEditModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Edit Entry</Text>
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
                    <Text style={styles.modalLabel}>Type (Tell/Ask):</Text>
                    <Switch 
                      value={editTypeSay === "ask"} 
                      onValueChange={(value) => setEditTypeSay(value ? "ask" : "tell")} 
                    />
                    <Text>{editTypeSay}</Text>
                  </View>
                )}
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalButton} onPress={() => setEditModalVisible(false)}>
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEdit}>
                    <Text style={styles.modalButtonText}>Save</Text>
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
  modalTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  modalInput: { width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 5, padding: 10, marginBottom: 20, minHeight: 60 },
  switchContainer: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  modalLabel: { fontSize: 16, marginRight: 10 },
  modalButtons: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  modalButton: { padding: 10, borderRadius: 5, backgroundColor: "#ddd", width: "45%", alignItems: "center" },
  saveButton: { backgroundColor: "#007bff" },
  modalButtonText: { color: "#fff", fontWeight: "bold" },
});

export default MainComponent;