const Realm = require('realm');

const schema = {
  name: 'GPTResponses',
  properties: {
    id: 'int',
    discussionId : 'int',
    timestamp: 'date',
    prompt: 'string',
    response: 'string', // large response from GPT
    responseType: "string", // is this json instructions to the app or a narrative so the user to read
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