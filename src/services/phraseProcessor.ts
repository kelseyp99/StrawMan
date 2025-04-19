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
  let transformedInput = input;
  if (transformedInput.startsWith("8")) {
    if (transformedInput === "8") {
      transformedInput = "Ate " + transformedInput.slice(1);
    } else if (transformedInput.startsWith("8a") || transformedInput.startsWith("88")) {
      transformedInput = "Ate a" + transformedInput.slice(2);
    }
  }
  transformedInput = transformedInput.trim().replace(/\s\s+/g, " ");
  return transformedInput;
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
  let activityAnalysis = await applyRules(description);
  if (!activityAnalysis.category || activityAnalysis.category === "unclassified") {
    const callOpenAI = useOpenAI; // Use the constant defined at the top
    if (callOpenAI) {
      activityAnalysis = await analyzeActivity({ categories: distinctCategories, description });
    }
  }

  return activityAnalysis;
};

export async function applyRules(discussion: string): Promise<ParsedActivity> {
  const abbreviationMap = new Map<string, string>([
    ['1', 'i urinated'],
    ['11', 'i had a high volume of urination'],
    ['2', 'i had a regular size poop'],
    ['22', 'i had a large poop'],
    ['222', 'i had a very large poop']
  ]);

  // Step 1: Check if the phrase starts with a category followed by : or ;
  let extractedCategory = '';
  let remainingPhrase = discussion;

  // Predefined categories
  const validCategories = ['vitals', 'diet', 'mood', 'exercise', 'sleep', 'metabolism'];

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
        parsedDescription: parsedDesc.trim()
      };
    }
  }

  // Step 5: If no rules match, return the extracted category (if any) or uncategorized
  return {
    category: extractedCategory || 'uncategorized',
    parsedDescription: normalizedInput
  };
}