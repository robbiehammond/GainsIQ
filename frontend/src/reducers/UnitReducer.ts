import { SET_WEIGHT_UNIT } from "../actions/UnitActions";

interface WeightUnitState {
  weightUnit: 'kg' | 'lbs';
}

const initialState: WeightUnitState = {
  weightUnit: 'lbs', // default
};

export default function weightUnitReducer(
  state = initialState,
  action: any
): WeightUnitState {
  switch (action.type) {
    case SET_WEIGHT_UNIT:
      return {
        ...state,
        weightUnit: action.payload,
      };
    default:
      return state;
  }
}
