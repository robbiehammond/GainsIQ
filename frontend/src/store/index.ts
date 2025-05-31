import { configureStore } from '@reduxjs/toolkit';
import { weightUnitSlice, cuttingSlice, workoutFormSlice } from './slices';

const store = configureStore({
  reducer: {
    weightUnit: weightUnitSlice,
    workoutForm: workoutFormSlice,
    weightModulation: cuttingSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
