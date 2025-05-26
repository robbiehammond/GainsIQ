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
import { apiUrl, client } from './utils/ApiUtils';

// Recharts imports
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import dayjs from 'dayjs';

const WeightEntry: React.FC = () => {
  const [weight, setWeight] = useState<string>('');
  const [weights, setWeights] = useState<WeightEntryData[]>([]);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchWeights = async () => {
      try {
        const data = await client.getWeights();
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
      await client.logWeight(parseFloat(weight));
      setConfirmationMessage(`Logged weight: ${weight} lbs`);
      setSnackbarOpen(true);
      setWeight('');

      const updatedWeights = await client.getWeights();
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
      await client.deleteMostRecentWeight();
      setConfirmationMessage('Deleted the most recent weight entry.');
      setSnackbarOpen(true);

      const updatedWeights = await client.getWeights();
      setWeights(updatedWeights || []);
    } catch (error) {
      console.error('Error deleting most recent weight:', error);
    }
  };

  // Sort weights by timestamp in ascending order
  const sortedWeights = [...weights].sort(
    (a, b) => parseInt(a.timestamp) - parseInt(b.timestamp)
  );

  /**
   * Prepare the data for Recharts:
   *  - Use "time" as a numeric value for the x-axis.
   *  - Multiply by 1000 because data is in Unix seconds, whereas JS timestamps are milliseconds.
   */
  const chartData = sortedWeights.map((entry) => ({
    time: parseInt(entry.timestamp) * 1000,
    weight: entry.weight,
  }));

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

          {/* Time-based Chart */}
          <Typography variant="h5" gutterBottom sx={{ marginTop: '20px' }}>
            Weight Over Time
          </Typography>
          {chartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(timestamp) =>
                      dayjs(timestamp).format('MMM D')
                    }
                  />
                  <YAxis
                    label={{ value: 'lbs', angle: -90, position: 'insideLeft' }}
                    domain={['dataMin - 5', 'dataMax + 5']}
                  />
                  <Tooltip
                    labelFormatter={(timestamp) =>
                      dayjs(timestamp).format('MMM D, YYYY')
                    }
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#8884d8"
                    activeDot={{ r: 8 }}
                    name="Weight (lbs)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Typography>No weights logged yet.</Typography>
          )}

          {/* Keep listing the individual entries below, if desired */}
          <Typography variant="h5" gutterBottom sx={{ marginTop: '20px' }}>
            Logged Weights
          </Typography>
          {weights.length > 0 ? (
            weights.map((entry, index) => (
              <Paper
                key={index}
                elevation={1}
                sx={{
                  padding: '10px',
                  marginBottom: '10px',
                  backgroundColor: amber[50],
                  transition: 'box-shadow 0.3s',
                  '&:hover': { boxShadow: 6 },
                }}
              >
                <Typography>Weight: {entry.weight} lbs</Typography>
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
