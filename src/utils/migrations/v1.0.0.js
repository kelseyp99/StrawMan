// v1.0.0.js

const { Schema, Realm } = require('realm');

const schema = {
  name: 'Discussion',
  properties: {
    id: 'int',
    timestamp: 'date',
    description: { type: 'string', required: true },
    cleared: 'bool',
    activityLogs: 'ActivityLog[]', 
  },
  primaryKey: 'id'
};

module.exports = {
  version: 1,
  migrations: [
    {
      version: 0,
      url: 'https://my-app.firebaseio.com/my-app',
      schema,
      deleteRealmIfMigrationLoss: true,
      run: async (oldSchema, schema, realm) => {
        // Delete any discussions with null descriptions
        const discussions = realm.objects('Discussion').filtered('description == null');
        realm.delete(discussions);
      }
    }
  ]
};