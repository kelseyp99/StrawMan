// src/services/databaseService.ts
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
  DocumentSnapshot
} from "firebase/firestore"; // Import Firestore config
import { db } from "@/firebaseConfig"; // Initialize Firestore
import { ModelAPIkey, ParsedActivity, sendQuestion, sendQuestionForParsing } from "./openaiAPI";
import { format } from "date-fns";
import { getUID } from "../utils/uidManager"; // Import UID manager

export const createDocument = async (data: any) => {
  const uid = getUID(); // Adding UID for user tracking
  if (!uid) {
    console.error("No UID available for create operation");
    return;
  }
  try {
    const docRef = await addDoc(collection(db, "documents"), {
      ...data,
      uid: uid, // Associate the document with the current user
      timestamp: new Date(),
    });
    console.log("Document created with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("Error creating document:", error);
    throw error;
  }
};

export const readDocuments = async () => {
  const uid = getUID(); // Adding UID for user tracking
  if (!uid) {
    console.error("No UID available for read operation");
    return [];
  }
  try {
    const q = query(collection(db, "documents"), where("uid", "==", uid));
    const querySnapshot = await getDocs(q);
    const documents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    console.log("Documents retrieved:", documents);
    return documents;
  } catch (error) {
    console.error("Error reading documents:", error);
    throw error;
  }
};

export const updateDocument = async (docId: string, data: any) => {
  const uid = getUID(); // Adding UID for user tracking
  if (!uid) {
    console.error("No UID available for update operation");
    return;
  }
  try {
    const docRef = doc(db, "documents", docId);
    await updateDoc(docRef, data);
    console.log("Document updated with ID:", docId);
  } catch (error) {
    console.error("Error updating document:", error);
    throw error;
  }
};

export const deleteDocument = async (docId: string) => {
  const uid = getUID(); // Adding UID for user tracking
  if (!uid) {
    console.error("No UID available for delete operation");
    return;
  }
  try {
    const docRef = doc(db, "documents", docId);
    await deleteDoc(docRef);
    console.log("Document deleted with ID:", docId);
  } catch (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
};

//////////////////////////////////////////
// Database functions for ActivityLog //
//////////////////////////////////////////

export async function getDistinctCategories(): Promise<string[]> {
  console.log("Fetching distinct categories from Firestore...");
  const uid = getUID(); // Adding UID for user tracking
  try {
    const snapshot = await getDocs(collection(db, "ActivityLog"));
    const categoriesSet = new Set<string>();

    try {
      snapshot.forEach((doc: { data: () => any; }) => {
        const data = doc.data();
        if (data.category) {
          categoriesSet.add(data.category);
        }
      });
      if (categoriesSet.has('Uncategorized')) {
        categoriesSet.delete('Uncategorized');
    }    
      if (categoriesSet.size === 0) {
        categoriesSet.add("diet");
      }
    } catch (error) {
      console.error('Error processing GPT responses:', error);
    }

    return Array.from(categoriesSet);
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    for (const item of jsonData) {
      const docRef = doc(collection(db, "ActivityLog"), String(Date.now()));

      const newEntry = {
        category: item.category,
        value: item.value,
        timestamp: new Date(),
      };

      await setDoc(docRef, newEntry);
    }

    console.log("Data inserted successfully!");
  } catch (error) {
    console.error("Error inserting data:", error);
  }
}

/**
 * Query Firestore for all fields in the ActivityLog collection
 * that match one of the categories provided.
 * @param categories - An array of categories to match.
 * @returns An array of objects, each containing the data from a matched document.
 */
export async function queryAllFieldsByCategories(categories: string[]): Promise<any[]> {
  console.log("Querying Firestore for categories:", categories);
  const uid = getUID(); // Adding UID for user tracking
  try {
    // Create a query that filters the ActivityLog collection based on the provided categories.
    const q = query(collection(db, "ActivityLog"), where("category", "in", categories));

    // Execute the query.
    const snapshot = await getDocs(q);

    // Return an array of objects, each containing only the "timestamp" and "description" fields.
    return snapshot.docs.map((doc: { data: () => any; }) => {
      const timestamp = new Date(doc.data().timestamp.toDate());
      const formattedTimestamp = `${timestamp.getMonth() + 1}/${timestamp.getDate()}/${timestamp.getFullYear()} ${timestamp.getHours()}:${timestamp.getMinutes().toString().padStart(2, '0')}`;
      return `${formattedTimestamp} ${doc.data().description}`;
    });
  } catch (error) {
    console.error("Error querying Firestore:", error);
    return [];
  }
}

//////////////////////////////////////////
// Database functions for Discussions //
//////////////////////////////////////////

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = "tell",
  id?: string
): Promise<void> {
  const uid = getUID(); // Adding UID for user tracking
  console.log(`Adding or updating discussion with description: ${description}` ,"uid:", uid);
  try {
    const docRef = id 
      ? doc(db, "Discussion", String(id)) 
      : doc(collection(db, "Discussion"));
      await setDoc(docRef, { 
        description, 
        typeSay, 
        cleared: false, 
        timestamp: new Date(),
        uid // This will be the user identifier in the Firestore document
      }, { merge: true });      
    console.log(`Discussion ${id ? "updated" : "added"} successfully.`);
  } catch (error) {
    console.error("Error adding/updating discussion:", error);
  }
}

export async function getDiscussions(lastX?: number, discussionId?: string): Promise<any[]> {
  try {
    const uid = getUID(); // Adding UID for user tracking  // Assuming getUID is a function that retrieves the current user's UID
    let discussionsQuery = query(
      collection(db, "Discussion"),
      where("uid", "==", uid), // Filter discussions by the user's UID
      orderBy("timestamp", "desc") // Sort by newest first
    );

    // If a discussionId is provided, start fetching before that document
    if (discussionId) {
      const discussionRef = doc(db, "Discussion", discussionId);
      const discussionSnap = await getDoc(discussionRef);

      if (discussionSnap.exists()) {
        discussionsQuery = query(discussionsQuery, startAfter(discussionSnap));
      } else {
        console.warn(`Discussion ID ${discussionId} not found.`);
      }
    }

    // If lastX is provided, limit the number of results
    if (lastX !== undefined) {
      discussionsQuery = query(discussionsQuery, limit(lastX));
    }

    // Get the documents from Firestore
    const discussionSnapshot = await getDocs(discussionsQuery);
    
    // Format and return the discussions
    return discussionSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp
        ? format(new Date(doc.data().timestamp.toDate()), "M/d/yy \n h:mm a")  // Formatting the timestamp
        : "N/A"
    }));

  } catch (error) {
    console.error("Error getting discussions:", error);
    return [];
  }
}

