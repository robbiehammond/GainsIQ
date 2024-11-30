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
} from '@mui/material';
import ExpandIcon from '@mui/icons-material/Expand';
import { groupBy } from 'lodash'; 
import { theme } from './style/theme';
import { Set, SetUtils } from './models/Set';

const LastMonthWorkouts: React.FC = () => {
  const apiUrl = process.env.REACT_APP_API_URL || '';
  const [sets, setSets] = useState<Set[]>([]);
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

        setSets(data.map(SetUtils.fromBackend) || []);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching last month workouts:', error);
        setSets([]);
        setLoading(false);
      }
    };

    fetchWorkouts();
  }, [apiUrl]);

  const groupWorkoutsByDate = (sets: Set[]) => {
    return groupBy(sets, (set) =>
      new Date(parseInt(set.timestamp || '0') * 1000).toLocaleDateString()
    );
  };

  const groupedSets = groupWorkoutsByDate(sets);

    const sortedDates = Object.keys(groupedSets).sort((a, b) => {
        const dateA = new Date(a).getTime();
        const dateB = new Date(b).getTime();
        return dateB - dateA; 
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
                      {groupedSets[date].map((set, setIndex) => (
                        <Paper
                          key={setIndex}
                          elevation={1}
                          sx={{ padding: '10px', marginBottom: '10px' }}
                        >
                          <Typography variant="h6">{set.exercise}</Typography>
                          <Typography>
                            Set #: {set.setNumber}, Reps: {set.reps}, Weight: {set.weight} lbs
                          </Typography>
                          <Typography>
                            Time: {new Date(parseInt(set.timestamp || '0') * 1000).toLocaleTimeString()}
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