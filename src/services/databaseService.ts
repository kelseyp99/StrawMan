import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  addDoc,
  updateDoc,
  getDoc,
  Timestamp,
  limit,
  writeBatch,
  deleteField,
  and,
  orderBy,
  startAfter,
  onSnapshot,
  DocumentData,
  DocumentReference,
  DocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { format } from 'date-fns';
import { getUID } from '../utils/uidManager';
import { sendQuestion, sendQuestionForParsing } from './openaiAPI';

const APP_VERSION = '1.1.0';
const APP_ID = 'com.anonymous.lifelog';

export async function initializeUser() {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('No user signed in');
  }
  try {
    console.log(`Initializing user document for UID: ${user.uid}`);
    const userRef = doc(db, `Users/${user.uid}`);
    const userData = {
      appVersion: '1.1.0',
      appId: 'com.anonymous.lifelog',
      timestamp: new Date().toISOString(),
    };
    console.log(`Writing to Firestore path: Users/${user.uid}`, userData);
    await setDoc(userRef, userData, { merge: true });
    console.log('User document initialized successfully');
  } catch (error) {
    console.error('Error initializing user document:', error);
    throw error;
  }
}

export const createDocument = async (data: any) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for create operation');
  }
  try {
    const docRef = await addDoc(collection(db, `Users/${uid}/Documents`), {
      ...data,
      uid,
      timestamp: new Date(),
    });
    console.log('Document created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating document:', error);
    throw error;
  }
};

export const readDocuments = async () => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for read operation');
  }
  try {
    const q = query(
      collection(db, `Users/${uid}/Documents`),
      where('uid', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log('Documents retrieved:', documents);
    return documents;
  } catch (error) {
    console.error('Error reading documents:', error);
    throw error;
  }
};

export const updateDocument = async (docId: string, data: any) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for update operation');
  }
  try {
    const docRef = doc(db, `Users/${uid}/Documents`, docId);
    await updateDoc(docRef, data);
    console.log('Document updated with ID:', docId);
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

export const deleteDocument = async (docId: string) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete operation');
  }
  try {
    const docRef = doc(db, `Users/${uid}/Documents`, docId);
    await deleteDoc(docRef);
    console.log('Document deleted with ID:', docId);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
};

//////////////////////////////////////////
// Database functions for ActivityLog //
//////////////////////////////////////////

export async function getDistinctCategories(): Promise<string[]> {
  console.log('Fetching distinct categories from Firestore...');
  const uid = await getUID();
  try {
    const snapshot = await getDocs(collection(db, 'ActivityLog'));
    const categoriesSet = new Set<string>();

    try {
      snapshot.forEach((doc: { data: () => any }) => {
        const data = doc.data();
        if (data.category) {
          categoriesSet.add(data.category);
        }
      });
      if (categoriesSet.has('Uncategorized')) {
        categoriesSet.delete('Uncategorized');
      }
      if (categoriesSet.size === 0) {
        categoriesSet.add('diet');
      }
    } catch (error) {
      console.error('Error processing GPT responses:', error);
    }

    return Array.from(categoriesSet);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return [];
  }
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for insert operation');
  }
  try {
    for (const item of jsonData) {
      const docRef = doc(collection(db, 'ActivityLog'), String(Date.now()));
      const newEntry = {
        category: item.category,
        value: item.value,
        timestamp: new Date(),
        uid,
      };
      await setDoc(docRef, newEntry);
    }
    console.log('Data inserted successfully!');
  } catch (error) {
    console.error('Error inserting data:', error);
  }
}

export async function queryAllFieldsByCategories(
  categories: string[]
): Promise<any[]> {
  console.log('Querying Firestore for categories:', categories);
  const uid = await getUID();
  try {
    const q = query(
      collection(db, 'ActivityLog'),
      where('category', 'in', categories)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: { data: () => any }) => {
      const timestamp = new Date(doc.data().timestamp.toDate());
      const formattedTimestamp = `${
        timestamp.getMonth() + 1
      }/${timestamp.getDate()}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp
        .getMinutes()
        .toString()
        .padStart(2, '0')}`;
      return `${formattedTimestamp} ${doc.data().description}`;
    });
  } catch (error) {
    console.error('Error querying Firestore:', error);
    return [];
  }
}

