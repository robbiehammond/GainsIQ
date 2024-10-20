import React, { useState } from 'react';
import WorkoutTracker from './WorkoutTracker';
import LastMonthWorkouts from './LastMonthWorkouts';
import { Button, Container, ThemeProvider, createTheme } from '@mui/material';
import { indigo, amber, teal } from '@mui/material/colors';

// Custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: indigo[500],
    },
    secondary: {
      main: amber[500],
    },
    background: {
      default: teal[50],
    },
  },
  typography: {
    h4: {
      fontWeight: 'bold',
      color: indigo[700],
    },
    h5: {
      color: amber[800],
    },
  },
});

const App: React.FC = () => {
  const [currentPage, setCurrentPage] = useState<'tracker' | 'lastMonth'>('tracker');

  // Function to handle navigation
  const handleNavigation = (page: 'tracker' | 'lastMonth') => {
    setCurrentPage(page);
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
        {currentPage === 'tracker' ? (
          <>
            <WorkoutTracker />
            <Button
              variant="contained"
              color="secondary"
              fullWidth
              sx={{ marginTop: 2 }}
              onClick={() => handleNavigation('lastMonth')}
            >
              View Last Month's Workouts
            </Button>
          </>
        ) : (
          <>
            <LastMonthWorkouts />
            <Button
              variant="contained"
              color="primary"
              fullWidth
              sx={{ marginTop: 2 }}
              onClick={() => handleNavigation('tracker')}
            >
              Back to Workout Tracker
            </Button>
          </>
        )}
      </Container>
    </ThemeProvider>
  );
};

export default App;