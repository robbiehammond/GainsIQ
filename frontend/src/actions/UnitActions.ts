export const SET_WEIGHT_UNIT = 'SET_WEIGHT_UNIT';

export function setWeightUnit(unit: 'kg' | 'lbs') {
  return {
    type: SET_WEIGHT_UNIT,
    payload: unit,
  };
}
