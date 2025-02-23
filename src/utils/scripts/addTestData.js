// addTestData.js
const realm = require('../utils/db/realm');
const addTestDataJSON_Reponse = require('../Test_Data/addTestDataJSON_Reponse');
const responses = addTestDataJSON_Reponse();

realm.write(() => {
  responses.forEach(response => {
    realm.create('GPTResponses', {
      id: response.id,
      discussionId: response.discussionId,
      response: response.response,
      responseType: response.responseType,
    });
  });
});