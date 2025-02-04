// src/reducers/workoutFormReducer.ts

export interface WorkoutFormState {
  selectedExercise: string;
  reps: string;
  setNumber: string;
  weight: string;
}

const initialState: WorkoutFormState = {
  selectedExercise: '',
  reps: '',
  setNumber: '',
  weight: '',
};

export const UPDATE_WORKOUT_FORM = 'UPDATE_WORKOUT_FORM';

interface UpdateWorkoutFormAction {
  type: typeof UPDATE_WORKOUT_FORM;
  payload: Partial<WorkoutFormState>;
}

type WorkoutFormActionTypes = UpdateWorkoutFormAction;

export function updateWorkoutForm(payload: Partial<WorkoutFormState>) {
  return {
    type: UPDATE_WORKOUT_FORM,
    payload,
  };
}

export default function workoutFormReducer(
  state = initialState,
  action: WorkoutFormActionTypes
): WorkoutFormState {
  switch (action.type) {
    case UPDATE_WORKOUT_FORM:
      return {
        ...state,
        ...action.payload,
      };
    default:
      return state;
  }
}