export async function deleteDiscussion(id: string): Promise<void> {
  try {
    const uid = getUID(); // Adding UID for user tracking  // Get the authenticated user's UID
    const discussionRef = doc(db, "Discussion", id);
    const discussionSnap = await getDoc(discussionRef);

    if (discussionSnap.exists()) {
      const discussionData = discussionSnap.data();

      // Check if the discussion belongs to the authenticated user
      if (discussionData.uid === uid) {
        await deleteDoc(discussionRef);
        console.log(`Discussion with ID ${id} deleted.`);
      } else {
        console.error(`You cannot delete a discussion that doesn't belong to you.`);
      }
    } else {
      console.error(`Discussion with ID ${id} does not exist.`);
    }
  } catch (error) {
    console.error(`Error deleting discussion with ID ${id}:`, error);
  }
}

// ✅ Fetch Initial Discussion Data
export const fetchInitialDiscussion = async () => {
  try {
    const uid = getUID(); // Adding UID for user tracking // Get the authenticated user's UID
    console.log("Fetching initial discussion with UID:", uid);
    
    // Query the "Discussion" collection, filtered by the current user's UID
    const discussionsQuery = query(
      collection(db, "Discussion"),
      where("uid", "==", uid)  // Filter discussions to include only those with the matching UID
    );
    
    const discussionSnapshot = await getDocs(discussionsQuery);
    
    if (!discussionSnapshot.empty) {
      const docSnapshot = discussionSnapshot.docs[0];
      const data = docSnapshot.data();

      return {
        id: docSnapshot.id,
        discussionId: data.discussionId,
        response: data.response,
        timestamp: data.timestamp ? data.timestamp.toDate() : new Date(), // Handle timestamp properly
        cleared: data.cleared,
      };
    }
    
    return null; // Return null if no discussions are found

  } catch (error) {
    console.error("🔥 Error fetching discussion:", error);
    return null; // Return null on error
  }
};