//////////////////////////////////////////
// Database functions for Discussions //
//////////////////////////////////////////

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: string
): Promise<void> {
  console.log('Entering addOrUpdateDiscussion');
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for discussion operation');
  }
  console.log(
    `Adding or updating discussion with description: ${description}, uid: ${uid}, typeSay: ${typeSay}`
  );
  try {
    console.log('Creating the document reference');
    const docRef = id
      ? doc(db, `Users/${uid}/Discussion`, String(id))
      : doc(collection(db, `Users/${uid}/Discussion`));
    const discussionData = {
      description,
      typeSay,
      cleared: false,
      timestamp: new Date(),
      uid,
      appVersion: APP_VERSION,
      appId: APP_ID,
    };
    console.log(
      `Writing to Firestore path: Users/${uid}/Discussion/${docRef.id}`,
      discussionData
    );
    await setDoc(docRef, discussionData, { merge: true });
    console.log(
      `Discussion ${id ? 'updated' : 'added'} successfully: ${docRef.id}`
    );
  } catch (error) {
    console.error('Error adding/updating discussion:', error);
    throw error;
  }
}

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<any[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get discussions operation');
  }
  try {
    let discussionsQuery = query(
      collection(db, `Users/${uid}/Discussions`),
      where('uid', '==', uid),
      orderBy('timestamp', 'desc')
    );
    if (discussionId) {
      const discussionRef = doc(db, `Users/${uid}/Discussions`, discussionId);
      const discussionSnap = await getDoc(discussionRef);
      if (discussionSnap.exists()) {
        discussionsQuery = query(discussionsQuery, startAfter(discussionSnap));
      } else {
        console.warn(`Discussion ID ${discussionId} not found.`);
      }
    }
    if (lastX !== undefined) {
      discussionsQuery = query(discussionsQuery, limit(lastX));
    }
    const discussionSnapshot = await getDocs(discussionsQuery);
    return discussionSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp
        ? format(new Date(doc.data().timestamp.toDate()), 'M/d/yy \n h:mm a')
        : 'N/A',
    }));
  } catch (error) {
    console.error('Error getting discussions:', error);
    return [];
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for delete discussion operation');
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussions`, id);
    const discussionSnap = await getDoc(discussionRef);
    if (discussionSnap.exists()) {
      const discussionData = discussionSnap.data();
      if (discussionData.uid === uid) {
        await deleteDoc(discussionRef);
        console.log(`Discussion with ID ${id} deleted.`);
      } else {
        console.error(
          `You cannot delete a discussion that doesn't belong to you.`
        );
      }
    } else {
      console.error(`Discussion with ID ${id} does not exist.`);
    }
  } catch (error) {
    console.error(`Error deleting discussion with ID ${id}:`, error);
  }
}

export const fetchInitialDiscussion = async () => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for fetch initial discussion operation');
  }
  try {
    console.log('Fetching initial discussion with UID:', uid);
    const discussionsQuery = query(
      collection(db, `Users/${uid}/Discussions`),
      where('uid', '==', uid)
    );
    const discussionSnapshot = await getDocs(discussionsQuery);
    if (!discussionSnapshot.empty) {
      const docSnapshot = discussionSnapshot.docs[0];
      const data = docSnapshot.data();
      return {
        id: docSnapshot.id,
        discussionId: data.discussionId || docSnapshot.id,
        description: data.description,
        timestamp: data.timestamp ? data.timestamp.toDate() : new Date(),
        typeSay: data.typeSay || 'ask',
        cleared: data.cleared || false,
      };
    }
    return null;
  } catch (error) {
    console.error('🔥 Error fetching discussion:', error);
    return null;
  }
};

