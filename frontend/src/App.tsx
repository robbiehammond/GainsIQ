import React from 'react';
import { Route, Routes, BrowserRouter } from 'react-router-dom';
import { Layout } from './components';
import {
  WorkoutTracker,
  LastMonthWorkouts,
  WeightEntry,
  AnalysisView,
  ExerciseProgressPage,
} from './pages';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<WorkoutTracker />} />
          <Route path="/last-month" element={<LastMonthWorkouts />} />
          <Route path="/weight-entry" element={<WeightEntry />} />
          <Route path="/analysis" element={<AnalysisView />} />
          <Route path="/exercise-progress" element={<ExerciseProgressPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;