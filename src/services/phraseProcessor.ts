import axios from 'axios';
import { ActivityInput, analyzeActivity, ParsedActivity } from './openaiAPI';
import { getRules } from './databaseService';
import { db } from "../firebaseConfig";
import { doc, updateDoc, addDoc, collection, getDoc } from "firebase/firestore";

const useOpenAI = true;

const categories = ['exercise', 'meal', 'sleep', 'mood'];
const dummyTokenizer = (text: string): number[] => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.length % 10);
};

export function transformInput(input: string): string {
  const trimmed = input.trim();
  let result = trimmed;

  // 1) "88‑..."  → "Ate a ..."
  const double8 = trimmed.match(/^88\s*(.*)$/i);
  if (double8) {
    result = `Ate a ${double8[1]}`;
  } else {
    // 2) "8‑..."  → "Ate ..."
    const single8 = trimmed.match(/^8\s*(.*)$/i);
    if (single8) {
      result = `Ate ${single8[1]}`;
    } else {
      // 3) "eight ..." → "Ate ..."
      const wordEight = trimmed.match(/^eight\s*(.*)$/i);
      if (wordEight) {
        result = `Ate ${wordEight[1]}`;
      }
    }
  }

  // collapse any multiple spaces into one and trim again
  return result.replace(/\s{2,}/g, ' ').trim();
}

export const processPhrase = async (
  input: ActivityInput,
  discussionCounts: { discussionID: string; activityLogId: string; count: number; description: string }[],
  setDiscussionCounts: React.Dispatch<React.SetStateAction<{ discussionID: string; activityLogId: string; count: number; description: string }[]>>,
  discussionId: string,
  uid: string
): Promise<ParsedActivity> => {
  console.log("Processing phrase:", input.description);
  const { categories: distinctCategories, description } = input;

  // Check DiscussionCounts array for a matching description
  for (const entry of discussionCounts) {
    if (entry.description === description) {
      // Increment the count in the array
      const updatedCounts = discussionCounts.map(countEntry =>
        countEntry.activityLogId === entry.activityLogId
          ? { ...countEntry, count: countEntry.count + 1 }
          : countEntry
      );
      setDiscussionCounts(updatedCounts.sort((a, b) => b.count - a.count));

      // Fetch the ActivityLog entry to get category and description
      const activityLogRef = doc(db, "ActivityLog", entry.activityLogId);
      const activityLogSnap = await getDoc(activityLogRef);
      if (activityLogSnap.exists()) {
        const activityLogData = activityLogSnap.data();

        // Update Firestore DiscussionCounts count
        const discussionCountRef = doc(db, `Users/${uid}/DiscussionCounts`, entry.discussionID);
        await updateDoc(discussionCountRef, { count: entry.count + 1 });

        return {
          category: activityLogData.category,
          parsedDescription: activityLogData.description
        };
      }
    }
  }

  // If no match, proceed with rule application
  let activityAnalysis = await applyRules(description, distinctCategories);
  if (!activityAnalysis.category || activityAnalysis.category === "uncategorized") {
    const callOpenAI = useOpenAI;
    if (callOpenAI) {
      activityAnalysis = await analyzeActivity({ categories: distinctCategories, description });
    }
  }

  // Update DiscussionCounts if valid category
  if (activityAnalysis.category && activityAnalysis.category !== "uncategorized" && activityAnalysis.parsedDescription) {
    // Check if an ActivityLog entry exists for this discussionId and description
    const existingLog = await findDuplicateActivityLog(discussionId, activityAnalysis.category, activityAnalysis.parsedDescription, uid);
    let activityLogId: string;

    if (existingLog) {
      activityLogId = existingLog.id;
      // Check if a DiscussionCounts entry exists for this activityLogId
      const existingCount = discussionCounts.find(count => count.activityLogId === activityLogId);
      if (existingCount) {
        const updatedCounts = discussionCounts.map(countEntry =>
          countEntry.activityLogId === activityLogId
            ? { ...countEntry, count: countEntry.count + 1 }
            : countEntry
        );
        setDiscussionCounts(updatedCounts.sort((a, b) => b.count - a.count));
        const discussionCountRef = doc(db, `Users/${uid}/DiscussionCounts`, existingCount.discussionID);
        await updateDoc(discussionCountRef, { count: existingCount.count + 1 });
      } else {
        const newDiscussionCount = {
          discussionID: discussionId,
          activityLogId: activityLogId,
          count: 1,
          description: activityAnalysis.parsedDescription
        };
        const newDocRef = await addDoc(collection(db, `Users/${uid}/DiscussionCounts`), newDiscussionCount);
        setDiscussionCounts((prev) => [...prev, { ...newDiscussionCount, discussionID: newDocRef.id }].sort((a, b) => b.count - a.count));
      }
    } else {
      // Create a new ActivityLog entry
      const newActivityLog = await addDoc(collection(db, "ActivityLog"), {
        discussionId: discussionId,
        category: activityAnalysis.category,
        description: activityAnalysis.parsedDescription,
        timestamp: Timestamp.fromDate(new Date()),
        cleared: false,
        uid: uid,
        lockedCategory: false,
        lockedDescription: false,
      });
      activityLogId = newActivityLog.id;
      console.log(`Created new ActivityLog entry ${activityLogId} for discussionId ${discussionId}`);

      // Create a new DiscussionCounts entry
      const newDiscussionCount = {
        discussionID: discussionId,
        activityLogId: activityLogId,
        count: 1,
        description: activityAnalysis.parsedDescription
      };
      const newDocRef = await addDoc(collection(db, `Users/${uid}/DiscussionCounts`), newDiscussionCount);
      setDiscussionCounts((prev) => [...prev, { ...newDiscussionCount, discussionID: newDocRef.id }].sort((a, b) => b.count - a.count));
    }
  }

  return activityAnalysis;
};