export const getNextOpenDiscussion = async (lastVisibleDoc?: any) => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get next open discussion operation');
  }
  try {
    console.log(`getNextOpenDiscussion: UID=${uid}`);
    let discussionsQuery = query(
      collection(db, `Users/${uid}/Discussions`),
      where('cleared', 'in', [false, null]),
      where('uid', '==', uid),
      limit(1)
    );
    if (lastVisibleDoc) {
      discussionsQuery = query(discussionsQuery, startAfter(lastVisibleDoc));
    }
    const snapshot = await getDocs(discussionsQuery);
    console.log(
      `getNextOpenDiscussion: Found ${snapshot.docs.length} documents`,
      snapshot.docs.map((doc) => doc.data())
    );
    return {
      snapshot,
      hasMore: snapshot.docs.length > 0,
      lastVisibleDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    };
  } catch (error) {
    console.error('🔥 Error fetching discussion:', error);
    return { snapshot: null, hasMore: false, lastVisibleDoc: null };
  }
};

export async function addQuestionDiscussion(
  question: string,
  discussionId: string
): Promise<string> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add question discussion operation');
  }
  try {
    console.log(
      `Adding question: ${question} to discussionId: ${discussionId}`
    );
    await addOrUpdateDiscussion(question, 'ask', discussionId);
    console.log(`Successfully added question to discussion`);
    const gpts_names_string =
      '["openAI", "Gemini", "ChatGPT", "Claude", "DeepSeek"]';
    const gpts_names = JSON.parse(gpts_names_string);
    console.log(`GPT names:`, gpts_names);
    const categories = await getDistinctCategories();
    console.log(`Categories:`, categories);
    const response = await sendQuestionForParsing({
      categories,
      gpts_names,
      question,
      discussionId,
    });
    console.log(`Parsed response received:`, response);
    const docRef = await addDoc(collection(db, 'GPTResponses'), {
      timestamp: new Date(),
      discussionId,
      prompt: question,
      response: JSON.stringify(response),
      responseType: 'parsed question',
      cleared: false,
      uid,
    });
    console.log(`Successfully saved GPT response with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error('Error adding question discussion:', error);
    throw error;
  }
}

export async function processUnclearedGPTResponses() {
  let hasMoreDocuments = true;
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for process uncleared GPT responses operation'
    );
  }
  while (hasMoreDocuments) {
    const q = query(
      collection(db, 'GPTResponses'),
      where('cleared', '==', false),
      where('responseType', '==', 'updateDB'),
      where('uid', '==', uid),
      limit(1)
    );
    const gptQuerySnapshot = await getDocs(q);
    if (gptQuerySnapshot.empty) {
      hasMoreDocuments = false;
      break;
    }
    const docSnapshot = gptQuerySnapshot.docs[0];
    const gptResponseTyped = {
      id: docSnapshot.id,
      discussionId: docSnapshot.data().discussionId,
      response: docSnapshot.data().response,
      timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
      cleared: docSnapshot.data().cleared,
    };
    console.log('Processing GPT Response:', gptResponseTyped.id);
    const responseJson = JSON.parse(gptResponseTyped.response);
    const { category, parsedDescription } = responseJson;
    const { discussionId, timestamp } = gptResponseTyped;
    const activityLogRef = collection(db, 'ActivityLog');
    const qq = query(activityLogRef, where('discussionId', '==', discussionId));
    const querySnapshot = await getDocs(qq);
    const activityLog = !querySnapshot.empty ? querySnapshot.docs[0] : null;
    if (activityLog) {
      console.log('Updating existing activity log...');
      const existingActivityLogRef = doc(db, 'ActivityLog', activityLog.id);
      await updateDoc(existingActivityLogRef, {
        category,
        description: parsedDescription,
        responseType: 'tell',
        cleared: true,
        uid,
      });
    } else {
      console.log('Creating new activity log...');
      await addDoc(collection(db, 'ActivityLog'), {
        discussionId,
        category,
        parsedDescription,
        timestamp: Timestamp.fromDate(timestamp),
        cleared: true,
        uid,
      });
    }
    const gptResponseRef = doc(db, 'GPTResponses', gptResponseTyped.id);
    await updateDoc(gptResponseRef, { cleared: true });
    console.log('Processed and cleared GPTResponse:', gptResponseTyped.id);
    const success = await clearDiscussion(discussionId);
    if (!success) {
      console.error('Failed to clear discussion. Exiting process.');
      return;
    }
  }
  console.log('All GPTResponses have been cleared.');
}

export const markDiscussionAsCleared = async (discussionId: string) => {
  console.log(`Attempting to mark discussion ${discussionId} as cleared...`);
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for mark discussion as cleared operation'
    );
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussions`, discussionId);
    await updateDoc(discussionRef, { cleared: true });
    console.log(`✅ Discussion ${discussionId} marked as cleared.`);
  } catch (error) {
    console.error('🔥 Error marking discussion as cleared:', error);
  }
};

