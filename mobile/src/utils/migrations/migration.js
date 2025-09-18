const Realm = require('realm');

const schema = {
  name: 'GPTResponses',
  properties: {
    // ... existing properties ...
    cleared: 'bool'
  }
};

const realm = new Realm({ schema });

realm.write(() => {
  const gptResponses = realm.objects('GPTResponses');
  gptResponses.forEach((response) => {
    response.cleared = false; // default value
  });
});

realm.close();