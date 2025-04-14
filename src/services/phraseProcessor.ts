import axios from 'axios';
import { ActivityInput, analyzeActivity, ParsedActivity } from './openaiAPI';
import { getRules } from './databaseService';

const useOpenAI = true; // Set this to false to use TensorFlow instead

// Dummy labels and tokenizer for example
const categories = ['exercise', 'meal', 'sleep', 'mood'];
const dummyTokenizer = (text: string): number[] => {
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => word.length % 10); // Dummy tokenization
};

// Example dummy TensorFlow model logic (restored as commented-out code)
/* async function loadModel(): Promise<tf.LayersModel> {
  // For React Native, load model from assets or remote URL
  // Example: Assuming model is bundled in app assets
  return await tf.loadLayersModel('https://example.com/path-to-your-model/model.json') as tf.LayersModel; // Update with real URL
}

async function classifyWithTensorFlow(phrase: string): Promise<ParsedActivity> {
  const model = await loadModel();

  const tokens = dummyTokenizer(phrase);
  // const input = tf.tensor2d([tokens], [1, tokens.length]);
  const prediction = model.predict(input) as tf.Tensor;

  const predictionData = await prediction.data();
  const categoryIndex = predictionData.indexOf(Math.max(...predictionData));
  const category = categories[categoryIndex] || 'unknown';

  const summary = phrase.split(' ').slice(0, 5).join(' ') + '...';

  return { category, parsedDescription: summary };
} */

// New function to transform user input
export function transformInput(input: string): string {
  let transformedInput = input;

  // Handle transformations for inputs starting with "8", "8a", or "88"
  if (transformedInput.startsWith("8")) {
    if (transformedInput === "8") {
      transformedInput = "Ate " + transformedInput.slice(1);
    } else if (transformedInput.startsWith("8a") || transformedInput.startsWith("88")) {
      transformedInput = "Ate a" + transformedInput.slice(2);
    } else if (transformedInput.toUpperCase().startsWith("DRINK") ) {
      transformedInput = "Drank " + transformedInput.slice(5);
    }
  }

  // Trim and replace double spaces with single spaces
  transformedInput = transformedInput.trim().replace(/\s\s+/g, " ");

  return transformedInput;
}

// Main switch function
export const processPhrase = async (input: ActivityInput): Promise<ParsedActivity> => {
  console.log("Processing phrase:", input.description);
  const { categories: distinctCategories, description } = input;
  let activityAnalysis = (await applyRules(description)) as ParsedActivity;

  // Check if applyRules failed to assign a category or if it's "unclassified"
  if (!activityAnalysis.category || activityAnalysis.category === "unclassified") {
    const callOpenAI = false;
    if (callOpenAI) {
      activityAnalysis = await analyzeActivity({ categories: distinctCategories, description });
    } else {
      // activityAnalysis = await classifyWithTensorFlow(input.description);
    }
  }

  return activityAnalysis;
};

export async function applyRules(discussion: string): Promise<ParsedActivity> {
  // 1. Check hardcoded abbreviations first
  const abbreviationMap = new Map<string, string>([
    ['1', 'i urinated'],
    ['11', 'i had a high volume of urination'],
    ['2', 'i had a regular size poop'],
    ['22', 'i had a large poop'],
    ['222', 'i had a very large poop']
  ]);

  if (abbreviationMap.has(discussion)) {
    const expanded = abbreviationMap.get(discussion)!;
    discussion = expanded; // Use expanded form for rule processing
    return {
      category: "metabolism",
      parsedDescription: discussion.trim()
    };
  }

  // 2. Fetch all rules from Firebase
  const rules = await getRules();
  //console.log("Fetched rules:", rules); // Restored commented-out log
  // 3. Normalize input
  const normalizedInput = discussion.replace(/^I /i, '').trim();

  // 4. Process rules in order
  for (const rule of rules) {
    let isMatch = false;
    let parsedDesc = '';

    if (rule.isRegex) {
      // Handle regex rules
      const regex = new RegExp(rule.phrase, 'i'); // Case-insensitive
      if (regex.test(normalizedInput)) {
        isMatch = true;
        parsedDesc = normalizedInput.replace(regex, rule.replacement);
      }
    } else {
      // Handle exact match rules
      if (normalizedInput.includes(rule.phrase)) {
        isMatch = true;
        parsedDesc = normalizedInput.replace(rule.phrase, rule.replacement);
      }
    }

    if (isMatch) {
      return {
        category: rule.category,
        parsedDescription: parsedDesc.trim()
      };
    }
  }

  // 5. Fallback if no rules matched
  return {
    category: 'uncategorized',
    parsedDescription: discussion
  };
}