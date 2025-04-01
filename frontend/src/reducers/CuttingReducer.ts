import { SET_CUTTING } from "../actions/CuttingActions";

// TODO: Better name maybe?
interface CuttingState {
  cuttingState: 'CUTTING' | 'BULKING';
}

const initialState: CuttingState = {
    cuttingState: 'CUTTING'
};

export default function cuttingStateReducer(
  state = initialState,
  action: any
): CuttingState {
  switch (action.type) {
    case SET_CUTTING:
      return {
        ...state,
        cuttingState: action.payload,
      };
    default:
      return state;
  }
}