// ✅ Fetch the next open discussion and return both snapshot + hasMore flag
export const getNextOpenDiscussion = async (lastVisibleDoc?: any) => {
  try {
    const uid = getUID(); // Adding UID for user tracking // Get the authenticated user's UID
    
    // Start a new query for discussions, filtered by cleared status (false)
    let discussionsQuery = query(
      collection(db, "Discussion"),
      where("cleared", "==", false), // Only fetch discussions that are not cleared
      where("uid", "==", uid), // Filter by the current user's UID
      limit(1) // Limit to one document
    );

    // If a lastVisibleDoc is passed, use it for pagination
    if (lastVisibleDoc) {
      discussionsQuery = query(discussionsQuery, startAfter(lastVisibleDoc)); // Start after the last document
    }

    // Execute the query
    const snapshot = await getDocs(discussionsQuery);

    // ✅ Return snapshot + hasMore (false if no documents)
    const hasMore = !snapshot.empty;
    console.log("Query Snapshot:", snapshot.docs.map(doc => doc.data()));

    // Return the snapshot and a flag indicating whether there are more discussions
    return {
      snapshot,
      hasMore,
      lastVisibleDoc: snapshot.docs[snapshot.docs.length - 1] || null, // The last visible document for pagination
    };
  } catch (error) {
    console.error("🔥 Error fetching discussion:", error);
    return { snapshot: null, hasMore: false, lastVisibleDoc: null }; // Ensures consistent return format
  }
};


export async function addQuestionDiscussion(question: string, discussionId: string): Promise<string> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    console.log(`Adding question: ${question} to discussionId: ${discussionId}`);

    // Add or update the discussion
    await addOrUpdateDiscussion(question, 'ask', discussionId);
    
    console.log(`Successfully added question to discussion`);

    // Get GPT names (simulating this with a predefined list)
    const gpts_names_string = '["openAI", "Gemini", "ChatGPT", "Claude", "DeepSeek"]';
    const gpts_names = JSON.parse(gpts_names_string);
    console.log(`GPT names:`, gpts_names);

    // Get the list of categories
    const categories = await getDistinctCategories();
    console.log(`Categories:`, categories);

    // Send question for parsing (simulating response for now)
    const response = await sendQuestionForParsing({ categories, gpts_names, question, discussionId });
    console.log(`Parsed response received:`, response);

    // Save the GPT response to Firestore
    const docRef = await addDoc(collection(db, "GPTResponses"), {
      timestamp: new Date(),
      discussionId,
      prompt: question,
      response: JSON.stringify(response),
      responseType: "parsed question",
      cleared: false,
    });

    console.log(`Successfully saved GPT response with ID: ${docRef.id}`);
    return docRef.id; // Return the document ID of the saved GPT response
  } catch (error) {
    console.error('Error adding question discussion:', error);
    throw error; // Propagate the error so it can be handled higher up if needed
  }
}


