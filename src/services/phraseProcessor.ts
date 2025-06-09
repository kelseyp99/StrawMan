import axios from 'axios';
import { ActivityInput, analyzeActivity, ParsedActivity } from './openaiAPI';
import { getRules } from './dbServices';
import { db } from '../firebaseConfig';
import {
  doc,
  updateDoc,
  addDoc,
  collection,
  getDoc,
  Timestamp,
  where,
  query,
  getDocs,
} from 'firebase/firestore';
import { ActivityLog } from './types';

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

  const double8 = trimmed.match(/^88\s*(.*)$/i);
  if (double8) {
    result = `Ate a ${double8[1]}`;
  } else {
    const single8 = trimmed.match(/^8\s*(.*)$/i);
    if (single8) {
      result = `Ate ${single8[1]}`;
    } else {
      const wordEight = trimmed.match(/^eight\s*(.*)$/i);
      if (wordEight) {
        result = `Ate ${wordEight[1]}`;
      }
    }
  }

  return result.replace(/\s{2,}/g, ' ').trim();
}

export const processPhrase = async (
  input: ActivityInput,
  discussionCounts: {
    discussionID: string;
    activityLogId: string;
    count: number;
    description: string;
  }[],
  setDiscussionCounts: React.Dispatch<
    React.SetStateAction<
      {
        discussionID: string;
        activityLogId: string;
        count: number;
        description: string;
      }[]
    >
  >,
  discussionId: string,
  uid: string
): Promise<ParsedActivity> => {
  console.log('Processing phrase:', input.description);
  const { categories: distinctCategories, description } = input;

  for (const entry of discussionCounts) {
    if (entry.description === description) {
      const updatedCounts = discussionCounts.map((countEntry) =>
        countEntry.activityLogId === entry.activityLogId
          ? { ...countEntry, count: countEntry.count + 1 }
          : countEntry
      );
      setDiscussionCounts(updatedCounts.sort((a, b) => b.count - a.count));

      const activityLogRef = doc(db, 'ActivityLog', entry.activityLogId);
      const activityLogSnap = await getDoc(activityLogRef);
      if (activityLogSnap.exists()) {
        const activityLogData = activityLogSnap.data();
        const discussionCountRef = doc(
          db,
          `Users/${uid}/DiscussionCounts`,
          entry.discussionID
        );
        await updateDoc(discussionCountRef, { count: entry.count + 1 });

        return {
          category: activityLogData.category,
          parsedDescription: activityLogData.description,
        };
      }
    }
  }

  let activityAnalysis = await applyRules(description, distinctCategories);
  if (
    !activityAnalysis.category ||
    activityAnalysis.category === 'uncategorized'
  ) {
    const callOpenAI = useOpenAI;
    if (callOpenAI) {
      activityAnalysis = await analyzeActivity({
        categories: distinctCategories,
        description,
      });
    }
  }

  if (
    activityAnalysis.category &&
    activityAnalysis.category !== 'uncategorized' &&
    activityAnalysis.parsedDescription
  ) {
    const existingLog = await findDuplicateActivityLog(
      discussionId,
      activityAnalysis.category,
      activityAnalysis.parsedDescription,
      uid
    );
    let activityLogId: string;

    if (existingLog) {
      activityLogId = String(existingLog.id);
      const existingCount = discussionCounts.find(
        (count) => count.activityLogId === activityLogId
      );
      if (existingCount) {
        const updatedCounts = discussionCounts.map((countEntry) =>
          countEntry.activityLogId === activityLogId
            ? { ...countEntry, count: countEntry.count + 1 }
            : countEntry
        );
        setDiscussionCounts(updatedCounts.sort((a, b) => b.count - a.count));
        const discussionCountRef = doc(
          db,
          `Users/${uid}/DiscussionCounts`,
          existingCount.discussionID
        );
        await updateDoc(discussionCountRef, { count: existingCount.count + 1 });
      } else {
        const newDiscussionCount = {
          discussionID: discussionId,
          activityLogId: activityLogId,
          count: 1,
          description: activityAnalysis.parsedDescription,
        };
        const newDocRef = await addDoc(
          collection(db, `Users/${uid}/DiscussionCounts`),
          newDiscussionCount
        );
        setDiscussionCounts((prev) =>
          [...prev, { ...newDiscussionCount, discussionID: newDocRef.id }].sort(
            (a, b) => b.count - a.count
          )
        );
      }
    } else {
      const newActivityLog = await addDoc(collection(db, 'ActivityLog'), {
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
      console.log(
        `Created new ActivityLog entry ${activityLogId} for discussionId ${discussionId}`
      );

      const newDiscussionCount = {
        discussionID: discussionId,
        activityLogId: activityLogId,
        count: 1,
        description: activityAnalysis.parsedDescription,
      };
      const newDocRef = await addDoc(
        collection(db, `Users/${uid}/DiscussionCounts`),
        newDiscussionCount
      );
      setDiscussionCounts((prev) =>
        [...prev, { ...newDiscussionCount, discussionID: newDocRef.id }].sort(
          (a, b) => b.count - a.count
        )
      );
    }
  }

  return activityAnalysis;
};

export async function findDuplicateActivityLog(
  discussionId: string,
  category: string,
  description: string,
  uid: string
): Promise<ActivityLog | null> {
  const q = query(
    collection(db, 'ActivityLog'),
    where('discussionId', '==', discussionId),
    where('category', '==', category),
    where('description', '==', description),
    where('uid', '==', uid)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;

  const docData = snapshot.docs[0].data();
  const activityLog: ActivityLog = {
    id: snapshot.docs[0].id,
    discussionId: docData.discussionId || '',
    description: docData.description || '',
    category: docData.category || '',
    timestamp: docData.timestamp || Timestamp.fromDate(new Date()),
    cleared: docData.cleared || false,
    uid: docData.uid || '',
    lockedCategory: docData.lockedCategory || false,
    lockedDescription: docData.lockedDescription || false,
  };

  return activityLog;
}

export async function applyRules(
  discussion: string,
  distinctCategories: string[]
): Promise<ParsedActivity> {
  const abbreviationMap = new Map<string, string>([
    ['1', 'urinated'],
    ['11', 'high volume of urination'],
    ['2', 'regular size poop'],
    ['22', 'large poop'],
    ['222', 'very large poop'],
  ]);

  let extractedCategory = '';
  let remainingPhrase = discussion;

  const validCategories = distinctCategories;
  const categoryMatch = discussion.match(
    new RegExp(`^(${validCategories.join('|')})[:;]\\s*(.+)$`, 'i')
  );
  if (categoryMatch) {
    extractedCategory = categoryMatch[1].toLowerCase();
    remainingPhrase = categoryMatch[2];
    console.log(
      `Extracted category: "${extractedCategory}", remaining phrase: "${remainingPhrase}"`
    );
  }

  if (abbreviationMap.has(remainingPhrase)) {
    const expanded = abbreviationMap.get(remainingPhrase)!;
    remainingPhrase = expanded;
    return {
      category: extractedCategory || 'metabolism',
      parsedDescription: remainingPhrase.trim(),
    };
  }

  const normalizedInput = remainingPhrase.replace(/^I /i, '').trim();

  const rules = await getRules();
  for (const rule of rules) {
    let isMatch = false;
    let parsedDesc = normalizedInput;

    if (rule.isRegex) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(normalizedInput)) {
        isMatch = true;
      }
    } else {
      if (normalizedInput.includes(rule.pattern)) {
        isMatch = true;
      }
    }

    if (isMatch) {
      return {
        category: extractedCategory || rule.category,
        parsedDescription: parsedDesc.replace(/["']/g, '').trim(),
      };
    }
  }

  return {
    category: extractedCategory || 'uncategorized',
    parsedDescription: normalizedInput,
  };
}
