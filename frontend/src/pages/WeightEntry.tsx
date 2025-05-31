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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { theme } from '../style/theme';
import { WeightEntryData } from '../types';
import { apiUrl, client } from '../utils/ApiUtils';

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

type TimeRange = '1month' | '3months' | '6months' | '1year' | 'all';

const WeightEntry: React.FC = () => {
  const [weight, setWeight] = useState<string>('');
  const [weights, setWeights] = useState<WeightEntryData[]>([]);
  const [weightTrend, setWeightTrend] = useState<{ date: string; slope: number } | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string>('');
  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('6months');

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

  // Filter weights based on selected time range
  const getTimeRangeInMs = (range: TimeRange): number => {
    const now = Date.now();
    switch (range) {
      case '1month':
        return now - (30 * 24 * 60 * 60 * 1000);
      case '3months':
        return now - (90 * 24 * 60 * 60 * 1000);
      case '6months':
        return now - (180 * 24 * 60 * 60 * 1000);
      case '1year':
        return now - (365 * 24 * 60 * 60 * 1000);
      case 'all':
        return 0;
      default:
        return now - (180 * 24 * 60 * 60 * 1000); // Default to 6 months
    }
  };

  const filteredWeights = sortedWeights.filter(entry => {
    const entryTime = parseInt(entry.timestamp) * 1000;
    return entryTime >= getTimeRangeInMs(timeRange);
  });

  /**
   * Prepare the data for Recharts:
   *  - Use "time" as a numeric value for the x-axis.
   *  - Multiply by 1000 because data is in Unix seconds, whereas JS timestamps are milliseconds.
   */
  const chartData = filteredWeights.map((entry) => ({
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
    return result;
  }, [chartData, trendlineData]);

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
        <Paper elevation={0} sx={{ 
          padding: '32px', 
          backgroundColor: '#ffffff',
          border: `1px solid ${grey[200]}`,
          borderRadius: 3
        }}>
          <Typography variant="h4" align="center" gutterBottom sx={{ mb: 4 }}>
            Weight Tracker
          </Typography>

          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Enter your weight (lbs)"
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: grey[50],
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: grey[400],
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: grey[600],
                  }
                }}
              />
            </Grid>

            <Grid item xs={6}>
              <Button
                variant="contained"
                color="primary"
                fullWidth
                onClick={handleLogWeight}
                sx={{ 
                  fontWeight: 500,
                  textTransform: 'none',
                  boxShadow: 'none',
                  '&:hover': { 
                    boxShadow: '0 2px 8px rgba(0,0,0,0.15)' 
                  }
                }}
              >
                Log Weight
              </Button>
            </Grid>

            <Grid item xs={6}>
              <Button
                variant="outlined"
                color="secondary"
                fullWidth
                onClick={handleDeleteMostRecentWeight}
                sx={{ 
                  fontWeight: 500,
                  textTransform: 'none',
                  borderColor: grey[300],
                  color: grey[600],
                  '&:hover': { 
                    borderColor: grey[400],
                    backgroundColor: grey[50]
                  }
                }}
              >
                Delete Recent
              </Button>
            </Grid>

            <Grid item xs={12}>
              <FormControl 
                fullWidth 
                sx={{ 
                  mt: 2,
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: grey[50],
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: grey[400],
                    },
                  }
                }}
              >
                <InputLabel id="time-range-label" sx={{ color: grey[600] }}>Chart Time Range</InputLabel>
                <Select
                  labelId="time-range-label"
                  value={timeRange}
                  label="Chart Time Range"
                  onChange={(e: SelectChangeEvent) => setTimeRange(e.target.value as TimeRange)}
                  sx={{ color: '#2c2c2c' }}
                >
                  <MenuItem value="1month">Last Month</MenuItem>
                  <MenuItem value="3months">Last 3 Months</MenuItem>
                  <MenuItem value="6months">Last 6 Months</MenuItem>
                  <MenuItem value="1year">Last Year</MenuItem>
                  <MenuItem value="all">All Time</MenuItem>
                </Select>
              </FormControl>
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
              elevation={0}
              sx={{
                padding: '20px',
                marginTop: '24px',
                backgroundColor: grey[50],
                border: `1px solid ${grey[200]}`,
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Weight Trend (Last 2 Weeks)
              </Typography>
              <Typography variant="h5" sx={{ color: '#2c2c2c', fontWeight: 600, mb: 1 }}>
                {weightTrend.slope >= 0 ? '+' : ''}{(weightTrend.slope * 7).toFixed(2)} lbs/week
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                Projection extends 1 month ahead
              </Typography>
            </Paper>
          )}

          {/* Time-based Chart */}
          <Typography variant="h5" gutterBottom sx={{ marginTop: '20px' }}>
            Weight Over Time
          </Typography>
          {combinedChartData.length > 0 ? (
            <div style={{ width: '100%', height: 400 }}>
              <ResponsiveContainer>
                <LineChart data={combinedChartData}>
                  <CartesianGrid strokeDasharray="1 1" stroke={grey[300]} strokeOpacity={0.3} />
                  <XAxis
                    dataKey="time"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(timestamp) =>
                      dayjs(timestamp).format('MMM D')
                    }
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: grey[600] }}
                  />
                  <YAxis
                    label={{ value: 'lbs', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: grey[600] } }}
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
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: grey[600] }}
                  />
                  <Tooltip
                    labelFormatter={(timestamp) =>
                      dayjs(timestamp).format('MMM D, YYYY')
                    }
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: `1px solid ${grey[300]}`,
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#2c2c2c"
                    activeDot={{ r: 6, fill: '#2c2c2c', strokeWidth: 0 }}
                    name="Weight (lbs)"
                    strokeWidth={2.5}
                    dot={{ fill: '#2c2c2c', strokeWidth: 0, r: 3 }}
                  />
                  {weightTrend && (
                    <Line
                      type="linear"
                      dataKey="trendline"
                      stroke="#6c6c6c"
                      strokeDasharray="6 6"
                      name={`Trend (${weightTrend.slope >= 0 ? '+' : ''}${(weightTrend.slope * 7).toFixed(2)} lbs/week)`}
                      dot={false}
                      strokeWidth={2}
                      connectNulls={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Typography>No weights logged yet.</Typography>
          )}

          {/* Recent Weight Entries */}
          <Typography variant="h6" sx={{ marginTop: '32px', marginBottom: '16px', color: '#2c2c2c' }}>
            Recent Entries
          </Typography>
          {weights.length > 0 ? (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {weights.slice(-5).reverse().map((entry, index) => (
                <Paper
                  key={index}
                  elevation={0}
                  sx={{
                    padding: '12px 16px',
                    marginBottom: '8px',
                    backgroundColor: '#ffffff',
                    border: `1px solid ${grey[200]}`,
                    borderRadius: 1,
                    transition: 'border-color 0.2s',
                    '&:hover': { 
                      borderColor: grey[300],
                    },
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body1" sx={{ fontWeight: 500, color: '#2c2c2c' }}>
                      {entry.weight} lbs
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                      {new Date(parseInt(entry.timestamp) * 1000).toLocaleDateString()}
                    </Typography>
                  </div>
                </Paper>
              ))}
            </div>
          ) : (
            <Typography color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No weights logged yet.
            </Typography>
          )}
        </Paper>
      </Container>
    </ThemeProvider>
  );
};

export default WeightEntry;