export async function clearDiscussion(discussionId: string): Promise<boolean> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for clear discussion operation');
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussions`, discussionId);
    console.log(`Attempting to clear discussion ${discussionId}...`);
    const docSnapshot = await getDoc(discussionRef);
    if (docSnapshot.exists()) {
      console.log(`Discussion ${discussionId} exists. Updating...`);
      await updateDoc(discussionRef, { cleared: true });
      console.log(`Processed and cleared Discussion: ${discussionId}`);
    } else {
      console.log(`Discussion ${discussionId} not found. Skipping update.`);
    }
    return true;
  } catch (error) {
    console.error(`Error clearing discussion ${discussionId}:`, error);
    return false;
  }
}

export async function addOrUpdateActivityLog(): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for add or update activity log operation'
    );
  }
  try {
    interface GPTResponseJSONData {
      category: string;
      parsedDescription: string;
    }
    const q = query(
      collection(db, 'GPTResponses'),
      where('cleared', '==', false),
      where('responseType', '==', 'updateDB'),
      where('uid', '==', uid)
    );
    const gptQuerySnapshot = await getDocs(q);
    for (const docSnapshot of gptQuerySnapshot.docs) {
      const gptResponseTyped = {
        id: docSnapshot.id,
        discussionId: docSnapshot.data().discussionId,
        response: docSnapshot.data().response,
        timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
        cleared: docSnapshot.data().cleared,
        uid,
      };
      console.log('Raw GPT response JSON:', gptResponseTyped.response);
      const responseJson = JSON.parse(
        gptResponseTyped.response
      ) as GPTResponseJSONData;
      console.log('Parsed category:', responseJson.category);
      console.log('Parsed description:', responseJson.parsedDescription);
      const category = responseJson.category;
      const parsedDescription = responseJson.parsedDescription;
      const discussionId = gptResponseTyped.discussionId;
      const timestamp = gptResponseTyped.timestamp;
      const activityLogRef = collection(db, 'ActivityLog');
      const qq = query(
        activityLogRef,
        where('discussionId', '==', discussionId)
      );
      const querySnapshot = await getDocs(qq);
      const activityLog = !querySnapshot.empty
        ? querySnapshot.docs[0].data()
        : null;
      if (activityLog) {
        console.log('Updating existing response...');
        const existingActivityLogRef = doc(
          db,
          'ActivityLog',
          querySnapshot.docs[0].id
        );
        await updateDoc(existingActivityLogRef, {
          category: category,
          description: parsedDescription,
          responseType: 'tell',
          cleared: true,
          uid,
        });
      } else {
        console.log(
          'No existing activity log found. Creating new activity log...'
        );
        await addDoc(collection(db, 'ActivityLog'), {
          id: new Date().getTime(),
          discussionId,
          category,
          description: parsedDescription,
          timestamp: Timestamp.fromDate(timestamp),
          cleared: true,
          uid,
        });
        console.log('New response created.');
      }
      const gptResponseRef = doc(db, 'GPTResponses', gptResponseTyped.id);
      await updateDoc(gptResponseRef, { cleared: true });
    }
  } catch (error) {
    console.error('Error adding or updating GPT response:', error);
  }
}

export const renameFieldToCleared = async () => {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for rename field to cleared operation');
  }
  try {
    const discussionCollection = collection(db, `Users/${uid}/Discussions`);
    const querySnapshot = await getDocs(discussionCollection);
    querySnapshot.forEach(async (document) => {
      const docRef = doc(db, `Users/${uid}/Discussions`, document.id);
      const data = document.data();
      const fieldName = Object.keys(data).find(
        (key) => key.toLowerCase() === 'cleared'
      );
      if (fieldName && fieldName !== 'cleared') {
        await updateDoc(docRef, {
          cleared: data[fieldName],
          [fieldName]: deleteField(),
          uid,
        });
        console.log(`Updated document ${document.id}`);
      }
    });
    console.log('All documents updated successfully!');
  } catch (error) {
    console.error('Error updating documents: ', error);
  }
};

// Call the function to rename the field
// renameFieldToCleared();

interface lastOpenDiscussion {
  id: string;
  description: string;
}

export async function getLastOpenDiscussion(): Promise<lastOpenDiscussion> {
  const currentTime = new Date();
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get last open discussion operation');
  }
  try {
    /* 
    let realm: Realm | null = null;
    try {
      realm = await Realm.open({
        schema: [
          {
            name: 'Discussion',
            properties: {
              id: 'int',
              timestamp: 'date',
              description: 'string',
              cleared: 'bool',
            },
          },
        ],
      });
    */
    const querySnapshot = await getDocs(
      collection(db, `Users/${uid}/Discussions`)
    );
    const discussions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as {
        timestamp: Timestamp;
        description: string;
        cleared: boolean;
      }),
    }));
    const lastOpenDiscussion = discussions
      .filter(
        (discussion) =>
          !discussion.cleared &&
          discussion.description !== '' &&
          discussion.description !== null
      )
      .sort(
        (a, b) =>
          new Date(b.timestamp.toDate()).getTime() -
          new Date(a.timestamp.toDate()).getTime()
      )[0];
    console.log('Last open discussion:', lastOpenDiscussion?.description);
    return {
      id: lastOpenDiscussion.id,
      description: lastOpenDiscussion.description,
    };
  } catch (error) {
    console.error('Error getting last open discussion:', error);
    return Promise.reject(error);
  } finally {
    /* if (realm && realm.close) {
      realm.close();
    } */
  }
}

async function waitForDocument(
  ref: DocumentReference<unknown, DocumentData>,
  timeout = 5000
) {
  return new Promise((resolve, reject) => {
    const unsubscribe = onSnapshot(
      ref,
      (docSnap) => {
        if (docSnap.exists()) {
          unsubscribe();
          resolve(docSnap);
        }
      },
      (error: any) => {
        unsubscribe();
        reject(error);
      }
    );
    setTimeout(() => {
      unsubscribe();
      reject(
        new Error(
          'Document did not become available within the specified timeout.'
        )
      );
    }, timeout);
  });
}

export async function disperseQuestion(
  discussionId: string,
  GPT_ResponseId: string
): Promise<string[] | undefined> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for disperse question operation');
  }
  try {
    console.log('Attempting to disperse question and get answers...');
    const discussionRef = doc(db, `Users/${uid}/Discussions`, discussionId);
    const discussionDoc = await getDoc(discussionRef);
    if (!discussionDoc.exists()) {
      console.log(`No discussion found with ID: ${discussionId}`);
      return;
    }
    const gptResponseRef = doc(db, 'GPTResponses', GPT_ResponseId);
    console.log('Waiting for GPT Response to be ready...');
    const gptResponseDoc = await waitForDocument(gptResponseRef);
    console.log('GPT Response is ready.');
    if (!gptResponseDoc) {
      console.error('GPT Response not found');
      return undefined;
    }
    console.log(
      'GPT Response found:',
      JSON.parse((gptResponseDoc as DocumentSnapshot).get('response'))
    );
    const parsedQuestion = JSON.parse(
      (gptResponseDoc as DocumentSnapshot).get('response')
    );
    let responses: string[] = [];
    for (const part of parsedQuestion.parts) {
      const { gpt, category, parsedDescription: question } = part;
      console.log(
        `Sending question to GPT ${gpt} for category(s) ${category}:`,
        question
      );
      const response = await sendQuestion({
        category,
        gpt,
        question,
        discussionId,
      });
      console.log(
        `Got response from GPT ${gpt} for category(s) ${category}:`,
        response
      );
      await addDoc(collection(db, 'GPTResponses'), {
        timestamp: new Date(),
        prompt: question,
        response: response,
        responseType: 'gpt response',
        discussionId,
        cleared: false,
        uid,
      });
      responses.push(response.parsedDescription);
    }
    return responses;
  } catch (error) {
    console.error('Error dispersing question:', error);
    return undefined;
  }
}

export async function disperseQuestionOLD(
  discussionId: string,
  GPT_ResponseId: string
): Promise<string[] | undefined> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for disperse question old operation');
  }
  try {
    const discussionRef = doc(db, `Users/${uid}/Discussions`, discussionId);
    const discussionDoc = await getDoc(discussionRef);
    if (discussionDoc.exists()) {
      const gptResponseRef = doc(db, 'GPTResponses', GPT_ResponseId);
      const gptResponseDoc = await getDoc(gptResponseRef);
      if (gptResponseDoc.exists()) {
        const parsedQuestion = JSON.parse(
          gptResponseDoc.data()!.response as string
        );
        let responses: string[] = [];
        for (const part of parsedQuestion.parts) {
          const gpt = part.gpt;
          const category = part.category;
          const question = part.parsedDescription;
          console.log(
            `Sending question to GPT ${gpt} for category ${category}:`,
            question
          );
          const response = await sendQuestion({
            category,
            gpt,
            question,
            discussionId,
          });
          console.log(
            `Got response from GPT ${gpt} for category ${category}:`,
            response
          );
          await addDoc(collection(db, 'GPTResponses'), {
            id: new Date().getTime(),
            timestamp: new Date(),
            prompt: question,
            response: response,
            responseType: 'gpt response',
            discussionId: discussionId,
            cleared: false,
            uid,
          });
          responses.push(response.parsedDescription);
        }
        return responses;
      } else {
        console.error('GPT Response not found');
      }
    } else {
      console.log(`No discussion found with ID: ${discussionId}`);
    }
  } catch (error) {
    console.error('Error dispersing question:', error);
  }
  return undefined;
}

//////////////////////////////////////////
// Database functions for GPT Responses //
//////////////////////////////////////////

export async function addOrUpdateGPTResponse(
  discussionId: string,
  response: string,
  responseType: string,
  cleared: boolean = false
): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error(
      'No UID available for add or update GPT response operation'
    );
  }
  try {
    const docRef = doc(collection(db, 'GPTResponses'), String(Date.now()));
    await setDoc(docRef, {
      discussionId,
      response,
      responseType,
      timestamp: new Date(),
      cleared,
      uid,
    });
    console.log('GPT Response saved.');
  } catch (error) {
    console.error('Error adding/updating GPT response:', error);
  }
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get GPT responses operation');
  }
  try {
    const q = query(
      collection(db, 'GPTResponses'),
      where('discussionId', '==', discussionId),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: { data: () => any }) => doc.data());
  } catch (error) {
    console.error('Error getting GPT responses:', error);
    return [];
  }
}

export async function getParsedGPTResponses(
  discussionId: string
): Promise<string[]> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get parsed GPT responses operation');
  }
  try {
    const parsedResponses: string[] = [];
    let lastVisible: any = null;
    const batchSize = 10;
    do {
      let q = query(
        collection(db, 'GPTResponses'),
        where('discussionId', '==', discussionId),
        where('responseType', '==', 'parsed answer'),
        where('uid', '==', uid),
        limit(batchSize)
      );
      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.responseType === 'parsed answer') {
            parsedResponses.push(data.response);
          }
        });
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
      } else {
        lastVisible = null;
      }
    } while (lastVisible);
    return parsedResponses;
  } catch (error) {
    console.error('Error getting parsed GPT responses:', error);
    return [];
  }
}

export const getAIResponse = async (question: string) => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`This is an AI-generated response to: "${question}"`);
    }, 2000);
  });
};

//////////////////////////////////////////
// Helper Functions for Cloud Sync //
//////////////////////////////////////////

export async function syncToCloud(
  tableName: string,
  payload: any,
  method: 'POST' | 'PUT' | 'DELETE'
): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for sync to cloud operation');
  }
  const url = `http://localhost:5155/api/${tableName.toLowerCase()}`;
  try {
    const config = { headers: { 'Content-Type': 'application/json' } };
    let response;
    if (method === 'POST') {
      response = await fetch(url, {
        method,
        headers: config.headers,
        body: JSON.stringify(payload),
      });
    } else if (method === 'PUT') {
      response = await fetch(url, {
        method,
        headers: config.headers,
        body: JSON.stringify(payload),
      });
    } else if (method === 'DELETE') {
      response = await fetch(`${url}/${payload.id}`, {
        method,
        headers: config.headers,
      });
    }
    console.log(`${tableName} synced successfully.`);
  } catch (error) {
    console.error(`Error syncing ${tableName} to cloud:`, error);
  }
}

