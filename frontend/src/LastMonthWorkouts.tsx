import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  Typography,
  Paper,
  Card,
  CardContent,
  ThemeProvider,
  createTheme,
  CircularProgress,
} from '@mui/material';
import { amber, teal, indigo } from '@mui/material/colors';

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
        const response = await fetch(`${apiUrl}/workouts`, {
            method: 'POST', // TODO: Don't make this a POST! 
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action: 'last_month_workouts' }), 
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
            <Grid container spacing={2}>
              {workouts.length > 0 ? (
                workouts.map((workout, index) => (
                  <Grid item xs={12} key={index}>
                    <Card sx={{ backgroundColor: amber[50] }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Exercise: {workout.exercise}
                        </Typography>
                        <Typography>
                          Sets: {workout.sets}, Reps: {workout.reps}, Weight: {workout.weight} lbs
                        </Typography>
                        <Typography>
                          Date: {new Date(parseInt(workout.timestamp) * 1000).toLocaleString()}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Typography variant="h6" align="center">
                  No workouts found.
                </Typography>
              )}
            </Grid>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default LastMonthWorkouts;