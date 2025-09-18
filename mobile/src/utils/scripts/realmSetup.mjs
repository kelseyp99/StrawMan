import RealmPkg from 'react-native-realm';
const { Realm } = RealmPkg; // Destructure the Realm object from the package

// Define the schema
const LogEntrySchema = {
  name: 'LogEntry',
  properties: {
    id: 'int', // Primary Key, unique identifier for each entry
    category: 'string', // Category (e.g., Nutrition, Physical Health, etc.)
    description: 'string', // User-provided description
    timestamp: 'date', // When the entry was created
  },
  primaryKey: 'id',
};

const initializeRealm = async () => {
  try {
    // Initialize Realm with the schema
    const realm = await Realm.open({
      schema: [LogEntrySchema],
    });

    console.log('Realm initialized successfully');

    // Insert test entries
    realm.write(() => {
      const testEntries = [
        { id: 1, category: 'Nutrition', description: 'Breakfast - Oatmeal and fruit', timestamp: new Date() },
        { id: 2, category: 'Exercise', description: 'Morning jog for 30 minutes', timestamp: new Date() },
      ];

      testEntries.forEach(entry => {
        realm.create('LogEntry', entry);
      });
    });

    // Retrieve all entries
    const allEntries = realm.objects('LogEntry');
    console.log('All entries:', Array.from(allEntries));

    return realm;
  } catch (error) {
    console.error('Error initializing Realm:', error);
  }
};

// Call the function to initialize Realm and add data
initializeRealm();