export async function processUnclearedGPTResponses() {
  let hasMoreDocuments = true;
  const uid = getUID(); // Adding UID for user tracking

  while (hasMoreDocuments) {
    // Query Firestore for ONE uncleared GPTResponse
    const q = query(
      collection(db, "GPTResponses"),
      where("cleared", "==", false),
      where("responseType", "==", "updateDB"),
      limit(1) // Fetch only 1 document at a time
    );

    const gptQuerySnapshot = await getDocs(q);

    if (gptQuerySnapshot.empty) {
      hasMoreDocuments = false; // Exit loop if no uncleared documents remain
      break;
    }

    // Process the single document
    const docSnapshot = gptQuerySnapshot.docs[0];
    const gptResponseTyped = {
      id: docSnapshot.id,
      discussionId: docSnapshot.data().discussionId,
      response: docSnapshot.data().response,
      timestamp: docSnapshot.data().timestamp?.toDate() || new Date(),
      cleared: docSnapshot.data().cleared,
    };

    console.log("Processing GPT Response:", gptResponseTyped.id);

    const responseJson = JSON.parse(gptResponseTyped.response);
    const { category, parsedDescription } = responseJson;
    const { discussionId, timestamp } = gptResponseTyped;

    // Check if an ActivityLog with the same discussionId exists
    const activityLogRef = collection(db, "ActivityLog");
    const qq = query(activityLogRef, where("discussionId", "==", discussionId));
    const querySnapshot = await getDocs(qq);
    const activityLog = !querySnapshot.empty ? querySnapshot.docs[0] : null;

    if (activityLog) {
      console.log("Updating existing activity log...");
      const existingActivityLogRef = doc(db, "ActivityLog", activityLog.id);

      await updateDoc(existingActivityLogRef, {
        category,
        description: parsedDescription,
        responseType: "tell",
        cleared: true,
      });
    } else {
      console.log("Creating new activity log...");

      await addDoc(collection(db, "ActivityLog"), {
        discussionId,
        category,
        description: parsedDescription,
        timestamp: Timestamp.fromDate(timestamp),
        cleared: true,
      });
    }

    // Mark the GPTResponse itself as cleared
    const gptResponseRef = doc(db, "GPTResponses", gptResponseTyped.id);
    await updateDoc(gptResponseRef, { cleared: true });
    console.log("Processed and cleared GPTResponse:", gptResponseTyped.id);

    // Mark the GPTResponse itself as cleared
    //if this fails this quit the loop
    // Check if clearing the discussion was successful
    const success = await clearDiscussion(discussionId);
    if (!success) {
      console.error("Failed to clear discussion. Exiting process.");
      return; // Exit function instead of using break
    }
    /* const DiscussionRef = doc(db, "Discussion", discussionId);
    await updateDoc(DiscussionRef, { cleared: true });
    console.log("Processed and cleared Discussion:", discussionId); */
  }

  console.log("All GPTResponses have been cleared.");
}

export const markDiscussionAsCleared = async (discussionId: string) => {
  console.log(`Attempting to mark discussion ${discussionId} as cleared...`);
  try {
    const uid = getUID(); // Adding UID for user tracking
    const discussionRef = doc(db, "Discussion", discussionId);
    await updateDoc(discussionRef, { cleared: true });
    console.log(`✅ Discussion ${discussionId} marked as cleared.`);
  } catch (error) {
    console.error("🔥 Error marking discussion as cleared:", error);
  }
};

export async function clearDiscussion(discussionId: string) : Promise<boolean> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const discussionRef = doc(db, "Discussion", discussionId);  
    console.log(`Attempting to clear discussion ${discussionId}...`);
    const docSnapshot = await getDoc(discussionRef);

    if (docSnapshot.exists()) {
      console.log(`Discussion ${discussionId} exists. Updating...`);
      await updateDoc(discussionRef, { cleared: true });
      console.log(`Processed and cleared Discussion: ${discussionId}`);
    } else {
      console.log(`Discussion ${discussionId} not found. Skipping update.`);
    }
  } catch (error) {
    console.error(`Error clearing discussion ${discussionId}:`, error);
    //resetAppToInitialState();
    return false
  }
  return true
}

