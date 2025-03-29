export const SET_CUTTING = 'SET_CUTTING';

export function setCuttingState(unit: 'CUTTING' | 'BULKING') {
  return {
    type: SET_CUTTING,
    payload: unit,
  };
}