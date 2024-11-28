import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  Grid,
  ThemeProvider,
  createTheme
} from '@mui/material';
import { amber, teal, indigo } from '@mui/material/colors';
import ExpandIcon from '@mui/icons-material/Expand';
import { groupBy } from 'lodash'; // Import lodash for grouping

// Create a custom theme with more colors
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

interface Workout {
  exercise: string;
  weight: string;
  reps: string;
  sets: string;
  timestamp: string;
}

const LastMonthWorkouts: React.FC = () => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchWorkouts = async () => {
      try {
        const response = await fetch(`${apiUrl}/sets/last_month`, {
          method: 'GET', 
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch last month workouts');
        }

        const data = await response.json();
        setWorkouts(data || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching last month workouts:', error);
        setWorkouts([]);
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, [apiUrl]);

  // Function to group workouts by date
  const groupWorkoutsByDate = (workouts: Workout[]) => {
    return groupBy(workouts, (workout) =>
      new Date(parseInt(workout.timestamp) * 1000).toLocaleDateString()
    );
  };

  const groupedWorkouts = groupWorkoutsByDate(workouts);

    const sortedDates = Object.keys(groupedWorkouts).sort((a, b) => {
        const dateA = new Date(a).getTime();
        const dateB = new Date(b).getTime();
        return dateB - dateA; // Sort in reverse order
      }
    );

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
        <Paper elevation={3} sx={{ padding: '20px', backgroundColor: theme.palette.background.default }}>
          <Typography variant="h4" align="center" gutterBottom>
            Last Month's Workouts
          </Typography>

          {loading ? (
            <Grid container justifyContent="center">
              <CircularProgress />
            </Grid>
          ) : (
            <>
              {sortedDates.length > 0 ? (
                sortedDates.map((date, index) => (
                  <Accordion key={index}>
                    <AccordionSummary expandIcon={<ExpandIcon></ExpandIcon>}>
                      <Typography>{date}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      {groupedWorkouts[date].map((workout, workoutIndex) => (
                        <Paper
                          key={workoutIndex}
                          elevation={1}
                          sx={{ padding: '10px', marginBottom: '10px' }}
                        >
                          <Typography variant="h6">{workout.exercise}</Typography>
                          <Typography>
                            Sets: {workout.sets}, Reps: {workout.reps}, Weight: {workout.weight} lbs
                          </Typography>
                          <Typography>
                            Time: {new Date(parseInt(workout.timestamp) * 1000).toLocaleTimeString()}
                          </Typography>
                        </Paper>
                      ))}
                    </AccordionDetails>
                  </Accordion>
                ))
              ) : (
                <Typography variant="h6" align="center">
                  No workouts found.
                </Typography>
              )}
            </>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default LastMonthWorkouts;