export async function addOrUpdateActivityLog(): Promise<void> {
  try {
    interface GPTResponseJSONData {
      category: string;
      parsedDescription: string;
    }
    const uid = getUID(); // Adding UID for user tracking // Fetch UID of the current user

    // Query Firestore for GPTResponses that haven't been cleared and require a DB update
    const q = query(
      collection(db, "GPTResponses"),
      where("cleared", "==", false),
      where("responseType", "==", "updateDB")
    );

    // Execute the query
    const gptQuerySnapshot = await getDocs(q);

    // Iterate over the documents
    gptQuerySnapshot.docs.forEach(async (docSnapshot) => {
      const gptResponseTyped = {
        id: docSnapshot.id, // Firestore document ID
        discussionId: docSnapshot.data().discussionId,
        response: docSnapshot.data().response,
        timestamp: docSnapshot.data().timestamp?.toDate() || new Date(), // Convert Firestore Timestamp to JS Date
        cleared: docSnapshot.data().cleared,
        uid: uid, // Add the UID here to associate it with the user
      };

      console.log("Raw GPT response JSON:", gptResponseTyped.response);

      // Parse the raw JSON from the 'response' field
      const responseJson = JSON.parse(gptResponseTyped.response) as GPTResponseJSONData;
      console.log("Parsed category:", responseJson.category);
      console.log("Parsed description:", responseJson.parsedDescription);

      const category = responseJson.category;
      const parsedDescription = responseJson.parsedDescription;
      const discussionId = gptResponseTyped.discussionId;
      const timestamp = gptResponseTyped.timestamp;

      // Check if there's an existing ActivityLog with the same discussionId
      const activityLogRef = collection(db, "ActivityLog");
      const qq = query(activityLogRef, where("discussionId", "==", discussionId));

      const querySnapshot = await getDocs(qq);
      const activityLog = !querySnapshot.empty ? querySnapshot.docs[0].data() : null;

      if (activityLog) {
        console.log("Updating existing response...");

        const existingActivityLogRef = doc(db, "ActivityLog", querySnapshot.docs[0].id);
        await updateDoc(existingActivityLogRef, {
          category: category,
          description: parsedDescription,
          responseType: "tell",
          cleared: true,
          uid: uid, // Add the UID here too
        });
      } else {
        console.log("No existing activity log found. Creating new activity log...");

        await addDoc(collection(db, "ActivityLog"), {
          id: new Date().getTime(),
          discussionId,
          category,
          description: parsedDescription,
          timestamp: Timestamp.fromDate(timestamp),
          cleared: true,
          uid: uid, // Add the UID when creating a new activity log
        });

        console.log("New response created.");
      }

      // Finally, mark the GPTResponse itself as cleared
      const gptResponseRef = doc(db, "GPTResponses", gptResponseTyped.id);
      await updateDoc(gptResponseRef, {
        cleared: true,
      });
    });
  } catch (error) {
    console.error("Error adding or updating GPT response:", error);
  }
}


export const renameFieldToCleared = async () => {
  try {
    const uid = getUID(); // Adding UID for user tracking // Get UID
    const discussionCollection = collection(db, "Discussion");

    const querySnapshot = await getDocs(discussionCollection);

    querySnapshot.forEach(async (document) => {
      const docRef = doc(db, "Discussion", document.id);
      const data = document.data();

      const fieldName = Object.keys(data).find(
        (key) => key.toLowerCase() === "cleared"
      );

      if (fieldName && fieldName !== "cleared") {
        await updateDoc(docRef, {
          cleared: data[fieldName], // Copy the value to the new field
          [fieldName]: deleteField(), // Remove the old field
          uid: uid, // Add UID here if you need to track the user
        });
        console.log(`Updated document ${document.id}`);
      }
    });

    console.log("All documents updated successfully!");
  } catch (error) {
    console.error("Error updating documents: ", error);
  }
};



// Call the function to rename the field
renameFieldToCleared();

interface lastOpenDiscussion{
  id: string;
  description: string;}

export async function getLastOpenDiscussion(): Promise<lastOpenDiscussion> {
  //console.log('Getting last open discussion...');
  const currentTime = new Date();
  try {
    const uid = getUID(); // Adding UID for user tracking
    // Add a new document to the "Discussion" collection
 
/* 

  let realm: Realm | null = null;
  try {
 //   let realm: Realm;
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
    }); */
     // Query the "Discussion" collection
  const querySnapshot = await getDocs(collection(db, 'Discussion'));

  // Extract data from the query snapshot
  const discussions = querySnapshot.docs.map(doc => ({
    id: doc.id, // Firestore automatically generates document IDs
    ...doc.data() as { timestamp: Date, description: string, cleared: boolean }, // Spread the document data (timestamp, description, cleared, etc.)
  }));

  //console.log('Discussions:', discussions);
    //const discussions = realm.objects('Discussion');
    const lastOpenDiscussion = discussions
      .filter(discussion => !discussion.cleared && discussion.description !== "" && discussion.description !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    console.log('Last open discussion:', lastOpenDiscussion.description);
    return {
      id: lastOpenDiscussion.id,
      description: lastOpenDiscussion.description
    };
  } catch (error) {
    console.error('Error getting last open discussion:', error);
    return Promise.reject(error);
  } finally {
 /*    if (realm && realm.close) {
      realm.close();
    } */
  }
}

async function waitForDocument(ref: DocumentReference<unknown, DocumentData>, timeout = 5000) {
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
      reject(new Error('Document did not become available within the specified timeout.'));
    }, timeout);
  });
}


