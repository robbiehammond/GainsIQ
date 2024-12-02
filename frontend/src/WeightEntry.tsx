import React, { useState, useEffect } from 'react';
import {
  Container,
  Grid,
  TextField,
  Button,
  Typography,
  Paper,
  Snackbar,
  Alert,
  ThemeProvider,
} from '@mui/material';
import { amber, indigo } from '@mui/material/colors';
import { theme } from './style/theme';
import { WeightEntryData } from './models/WeightEntryData';
import { apiUrl } from './utils/ApiUtils';



const WeightEntry: React.FC = () => {
  const [weight, setWeight] = useState<string>('');
  const [weights, setWeights] = useState<WeightEntryData[]>([]);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchWeights = async () => {
      try {
        const response = await fetch(`${apiUrl}/weight`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch weights');
        }

        const data = await response.json();
        setWeights(data || []);
      } catch (error) {
        console.error('Error fetching weights:', error);
      }
    };

    fetchWeights();
  }, [apiUrl]);

  const handleLogWeight = async () => {
    if (!weight) return;

    try {
      const response = await fetch(`${apiUrl}/weight`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ weight: parseFloat(weight) }),
      });

      if (!response.ok) {
        throw new Error('Failed to log weight');
      }

      setConfirmationMessage(`Logged weight: ${weight} lbs`);
      setSnackbarOpen(true);
      setWeight('');

      const updatedWeights = await fetch(`${apiUrl}/weight`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json());
      setWeights(updatedWeights || []);
    } catch (error) {
      console.error('Error logging weight:', error);
    }
  };

  const handleDeleteMostRecentWeight = async () => {
    if (weights.length === 0) {
      setConfirmationMessage('No weights to delete.');
      setSnackbarOpen(true);
      return;
    }

    try {
      const response = await fetch(`${apiUrl}/weight`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete most recent weight');
      }

      setConfirmationMessage('Deleted the most recent weight entry.');
      setSnackbarOpen(true);

      // Refresh weight entries after deletion
      const updatedWeights = await fetch(`${apiUrl}/weight`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then((res) => res.json());
      setWeights(updatedWeights || []);
    } catch (error) {
      console.error('Error deleting most recent weight:', error);
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="sm" sx={{ padding: '40px 20px' }}>
        <Paper elevation={3} sx={{ padding: '20px', backgroundColor: theme.palette.background.default }}>
          <Typography variant="h4" align="center" gutterBottom>
            Weight Entry
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Enter your weight (lbs)"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleLogWeight}
                sx={{ backgroundColor: indigo[600], '&:hover': { backgroundColor: indigo[800] } }}
              >
                Log Weight
              </Button>
            </Grid>

            <Grid item xs={12}>
              <Button
                variant="contained"
                color="secondary"
                fullWidth
                onClick={handleDeleteMostRecentWeight}
                sx={{ backgroundColor: amber[600], '&:hover': { backgroundColor: amber[800] } }}
              >
                Delete Most Recent Weight
              </Button>
            </Grid>
          </Grid>

          <Snackbar
            open={snackbarOpen}
            autoHideDuration={4000}
            onClose={() => setSnackbarOpen(false)}
          >
            <Alert onClose={() => setSnackbarOpen(false)} severity="success">
              {confirmationMessage}
            </Alert>
          </Snackbar>

          <Typography variant="h5" gutterBottom sx={{ marginTop: '20px' }}>
            Logged Weights
          </Typography>
          {weights.length > 0 ? (
            weights.map((entry, index) => (
              <Paper
                key={index}
                elevation={1}
                sx={{ padding: '10px', marginBottom: '10px', backgroundColor: amber[50] }}
              >
                <Typography>
                  Weight: {entry.weight} lbs
                </Typography>
                <Typography>
                  Date: {new Date(parseInt(entry.timestamp) * 1000).toLocaleDateString()}
                </Typography>
              </Paper>
            ))
          ) : (
            <Typography>No weights logged yet.</Typography>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default WeightEntry;