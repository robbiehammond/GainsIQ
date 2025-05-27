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
  const [weightTrend, setWeightTrend] = useState<{ date: string; slope: number } | null>(null);
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

    const fetchWeightTrend = async () => {
      try {
        const trend = await client.getWeightTrend();
        setWeightTrend(trend);
      } catch (error) {
        console.error('Error fetching weight trend:', error);
        setWeightTrend(null);
      }
    };

    fetchWeights();
    fetchWeightTrend();
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
      
      try {
        const trend = await client.getWeightTrend();
        setWeightTrend(trend);
      } catch (trendError) {
        console.error('Error fetching updated weight trend:', trendError);
        setWeightTrend(null);
      }
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
      
      try {
        const trend = await client.getWeightTrend();
        setWeightTrend(trend);
      } catch (trendError) {
        console.error('Error fetching updated weight trend:', trendError);
        setWeightTrend(null);
      }
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

  // Calculate trendline data for the chart
  const trendlineData = React.useMemo(() => {
    if (!weightTrend || chartData.length < 2) return [];
    
    // Get the most recent weight data point
    const lastPoint = chartData[chartData.length - 1];
    
    // Calculate the slope in pounds per millisecond (weightTrend.slope is pounds per day)
    const slopePerMs = weightTrend.slope / (24 * 60 * 60 * 1000);
    
    // Create trendline from most recent data point to 1 month in the future
    const trendStart = lastPoint.time; // Start from the most recent data point
    const oneMonthFromNow = Date.now() + (30 * 24 * 60 * 60 * 1000); // 1 month in the future
    
    // Calculate y-intercept using the most recent point
    const yIntercept = lastPoint.weight - (slopePerMs * lastPoint.time);
    
    // Create multiple points for a smooth line (only forward in time)
    const trendPoints = [];
    const timeStep = (oneMonthFromNow - trendStart) / 10; // 10 points for smooth line
    
    for (let i = 0; i <= 10; i++) {
      const time = trendStart + (timeStep * i);
      trendPoints.push({
        time: time,
        trendline: yIntercept + (slopePerMs * time),
      });
    }
    
    console.log('Trendline data points:', trendPoints);
    return trendPoints;
  }, [chartData, weightTrend]);

  // Merge chart data with trendline data
  const combinedChartData = React.useMemo(() => {
    if (trendlineData.length === 0) return chartData;
    
    // Create a map for quick lookup
    const dataMap = new Map();
    
    // Add weight data
    chartData.forEach(point => {
      dataMap.set(point.time, { ...point });
    });
    
    // Add trendline data
    trendlineData.forEach(point => {
      if (dataMap.has(point.time)) {
        dataMap.set(point.time, { ...dataMap.get(point.time), trendline: point.trendline });
      } else {
        dataMap.set(point.time, point);
      }
    });
    
    // Convert back to array and sort
    const result = Array.from(dataMap.values()).sort((a, b) => a.time - b.time);
    console.log('Combined chart data:', result);
    return result;
  }, [chartData, trendlineData]);

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

          {/* Weight Trend Display */}
          {weightTrend && (
            <Paper
              elevation={2}
              sx={{
                padding: '15px',
                marginTop: '20px',
                backgroundColor: indigo[50],
                borderLeft: `4px solid ${indigo[600]}`,
              }}
            >
              <Typography variant="h6" gutterBottom>
                Weight Trend (Last 2 Weeks)
              </Typography>
              <Typography variant="body1">
                <strong>
                  {weightTrend.slope >= 0 ? '+' : ''}{(weightTrend.slope * 7).toFixed(2)} pounds/week
                </strong>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Based on data from {weightTrend.date}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Trendline extends 1 month into the future
              </Typography>
            </Paper>
          )}

          {/* Time-based Chart */}
          <Typography variant="h5" gutterBottom sx={{ marginTop: '20px' }}>
            Weight Over Time
          </Typography>
          {combinedChartData.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <LineChart data={combinedChartData}>
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
                    domain={[
                      (dataMin: number) => {
                        const weightValues = chartData.map(d => d.weight);
                        return Math.min(...weightValues) - 5;
                      },
                      (dataMax: number) => {
                        const weightValues = chartData.map(d => d.weight);
                        return Math.max(...weightValues) + 5;
                      }
                    ]}
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
                    strokeWidth={2}
                  />
                  {weightTrend && (
                    <Line
                      type="linear"
                      dataKey="trendline"
                      stroke="#ff7300"
                      strokeDasharray="8 4"
                      name={`Trend Line (${weightTrend.slope >= 0 ? '+' : ''}${(weightTrend.slope * 7).toFixed(2)} lbs/week)`}
                      dot={false}
                      strokeWidth={3}
                      connectNulls={false}
                    />
                  )}
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
