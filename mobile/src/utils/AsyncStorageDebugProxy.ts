// AsyncStorageDebugProxy.ts
// This file monkey-patches AsyncStorage to log all calls and stack traces for debugging leaks.
import AsyncStorage from '@react-native-async-storage/async-storage';

function logCall(method: string, args: any[]) {
  // Only log in development
  if (__DEV__) {
    console.log(
      `[AsyncStorage] ${method} called with:`,
      args,
      '\nStack:',
      new Error().stack
    );
  }
}

const methods = [
  'getItem',
  'setItem',
  'removeItem',
  'mergeItem',
  'clear',
  'getAllKeys',
  'multiGet',
  'multiSet',
  'multiRemove',
  'multiMerge',
];

const AsyncStorageProxy = new Proxy(AsyncStorage, {
  get(target, prop, receiver) {
    if (typeof prop === 'string' && methods.includes(prop)) {
      return (...args: any[]) => {
        logCall(prop, args);
        return (AsyncStorage as any)[prop](...args);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});

export default AsyncStorageProxy;