//////////////////////////////////////////
// Database functions for Alerts //
//////////////////////////////////////////

export async function getNextActiveAlert(): Promise<any | null> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get next active alert operation');
  }
  try {
    const q = query(
      collection(db, 'Alert'),
      where('isActive', '==', true),
      where('uid', '==', uid)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.length ? snapshot.docs[0].data() : null;
  } catch (error) {
    console.error('Error fetching active alert:', error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for add or update alert operation');
  }
  try {
    const docRef = alertData._id
      ? doc(db, 'Alert', alertData._id)
      : doc(collection(db, 'Alert'));
    await setDoc(
      docRef,
      { ...alertData, createdAt: new Date(), uid },
      { merge: true }
    );
    console.log(`Alert ${alertData._id ? 'updated' : 'added'} successfully.`);
  } catch (error) {
    console.error('Error adding/updating alert:', error);
  }
}

//////////////////////////////////////////
// Database functions for GPT Specialties //
//////////////////////////////////////////

export async function getURLofGPT(
  gpt_name: string
): Promise<{ url: string; apiKey: string } | null> {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get URL of GPT operation');
  }
  try {
    const q = query(
      collection(db, 'GPTSpecialties'),
      where('name', '==', gpt_name)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.length
      ? (snapshot.docs[0].data() as { url: string; apiKey: string })
      : null;
  } catch (error) {
    console.error('Error fetching GPT specialty:', error);
    return null;
  }
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  console.log(`Attempting to expand abbreviation '${discussion}'`);
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for expand abbreviation operation');
  }
  const abbreviationMap = new Map<string, string>([
    ['1', 'i urinated'],
    ['11', 'i had a high volume of urination'],
    ['2', 'i had a regular size poop'],
    ['22', 'i had a large poop'],
  ]);
  const expandedForm = abbreviationMap.get(discussion);
  console.log(`Expanded '${discussion}' to '${expandedForm}'`);
  if (expandedForm) {
    console.log(`Expanded '${discussion}' to '${expandedForm}'`);
    return expandedForm;
  } else {
    console.log(`Unable to expand abbreviation '${discussion}'`);
    return discussion;
  }
}

