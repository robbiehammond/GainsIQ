import { createStore, combineReducers } from 'redux';
import weightUnitReducer from '../reducers/UnitReducer';
import workoutFormReducer from '../reducers/workoutFormReducer';
import cuttingStateReducer from '../reducers/CuttingReducer';

const rootReducer = combineReducers({
  weightUnit: weightUnitReducer,
  workoutForm: workoutFormReducer,
  weightModulation: cuttingStateReducer,
});

const store = createStore(rootReducer);

export default store;