// Helper function to find duplicate ActivityLog entries
async function findDuplicateActivityLog(discussionId: string, category: string, description: string, uid: string): Promise<ActivityLog | null> {
  const q = query(
    collection(db, "ActivityLog"),
    where("discussionId", "==", discussionId),
    where("category", "==", category),
    where("description", "==", description),
    where("uid", "==", uid)
  );
  const snapshot = await getDocs(q);
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ActivityLog;
}

export async function applyRules(discussion: string, distinctCategories: string[]): Promise<ParsedActivity> {
  const abbreviationMap = new Map<string, string>([
    ['1', 'urinated'],
    ['11', 'high volume of urination'],
    ['2', 'regular size poop'],
    ['22', 'large poop'],
    ['222', 'very large poop']
  ]);

  // Step 1: Check if the phrase starts with a category followed by : or ;
  let extractedCategory = '';
  let remainingPhrase = discussion;

  // Predefined categories
  const validCategories = distinctCategories;

  // Regex to match only valid categories
  const categoryMatch = discussion.match(new RegExp(`^(${validCategories.join('|')})[:;]\\s*(.+)$`, 'i'));
  if (categoryMatch) {
    extractedCategory = categoryMatch[1].toLowerCase();
    remainingPhrase = categoryMatch[2];
    console.log(`Extracted category: "${extractedCategory}", remaining phrase: "${remainingPhrase}"`);
  }

  // Step 2: Apply abbreviation expansion (if applicable)
  if (abbreviationMap.has(remainingPhrase)) {
    const expanded = abbreviationMap.get(remainingPhrase)!;
    remainingPhrase = expanded;
    return {
      category: extractedCategory || "metabolism",
      parsedDescription: remainingPhrase.trim()
    };
  }

  // Step 3: Normalize the remaining phrase
  const normalizedInput = remainingPhrase.replace(/^I /i, '').trim();

  // Step 4: Apply rules to the remaining phrase
  const rules = await getRules();
  for (const rule of rules) {
    let isMatch = false;
    let parsedDesc = '';

    if (rule.isRegex) {
      const regex = new RegExp(rule.phrase, 'i');
      if (regex.test(normalizedInput)) {
        isMatch = true;
        parsedDesc = normalizedInput.replace(regex, rule.replacement);
      }
    } else {
      if (normalizedInput.includes(rule.phrase)) {
        isMatch = true;
        parsedDesc = normalizedInput.replace(rule.phrase, rule.replacement);
      }
    }

    if (isMatch) {
      return {
        category: extractedCategory || rule.category,
        parsedDescription: parsedDesc.replace(/["']/g, '').trim() // clean up any leading/trailing spaces
      };
    }
  }

  // Step 5: If no rules match, return the extracted category (if any) or uncategorized
  return {
    category: extractedCategory || 'uncategorized',
    parsedDescription: normalizedInput
  };
}