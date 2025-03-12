// src/utils/uidManager.ts
let currentUID: string | null = null;

export const setUID = (uid: string | null) => {
  currentUID = uid;
  console.log("UID set in uidManager:", uid);
};

export const getUID = () => {
  console.log("UID retrieved from uidManager:", currentUID);
  return currentUID;
};

export const clearUID = () => {
  currentUID = null;
  console.log("UID cleared from uidManager");
};