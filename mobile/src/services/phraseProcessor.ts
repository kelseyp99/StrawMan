import axios from 'axios';
import { ActivityInput, analyzeActivity, ParsedActivity } from './openaiAPI';
import { getRules } from './dbServices';
import { ActivityLog } from './types';
// ...existing code...

const useOpenAI = true;

const categories = ['exercise', 'meal', 'sleep', 'mood'];

export function transformInput(input: string): string {
  // Custom transformation for codes starting with 8 or 8a
  const trimmed = input.trim();
  if (trimmed.toLowerCase().startsWith('8a')) {
    // "8a" → "Ate a..."
    return 'Ate a' + trimmed.slice(2);
  } else if (trimmed.startsWith('8')) {
    // "8" → "Ate..."
    return 'Ate' + trimmed.slice(1);
  }
  // Default: just trim whitespace
  return trimmed;
}

export const processPhrase = async (
  description: string,
  distinctCategories: string[],
  discussionCounts: any[],
  setDiscussionCounts: (value: any) => void,
  discussionId: string,
  uid: string
): Promise<ParsedActivity> => {
  // Firebase-dependent functionality disabled for offline-first operation
  // TODO: Implement with local Realm database

  for (const entry of discussionCounts) {
    if (entry.description === description) {
      const updatedCounts = discussionCounts.map((countEntry) =>
        countEntry.activityLogId === entry.activityLogId
          ? { ...countEntry, count: countEntry.count + 1 }
          : countEntry
      );
      setDiscussionCounts(updatedCounts.sort((a, b) => b.count - a.count));

      // Return a default response for now
        return {
          category: 'uncategorized',
          parsedDescription: description,
        };
    }
  }

  let activityAnalysis = await applyRules(description, distinctCategories);
  if (
    !activityAnalysis ||
    activityAnalysis.category === 'Unknown' ||
    !activityAnalysis.parsedDescription
  ) {
    // console.log('Applying OpenAI analysis');
    activityAnalysis = await analyzeActivity({
      categories: distinctCategories,
      description: description,
    });
    // console.log('OpenAI analysis result:', activityAnalysis);
  }

  // For offline-first approach, don't attempt to save to Firebase
  // Just update local state
  const newDiscussionCount = {
    discussionID: discussionId,
    activityLogId: 'local_' + Date.now(),
    count: 1,
    description: activityAnalysis.parsedDescription,
  };

  setDiscussionCounts((prev: any) =>
    [
      ...prev,
      { ...newDiscussionCount, discussionID: 'local_' + Date.now() },
    ].sort((a: any, b: any) => b.count - a.count)
  );

  return activityAnalysis;
};

// Use local implementation for finding duplicate ActivityLog
export async function findDuplicateActivityLog(
  discussionId: string,
  category: string,
  description: string,
  uid: string
): Promise<ActivityLog | null> {
  try {
    // Call the local implementation (note: it's synchronous)
  // Removed: const result = localFindDuplicate(discussionId, category, description);
  return null;
  } catch (error) {
    console.error('Error finding duplicate ActivityLog:', error);
    return null;
  }
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
    ['3', 'diarrhea'],
    ['4', 'constipated'],
    ['5', 'nauseous'],
    ['6', 'vomited'],
    ['7', 'headache'],
    ['8', 'tired'],
    ['9', 'stressed'],
    ['10', 'anxious'],
    ['w', 'drank water'],
    ['ww', 'drank lots of water'],
    ['coffee', 'drank coffee'],
    ['tea', 'drank tea'],
    ['b', 'ate breakfast'],
    ['l', 'ate lunch'],
    ['d', 'ate dinner'],
    ['s', 'had a snack'],
    ['ss', 'had multiple snacks'],
    ['run', 'went for a run'],
    ['walk', 'went for a walk'],
    ['gym', 'went to the gym'],
    ['yoga', 'did yoga'],
    ['stretch', 'did stretching exercises'],
    ['sleep', 'went to sleep'],
    ['nap', 'took a nap'],
    ['wake', 'woke up'],
    ['work', 'went to work'],
    ['home', 'went home'],
    ['shower', 'took a shower'],
    ['bath', 'took a bath'],
    ['brush', 'brushed teeth'],
    ['floss', 'flossed teeth'],
    ['medicine', 'took medicine'],
    ['vitamin', 'took vitamins'],
    ['supplement', 'took supplements'],
    ['happy', 'feeling happy'],
    ['sad', 'feeling sad'],
    ['angry', 'feeling angry'],
    ['excited', 'feeling excited'],
    ['calm', 'feeling calm'],
    ['energetic', 'feeling energetic'],
  ]);

  // First, check for direct abbreviation matches
  const normalizedDiscussion = discussion.toLowerCase().trim();
  if (abbreviationMap.has(normalizedDiscussion)) {
    const expandedDescription = abbreviationMap.get(normalizedDiscussion)!;
    const category = categorizeDescription(
      expandedDescription,
      distinctCategories
    );
    return {
      category,
      parsedDescription: expandedDescription,
    };
  }

  // If no abbreviation match, try to categorize the original text
  const category = categorizeDescription(discussion, distinctCategories);

  return {
    category: category || 'uncategorized',
    parsedDescription: discussion,
  };
}

function categorizeDescription(
  description: string,
  distinctCategories: string[]
): string {
  const lowerDescription = description.toLowerCase();

  // Define keyword mappings for categories
  const categoryKeywords = {
    exercise: [
      'run',
      'walk',
      'gym',
      'yoga',
      'workout',
      'exercise',
      'jog',
      'bike',
      'swim',
      'stretch',
    ],
    meal: [
      'ate',
      'eat',
      'breakfast',
      'lunch',
      'dinner',
      'snack',
      'food',
      'meal',
      'hungry',
    ],
    drink: [
      'drink',
      'drank',
      'water',
      'coffee',
      'tea',
      'juice',
      'soda',
      'beer',
      'wine',
    ],
    sleep: ['sleep', 'nap', 'tired', 'wake', 'bed', 'rest'],
    mood: [
      'happy',
      'sad',
      'angry',
      'excited',
      'calm',
      'stressed',
      'anxious',
      'feeling',
    ],
    health: [
      'medicine',
      'vitamin',
      'supplement',
      'doctor',
      'sick',
      'headache',
      'pain',
    ],
    bathroom: ['urinated', 'poop', 'diarrhea', 'constipated', 'bathroom'],
    hygiene: ['shower', 'bath', 'brush', 'floss', 'wash', 'clean'],
  };

  // Check each category for keyword matches
  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((keyword) => lowerDescription.includes(keyword))) {
      // Check if this category exists in the distinct categories
      if (distinctCategories.includes(category)) {
        return category;
      }
    }
  }

  // If no specific category found, return the first available category or 'uncategorized'
  return distinctCategories.length > 0 ? distinctCategories[0] : 'uncategorized';
}
