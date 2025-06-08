import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CuttingState as CuttingStateType } from '../../types';

interface CuttingState {
  cuttingState: CuttingStateType;
}

const initialState: CuttingState = {
  cuttingState: 'BULKING',
};

const cuttingSlice = createSlice({
  name: 'cutting',
  initialState,
  reducers: {
    setCuttingState: (state, action: PayloadAction<CuttingStateType>) => {
      state.cuttingState = action.payload;
    },
  },
});

export const { setCuttingState } = cuttingSlice.actions;
export default cuttingSlice.reducer;