export async function disperseQuestion(discussionId: string, GPT_ResponseId: string): Promise<string[] | undefined> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    console.log("Attempting to disperse question and get answers...");
    const discussionRef = doc(collection(db, "Discussion"), discussionId);
    const discussionDoc = await getDoc(discussionRef);

    if (!discussionDoc.exists()) {
      console.log(`No discussion found with ID: ${discussionId}`);
      return;
    }
    const gptResponseRef = doc(collection(db, "GPTResponses"), GPT_ResponseId);

    // ✅ Wait for Firestore to notify us when the document is ready
    //console.log("Waiting for GPT Response to be ready...");
    const gptResponseDoc = await waitForDocument(gptResponseRef);
    console.log("GPT Response is ready.");

    if (!gptResponseDoc) {
      console.error("GPT Response not found");
      return undefined;
    }
    console.log("GPT Response found:", JSON.parse((gptResponseDoc as DocumentSnapshot).get('response')));
    const parsedQuestion = JSON.parse((gptResponseDoc as DocumentSnapshot).get('response'));
    let responses: string[] = [];

    for (const part of parsedQuestion.parts) {
      const { gpt, category, parsedDescription: question } = part;

      console.log(`Sending question to GPT ${gpt} for category(s) ${category}:`, question);

      const response = await sendQuestion({ category, gpt, question, discussionId });

      console.log(`Got response from GPT ${gpt} for category(s) ${category}:`, response);

      await addDoc(collection(db, "GPTResponses"), {
        timestamp: new Date(),
        prompt: question,
        response: response,
        responseType: "gpt response",
        discussionId,
        cleared: false,
      });

      responses.push(response.parsedDescription);
    }
    
    return responses;
  } catch (error) {
    console.error("Error dispersing question:", error);
    return undefined;
  }
}


export async function disperseQuestionOLD(discussionId: string, GPT_ResponseId: string): Promise<String[] | undefined> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    // Fetch the discussion document by ID
    const discussionRef = doc(collection(db, 'Discussion'), discussionId.toString());
    const discussionDoc = await getDoc(discussionRef);

    if (discussionDoc.exists()) {
      // Fetch the GPT_Response document by ID
      const gptResponseRef = doc(collection(db, 'GPTResponses'), GPT_ResponseId.toString());
      const gptResponseDoc = await getDoc(gptResponseRef);

      if (gptResponseDoc.exists()) {
        // Parse the GPT response
        const parsedQuestion = JSON.parse(gptResponseDoc.data()!.response as string);
        let responses: string[] = []
        // Iterate through each part of the parsed question
        for (const part of parsedQuestion.parts) {
          const gpt = part.gpt;
          const category = part.category;
          const question = part.parsedDescription;

          console.log(`Sending question to GPT ${gpt} for category ${category}:`, question);

          // Send the question to GPT and get the response
          const response = await sendQuestion({ category, gpt, question, discussionId });

          console.log(`Got response from GPT ${gpt} for category ${category}:`, response);

          // If you want to store each GPT’s response in Firestore:
          await addDoc(collection(db, 'GPTResponses'), {
            id: new Date().getTime(),
            timestamp: new Date(),
            prompt: question,
            response: response,
            responseType: 'gpt response',
            discussionId: discussionId,
            cleared: false,
          });
          responses.push(response.parsedDescription)
        }
        return responses
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
  cleared: boolean = false,
): Promise<void> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const docRef = doc(collection(db, "GPTResponses"), String(Date.now()));

    await setDoc(docRef, {
      discussionId,
      response,
      responseType,
      timestamp: new Date(),
      cleared: cleared,
    });

    console.log("GPT Response saved.");
  } catch (error) {
    console.error("Error adding/updating GPT response:", error);
  }
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const q = query(collection(db, "GPTResponses"), where("discussionId", "==", discussionId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc: { data: () => any; }) => doc.data());
  } catch (error) {
    console.error("Error getting GPT responses:", error);
    return [];
  }
}

