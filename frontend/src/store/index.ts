import { createStore, combineReducers } from 'redux';
import weightUnitReducer from '../reducers/UnitReducer';

const rootReducer = combineReducers({
  weightUnit: weightUnitReducer,
});

const store = createStore(rootReducer);

export default store;
