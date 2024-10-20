import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import WorkoutTracker from './WorkoutTracker';  // Make sure the path is correct
import LastMonthWorkouts from './LastMonthWorkouts';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<WorkoutTracker />} />
        <Route path="/last-month-workouts" element={<LastMonthWorkouts />} />
      </Routes>
    </Router>
  );
};

export default App;