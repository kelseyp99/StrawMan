import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, Modal } from "react-native";
import { format } from "date-fns";
import { db } from "../firebaseConfig";
import { collection, doc, getDocs, deleteDoc, updateDoc } from "firebase/firestore";
import { getUID } from "../utils/uidManager";
import Swipeable from "react-native-gesture-handler/Swipeable";

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

const MainComponent = () => {
  const [tables, setTables] = useState<SwipeableTablePropsType[]>([]);
  const [sortBy, setSortBy] = useState<{ column: string; order: "asc" | "desc" } | null>(null);
  const [currentTableIndex, setCurrentTableIndex] = useState(0);
  const [filters, setFilters] = useState<{ [key: string]: string }>({});
  const [initialized, setInitialized] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [editTableName, setEditTableName] = useState("");
  const [editItemId, setEditItemId] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log("Fetching data from Firestore...");
        const activityLogSnapshot = await getDocs(collection(db, "ActivityLog"));
        const discussionSnapshot = await getDocs(collection(db, "Discussion"));
        const uid = getUID();

        setTables([
          {
            name: "Activity Log Data",
            columns: [
              { Header: "ID", accessor: "id", hidden: true },
              { Header: "Date", accessor: "timestamp" },
              { Header: "Category", accessor: "category", style: styles.leftAlignCell },
              { Header: "Desc", accessor: "description", style: styles.leftAlignCell },
              { Header: "Cleared", accessor: "cleared", hidden: true },
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
            data: discussionSnapshot.docs
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
    if (tables.length > 0) {
      setInitialized(true);
    }
  }, [tables]);

  // Sorting Function
  const handleSort = (column: string) => {
    setSortBy((prev) => {
      const newOrder = prev?.column === column && prev.order === "asc" ? "desc" : "asc";
      return { column, order: newOrder };
    });
  };

  // Filtering Function (per column)
  const filteredData = () => {
    if (tables.length === 0) return sortedData();
    return sortedData().filter((row) =>
      Object.entries(filters).every(([column, value]) =>
        row[column]?.toString().toLowerCase().includes(value.toLowerCase())
      )
    );
  };

  // Sorting Function
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

  // Delete Function
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

  // Edit Function with Modal
  const handleEdit = (tableName: string, itemId: string, currentDesc: string) => {
    setEditTableName(tableName);
    setEditItemId(itemId);
    setEditDesc(currentDesc || ""); // Pre-fill with current description
    setEditModalVisible(true); // Show modal
  };

  // Save Edit Function
  const saveEdit = async () => {
    if (editDesc && editDesc.trim()) {
      try {
        const collectionName = editTableName === "Activity Log Data" ? "ActivityLog" : "Discussion";
        const docRef = doc(db, collectionName, editItemId);
        await updateDoc(docRef, { description: editDesc.trim() });
        setTables((prevTables) =>
          prevTables.map((table) =>
            table.name === editTableName
              ? {
                  ...table,
                  data: table.data.map((item) =>
                    item.id === editItemId ? { ...item, description: editDesc.trim() } : item
                  ),
                }
              : table
          )
        );
        console.log(`Updated description for item ${editItemId} in ${collectionName}`);
        setEditModalVisible(false); // Hide modal
      } catch (error) {
        console.error("Error updating description:", error);
      }
    }
  };

  // Render Right Swipe Action (Delete)
  const renderRightActions = (tableName: string, itemId: string) => (
    <TouchableOpacity
      style={styles.deleteButton}
      onPress={() => handleDelete(tableName, itemId)}
    >
      <Text style={styles.deleteButtonText}>Delete</Text>
    </TouchableOpacity>
  );

  // Render Left Swipe Action (Edit)
  const renderLeftActions = (tableName: string, itemId: string, currentDesc: string) => (
    <TouchableOpacity
      style={styles.editButton}
      onPress={() => handleEdit(tableName, itemId, currentDesc)}
    >
      <Text style={styles.editButtonText}>Edit</Text>
    </TouchableOpacity>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      {initialized && (
        <>
          {/* Navigation Between Tables */}
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

          {/* Filters per Column */}
          <View style={styles.filterRow}>
            {tables[currentTableIndex].columns.map((col) =>
              !col.hidden ? (
                <TextInput
                  key={col.accessor}
                  style={styles.filterInput}
                  placeholder={`Filter ${col.Header}`}
                  value={filters[col.accessor] || ""}
                  onChangeText={(text) =>
                    setFilters((prev) => ({ ...prev, [col.accessor]: text }))
                  }
                />
              ) : null
            )}
          </View>

          {/* Table Headers */}
          <View style={styles.headerRow}>
            {tables[currentTableIndex].columns.map((col) =>
              !col.hidden ? (
                <TouchableOpacity
                  key={col.accessor}
                  onPress={() => handleSort(col.accessor)}
                  style={styles.headerCell}
                >
                  <Text>
                    {col.Header} {sortBy?.column === col.accessor ? (sortBy.order === "asc" ? "↑" : "↓") : ""}
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
          </View>

          {/* FlatList with Swipeable */}
          <FlatList
            data={filteredData()}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Swipeable
                renderRightActions={() => renderRightActions(tables[currentTableIndex].name, item.id)}
                renderLeftActions={() => renderLeftActions(tables[currentTableIndex].name, item.id, item.description)}
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

          {/* Edit Modal */}
          <Modal
            animationType="slide"
            transparent={true}
            visible={editModalVisible}
            onRequestClose={() => setEditModalVisible(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>Edit Description</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  placeholder="Enter new description"
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={styles.modalButton}
                    onPress={() => setEditModalVisible(false)}
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
  deleteButton: { 
    backgroundColor: "#ff4444", 
    justifyContent: "center", 
    alignItems: "center", 
    width: 80, 
    height: "100%" 
  },
  deleteButtonText: { color: "#fff", fontWeight: "bold" },
  editButton: { 
    backgroundColor: "#007bff", 
    justifyContent: "center", 
    alignItems: "center", 
    width: 80, 
    height: "100%" 
  },
  editButtonText: { color: "#fff", fontWeight: "bold" },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    width: "80%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 10,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
  },
  modalInput: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    minHeight: 60,
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    backgroundColor: "#ddd",
    width: "45%",
    alignItems: "center",
  },
  saveButton: {
    backgroundColor: "#007bff",
  },
  modalButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default MainComponent;