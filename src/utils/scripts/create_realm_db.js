const ActivityLogSchema = {
  name: 'ActivityLog',
  properties: {
    id: 'int',
    category: 'string',
    description: 'string',
    timestamp: 'date',
  },
  primaryKey: 'id',
};

const DiscussionSchema = {
  name: 'Discussion',
  properties: {
    id: 'int',
    timestamp: 'date',
    description: 'string',
    cleared: 'bool',
  },
  primaryKey: 'id',
};

// Create a Realm instance with the schema
const realmPath = path.join(__dirname, './src/utils/db/ActivityLog.realm');
const realm = new Realm({
  schema: [ActivityLogSchema, DiscussionSchema], // Include both schemas
  path: realmPath, // Specify the absolute path to the database file
});

// Print the full path to the database file
console.log('Database file path:', realmPath);

// Drop all data in the existing table
realm.write(() => {
  realm.delete(realm.objects('ActivityLog'));
  realm.delete(realm.objects('Discussion')); // Delete data from the new Discussion table
});

// Load data from testData.json
const testData = JSON.parse(fs.readFileSync('./testData.json', 'utf8'));

// Add data to the database
realm.write(() => {
  testData.forEach((entry, index) => {
    realm.create('ActivityLog', {
      id: index + 1,
      category: entry.category,
      description: entry.description,
      timestamp: new Date(entry.timestamp),
    });
  });

  // Add data to the new Discussion table
  const discussionTestData = [
    { id: 1, timestamp: new Date(), description: 'First discussion' },
    { id: 2, timestamp: new Date(), description: 'Second discussion' },
  ];
  discussionTestData.forEach((discussionEntry) => {
    realm.create('Discussion', discussionEntry);
  });
});

// Close the Realm instance
realm.close();

console.log('Realm database updated successfully!');