import { createStore, combineReducers } from 'redux';
import weightUnitReducer from '../reducers/UnitReducer';
import workoutFormReducer from '../reducers/workoutFormReducer';

const rootReducer = combineReducers({
  weightUnit: weightUnitReducer,
  workoutForm: workoutFormReducer,
});

const store = createStore(rootReducer);

export default store;