//////////////////////////////////////////
// Exporting Helper Functions //
//////////////////////////////////////////

/* async function updateDiscussions() {
    const discussionsSnapshot = await getDocs(collection(db, 'Discussion'));
    const batch = writeBatch(db);
    
    discussionsSnapshot.forEach((discussionDoc) => {
      const docRef = doc(db, 'Discussion', discussionDoc.id);
      batch.update(docRef, { Cleared: false });
    });
    
    await batch.commit(); 

    const snapshot = await getDocs(collection(db, "Discussion"));
    snapshot.forEach(doc => {
        console.log(doc.id, " => ", doc.data());
    });   
}

updateDiscussions(); */

// Data to restore
const lostData = [
  {
    id: '1738367528606',
    typeSay: 'tell',
    timestamp: 1738367528606,
    description: '1',
  },
  {
    id: '1738374105437',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'I ate salmon couscous and 2 slices of avocado',
  },
  {
    id: '1738382525048',
    typeSay: 'tell',
    timestamp: 1738382525048,
    description: 'Took 5 mg Staten',
  },
  {
    id: '7vukcCfVaBApZaAv6PoU',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: "I'm feeling anxious and frustrated",
  },
  {
    id: '92JlMF1EHheU8uPMLBMi',
    typeSay: 'tell',
    timestamp: 1738382525048,
    description: '1',
  },
  {
    id: 'ArZ5Z0pQN1RKVb3kWuVh',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description:
      'Ate Cheese omelet 3 out of 4 yolks removed with mustard leaf onions',
  },
  {
    id: 'BA5UcSPVyWjPUHCMNiwM',
    typeSay: 'tell',
    timestamp: 1738382525048,
    description: 'I ate banana',
  },
  {
    id: 'Du7Py4BgHvrAxmY9IK7l',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'I weigh 198 pounds',
  },
  {
    id: 'FiXuBOhnBeEAttEsR6gu',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'Took NATtokinase 4000 fu 3 tabs',
  },
  {
    id: 'FpXSZiDfKRVoyPvHlFNm',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'My Blood Pressure was 139 over 77 heart rate 79',
  },
  {
    id: 'GVaBSIODW1Mwu7zlQKOn',
    typeSay: 'tell',
    timestamp: 1738382525048,
    description: '1',
  },
  {
    id: 'XraDybqXtDXAZV6zzdEJ',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'I slept about 8 hours',
  },
  {
    id: 'pMkrwd6YHnd5rp0haNl4',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'Drank two cups of coffee with creamer',
  },
  {
    id: 'sij7LXj17QS9h5K1boPa',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'Last night I had a lettuce salad with dressing with sardines',
  },
  {
    id: 'vk1N3fkTLJyYyFU5XNw0',
    typeSay: 'tell',
    timestamp: 1738374105437,
    description: 'Planted several new tomato bushes in the garden',
  },
];

// Function to restore data
async function restoreLostData() {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for restore lost data operation');
  }
  const collectionRef = collection(db, 'ActivityLog');
  for (const entry of lostData) {
    try {
      const docRef = doc(collectionRef, entry.id);
      await setDoc(docRef, {
        typeSay: entry.typeSay,
        description: entry.description,
        timestamp: Timestamp.fromMillis(entry.timestamp),
        uid,
      });
      console.log(`Restored document: ${entry.id}`);
    } catch (error) {
      console.error(`Failed to restore document ${entry.id}:`, error);
    }
  }
  console.log('Data restoration completed!');
}

export async function getRules() {
  const uid = await getUID();
  if (!uid) {
    throw new Error('No UID available for get rules operation');
  }
  try {
    const rulesRef = collection(db, 'Rules');
    const q = query(
      rulesRef,
      orderBy('isRegex', 'desc'),
      orderBy('priority', 'asc')
    );
    const snapshot = await getDocs(q);
    const rules = snapshot.docs.map((doc) => doc.data());
    return rules;
  } catch (error) {
    console.error('Error fetching rules:', error);
    throw error;
  }
}

// Run the function
// restoreLostData();
