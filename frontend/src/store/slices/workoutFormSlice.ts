import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WorkoutFormState } from '../../types';

const initialState: WorkoutFormState = {
  selectedExercise: '',
  reps: '',
  weight: '',
};

const workoutFormSlice = createSlice({
  name: 'workoutForm',
  initialState,
  reducers: {
    updateWorkoutForm: (state, action: PayloadAction<Partial<WorkoutFormState>>) => {
      Object.assign(state, action.payload);
    },
    resetWorkoutForm: (state) => {
      Object.assign(state, initialState);
    },
  },
});

export const { updateWorkoutForm, resetWorkoutForm } = workoutFormSlice.actions;
export default workoutFormSlice.reducer;