export async function getParsedGPTResponses(discussionId: string): Promise<string[]> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const parsedResponses: string[] = [];
    let lastVisible: any = null;
    const batchSize = 10; // Number of docs to fetch per batch

    do {
      let q = query(
        collection(db, "GPTResponses"),
        where("discussionId", "==", discussionId),
        where("responseType", "==", "parsed answer"), // Filter only parsed answers
       // orderBy("timestamp", "asc"), // Ensure chronological order
        limit(batchSize)
      );

      if (lastVisible) {
        q = query(q, startAfter(lastVisible));
      }

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.responseType === "parsed answer") {
            parsedResponses.push(data.response); // Collect only the response field
          }
        });
        lastVisible = snapshot.docs[snapshot.docs.length - 1];
      } else {
        lastVisible = null; // No more data
      }
    } while (lastVisible); // Continue fetching until all documents are retrieved

    return parsedResponses;
  } catch (error) {
    console.error("Error getting parsed GPT responses:", error);
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
// AI_Modle Functions  //
//////////////////////////////////////////


export async function getModelAPIkey(owner: string , name: string, model: string): Promise<ModelAPIkey | null> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const q = query(collection(db, "AI_Models"), where("owner", "==", owner), where("Name", "==", name), where("Model", "==", model));
    const snapshot = await getDocs(q);
    for (const doc of snapshot.docs) {
      console.log(doc.id, '=>', doc.data());
      if (doc.data().active) {
        const apiKey = doc.data().apiKey;
        const endPointURL = doc.data().endPointURL;
        console.log("API Key loaded:", apiKey);
        console.log("EndPoint URL:", endPointURL);
        return { aiModel: model, apiKey, endPointURL };
      }
    }
    console.warn("No API key found.");
    return null;
  } catch (error) {
    console.error("Error fetching API key:", error);
    return null;
  }
}


//////////////////////////////////////////
// Helper Functions for Cloud Sync //
//////////////////////////////////////////

