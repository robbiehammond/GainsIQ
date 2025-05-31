import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { WeightUnit } from '../../types';

interface WeightUnitState {
  weightUnit: WeightUnit;
}

const initialState: WeightUnitState = {
  weightUnit: 'lbs',
};

const weightUnitSlice = createSlice({
  name: 'weightUnit',
  initialState,
  reducers: {
    setWeightUnit: (state, action: PayloadAction<WeightUnit>) => {
      state.weightUnit = action.payload;
    },
  },
});

export const { setWeightUnit } = weightUnitSlice.actions;
export default weightUnitSlice.reducer;