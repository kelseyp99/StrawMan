import * as remote from './dbServicesRemote';

export async function initializeUser(): Promise<void> {
  return remote.initializeUser();
}

export async function getDistinctCategories(): Promise<string[]> {
  return remote.getDistinctCategories();
}

export async function insertJsonFile(jsonData: any): Promise<void> {
  return remote.insertJsonFile(jsonData);
}

export async function queryAllFieldsByCategories(
  categories: string[]
): Promise<string[]> {
  return remote.queryAllFieldsByCategories(categories);
}

export async function synchronizeActivityLog(
  appVersion: string
): Promise<void> {
  return remote.synchronizeActivityLog(appVersion);
}

export async function synchronizeDiscussions(
  appVersion: string
): Promise<void> {
  return remote.synchronizeDiscussions(appVersion);
}

export async function addOrUpdateDiscussion(
  description: string,
  typeSay: string = 'tell',
  id?: string
): Promise<string> {
  return remote.addOrUpdateDiscussion(description, typeSay, id);
}

export async function getDiscussions(
  lastX?: number,
  discussionId?: string
): Promise<any[]> {
  return remote.getDiscussions(lastX, discussionId);
}

export async function deleteDiscussion(id: string): Promise<void> {
  return remote.deleteDiscussion(id);
}

export async function fetchInitialDiscussion(): Promise<any | null> {
  return remote.fetchInitialDiscussion();
}

export async function getNextOpenDiscussion(lastVisible?: any): Promise<any> {
  return remote.getNextOpenDiscussion(lastVisible);
}

export async function processPendingTells(): Promise<void> {
  return remote.processPendingTells();
}

export async function addQuestionDiscussion(
  question: string,
  discussionId: string
): Promise<string> {
  return remote.addQuestionDiscussion(question, discussionId);
}

export async function processUnclearedGPTResponses(): Promise<void> {
  return remote.processUnclearedGPTResponses();
}

export async function markDiscussionAsCleared(
  discussionId: string
): Promise<void> {
  return remote.markDiscussionAsCleared(discussionId);
}

export async function clearDiscussion(discussionId: string): Promise<boolean> {
  return remote.clearDiscussion(discussionId);
}

export async function addOrUpdateActivityLog(): Promise<void> {
  return remote.addOrUpdateActivityLog();
}

export async function renameFieldToCleared(): Promise<void> {
  return remote.renameFieldToCleared();
}

export async function getLastOpenDiscussion(): Promise<any> {
  return remote.getLastOpenDiscussion();
}

export async function disperseQuestion(
  discussionId: string,
  GPT_ResponseId: string
): Promise<string[] | undefined> {
  return remote.disperseQuestion(discussionId, GPT_ResponseId);
}

export async function addOrUpdateGPTResponse(
  discussionId: string,
  response: string,
  responseType: string,
  cleared: boolean = false
): Promise<void> {
  return remote.addOrUpdateGPTResponse(
    discussionId,
    response,
    responseType,
    cleared
  );
}

export async function getGPTResponses(discussionId: string): Promise<any[]> {
  return remote.getGPTResponses(discussionId);
}

export async function getParsedGPTResponses(
  discussionId: string
): Promise<string[]> {
  return remote.getParsedGPTResponses(discussionId);
}

export async function getAIResponse(question: string): Promise<string> {
  return remote.getAIResponse(question);
}

export async function getNextActiveAlert(): Promise<any | null> {
  return remote.getNextActiveAlert();
}

export async function addOrUpdateAlert(alertData: any): Promise<void> {
  return remote.addOrUpdateAlert(alertData);
}

export async function getURLofGPT(gpt_name: string): Promise<any> {
  return remote.getURLofGPT(gpt_name);
}

export async function expandFromAbbreviation(
  discussion: string
): Promise<string> {
  return remote.expandFromAbbreviation(discussion);
}

export async function restoreLostData(): Promise<void> {
  return remote.restoreLostData();
}

export async function getRules(): Promise<any[]> {
  return remote.getRules();
}

export class DatabaseService extends remote.DatabaseService {}