export async function syncToCloud(
  tableName: string, 
  payload: any, 
  method: "POST" | "PUT" | "DELETE"
): Promise<void> {
  const url = `http://localhost:5155/api/${tableName.toLowerCase()}`;
  try {
    const uid = getUID(); // Adding UID for user tracking
    const config = { headers: { "Content-Type": "application/json" } };
    let response;

    if (method === "POST") {
      response = await fetch(url, { method, headers: config.headers, body: JSON.stringify(payload) });
    } else if (method === "PUT") {
      response = await fetch(url, { method, headers: config.headers, body: JSON.stringify(payload) });
    } else if (method === "DELETE") {
      response = await fetch(`${url}/${payload.id}`, { method, headers: config.headers });
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
  try {
    const uid = getUID(); // Adding UID for user tracking
    const q = query(collection(db, "Alert"), where("isActive", "==", true));
    const snapshot = await getDocs(q);
    return snapshot.docs.length ? snapshot.docs[0].data() : null;
  } catch (error) {
    console.error("Error fetching active alert:", error);
    return null;
  }
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const docRef = alertData._id 
      ? doc(db, "Alert", alertData._id) 
      : doc(collection(db, "Alert"));

    await setDoc(docRef, { ...alertData, createdAt: new Date() }, { merge: true });
    console.log(`Alert ${alertData._id ? "updated" : "added"} successfully.`);
  } catch (error) {
    console.error("Error adding/updating alert:", error);
  }
}

//////////////////////////////////////////
// Database functions for GPT Specialties //
//////////////////////////////////////////

export async function getURLofGPT(gpt_name: string): Promise<{ url: string; apiKey: string } | null> {
  try {
    const uid = getUID(); // Adding UID for user tracking
    const q = query(collection(db, "GPTSpecialties"), where("name", "==", gpt_name));
    const snapshot = await getDocs(q);
    return snapshot.docs.length ? snapshot.docs[0].data() as { url: string; apiKey: string } : null;
  } catch (error) {
    console.error("Error fetching GPT specialty:", error);
    return null;
  }
}

export async function expandFromAbbreviation(discussion: string): Promise<string> {
  console.log(`Attempting to expand abbreviation '${discussion}'`);
  const uid = getUID(); // Adding UID for user tracking
  const abbreviationMap = new Map<string, string>([
    ['1', 'i urinated'],
    ['11', 'i had a high volume of urination'],
    ['2', 'i had a regular size poop'],
    ['22', 'i had a large poop']
  ]);
  const expandedForm = abbreviationMap.get(discussion);
  console.log(`Expanded '${discussion}' to '${expandedForm}'`);
  if (expandedForm) {
    console.log(`Expanded '${discussion}' to '${expandedForm}'`);
    return expandedForm;
  } else {
    console.log(`Unable to expand abbreviation '${discussion}'`);
    return discussion; // Return the original
  }
}

//////////////////////////////////////////
// Exporting Helper Functions //
//////////////////////////////////////////

   /*  async function updateDiscussions() {
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
      { id: "1738367528606", typeSay: "tell", timestamp: 1738367528606, description: "1" },
      { id: "1738374105437", typeSay: "tell", timestamp: 1738374105437, description: "I ate salmon couscous and 2 slices of avocado" },
      { id: "1738382525048", typeSay: "tell", timestamp: 1738382525048, description: "Took 5 mg Staten" },
      { id: "7vukcCfVaBApZaAv6PoU", typeSay: "tell", timestamp: 1738374105437, description: "I'm feeling anxious and frustrated" },
      { id: "92JlMF1EHheU8uPMLBMi", typeSay: "tell", timestamp: 1738382525048, description: "1" },
      { id: "ArZ5Z0pQN1RKVb3kWuVh", typeSay: "tell", timestamp: 1738374105437, description: "Ate Cheese omelet 3 out of 4 yolks removed with mustard leaf onions" },
      { id: "BA5UcSPVyWjPUHCMNiwM", typeSay: "tell", timestamp: 1738382525048, description: "I ate banana" },
      { id: "Du7Py4BgHvrAxmY9IK7l", typeSay: "tell", timestamp: 1738374105437, description: "I weigh 198 pounds" },
      { id: "FiXuBOhnBeEAttEsR6gu", typeSay: "tell", timestamp: 1738374105437, description: "Took NATtokinase 4000 fu 3 tabs" },
      { id: "FpXSZiDfKRVoyPvHlFNm", typeSay: "tell", timestamp: 1738374105437, description: "My Blood Pressure was 139 over 77 heart rate 79" },
      { id: "GVaBSIODW1Mwu7zlQKOn", typeSay: "tell", timestamp: 1738382525048, description: "1" },
      { id: "XraDybqXtDXAZV6zzdEJ", typeSay: "tell", timestamp: 1738374105437, description: "I slept about 8 hours" },
      { id: "pMkrwd6YHnd5rp0haNl4", typeSay: "tell", timestamp: 1738374105437, description: "Drank two cups of coffee with creamer" },
      { id: "sij7LXj17QS9h5K1boPa", typeSay: "tell", timestamp: 1738374105437, description: "Last night I had a lettuce salad with dressing with sardines" },
      { id: "vk1N3fkTLJyYyFU5XNw0", typeSay: "tell", timestamp: 1738374105437, description: "Planted several new tomato bushes in the garden" },
    ];
    
    // Function to restore data
    async function restoreLostData() {
      const uid = getUID(); // Adding UID for user tracking
      const collectionRef = collection(db, "ActivityLog"); // Change to your collection name
    
      for (const entry of lostData) {
        try {
          const docRef = doc(collectionRef, entry.id); // Use provided ID if available
          await setDoc(docRef, {
            typeSay: entry.typeSay,
            description: entry.description,
            timestamp: Timestamp.fromMillis(entry.timestamp) // Convert to Firestore Timestamp
          });
    
          console.log(`Restored document: ${entry.id}`);
        } catch (error) {
          console.error(`Failed to restore document ${entry.id}:`, error);
        }
      }
    
      console.log("Data restoration completed!");
    }
    
    // Run the function
//    restoreLostData();
    
