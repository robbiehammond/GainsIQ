import React from 'react';
import WorkoutTracker from './WorkoutTracker';
import LastMonthWorkouts from './LastMonthWorkouts';
import WeightEntry from './WeightEntry';
import AnalysisView from './AnalysisView'; 
import ExerciseProgressPage from './ExerciseProgressPage';
import { Button, Container, ThemeProvider } from '@mui/material';
import { Route, Routes, Link, BrowserRouter } from 'react-router-dom';
import { theme } from './style/theme';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
          <Routes>
            <Route path="/" element={<WorkoutTracker />} />
            <Route path="/last-month" element={<LastMonthWorkouts />} />
            <Route path="/weight-entry" element={<WeightEntry />} />
            <Route path="/analysis" element={<AnalysisView />} /> 
            <Route path="/exercise-progress" element={<ExerciseProgressPage />} /> {/* new */}
          </Routes>
          <Link to="/">
            <Button variant="contained" color="secondary" fullWidth sx={{ marginTop: 2 }}>
              Back to Homepage
            </Button>
          </Link>
          <Link to="/last-month">
            <Button variant="contained" color="secondary" fullWidth sx={{ marginTop: 2 }}>
              View Last Month's Workouts
            </Button>
          </Link>
          <Link to="/weight-entry">
            <Button variant="contained" color="secondary" fullWidth sx={{ marginTop: 2 }}>
              Enter Bodyweight
            </Button>
          </Link>
          <Link to="/analysis">
            <Button variant="contained" color="secondary" fullWidth sx={{ marginTop: 2 }}>
              View Most Recent Analysis
            </Button>
          </Link>
          <Link to="/exercise-progress">
            <Button variant="contained" color="secondary" fullWidth sx={{ marginTop: 2 }}>
              View Exercise Progress
            </Button>
          </Link>
        </Container>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;