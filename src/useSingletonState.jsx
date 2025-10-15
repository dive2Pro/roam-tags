import React, { useEffect } from "react";

function createSingletonState(initialValue) {
  let state = initialValue;
  const listeners = [];
  return () => {
    const forceUpdate = React.useState(0)[1];
    const setState = (newState) => {
      state = newState;
      listeners.forEach((listener) => listener(state));
    };
    useEffect(() => {
      listeners.push(forceUpdate);
      return () => {
        const index = listeners.indexOf(forceUpdate);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      };
    }, []);
    return [state, setState];
  };
}
export const useModeState = createSingletonState("tree");
export const useCurrentTagState = createSingletonState("");
export const useDualColumnState = createSingletonState(true);
export const useShowDescendantsState = createSingletonState(true);
