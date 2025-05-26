import React, { useState } from 'react';
import WorkoutTracker from './WorkoutTracker';
import LastMonthWorkouts from './LastMonthWorkouts';
import WeightEntry from './WeightEntry';
import AnalysisView from './AnalysisView';
import ExerciseProgressPage from './ExerciseProgressPage';
import {
  AppBar,
  Toolbar,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Button,
  Container,
  ThemeProvider,
  Typography,
  Box,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import HomeIcon from '@mui/icons-material/Home';
import MenuIcon from '@mui/icons-material/Menu';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import TimelineIcon from '@mui/icons-material/Timeline';
import { Route, Routes, Link, BrowserRouter } from 'react-router-dom';
import { theme } from './style/theme';

const App: React.FC = () => {
  const themeMUI = useTheme();
  const isMobile = useMediaQuery(themeMUI.breakpoints.down('sm'));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleDrawerToggle = () => setDrawerOpen(!drawerOpen);
  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        <AppBar position="static" color="primary">
          <Toolbar>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              GainsIQ
            </Typography>
            {isMobile ? (
              <IconButton
                color="inherit"
                edge="end"
                onClick={handleDrawerToggle}
              >
                <MenuIcon />
              </IconButton>
            ) : (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button component={Link} to="/" color="inherit" startIcon={<HomeIcon />}>Home</Button>
                <Button component={Link} to="/last-month" color="inherit" startIcon={<CalendarMonthIcon />}>Last Month</Button>
                <Button component={Link} to="/weight-entry" color="inherit" startIcon={<MonitorWeightIcon />}>Weight Entry</Button>
                <Button component={Link} to="/analysis" color="inherit" startIcon={<AnalyticsIcon />}>Analysis</Button>
                <Button component={Link} to="/exercise-progress" color="inherit" startIcon={<TimelineIcon />}>Progress</Button>
              </Box>
            )}
          </Toolbar>
        </AppBar>
        {isMobile && (
          <Drawer
            anchor="left"
            open={drawerOpen}
            onClose={handleDrawerToggle}
          >
            <Box
              sx={{ width: 250 }}
              role="presentation"
              onClick={handleDrawerToggle}
              onKeyDown={handleDrawerToggle}
            >
              <List>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/">
                    <ListItemIcon><HomeIcon /></ListItemIcon>
                    <ListItemText primary="Home" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/last-month">
                    <ListItemIcon><CalendarMonthIcon /></ListItemIcon>
                    <ListItemText primary="Last Month" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/weight-entry">
                    <ListItemIcon><MonitorWeightIcon /></ListItemIcon>
                    <ListItemText primary="Weight Entry" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/analysis">
                    <ListItemIcon><AnalyticsIcon /></ListItemIcon>
                    <ListItemText primary="Analysis" />
                  </ListItemButton>
                </ListItem>
                <ListItem disablePadding>
                  <ListItemButton component={Link} to="/exercise-progress">
                    <ListItemIcon><TimelineIcon /></ListItemIcon>
                    <ListItemText primary="Progress" />
                  </ListItemButton>
                </ListItem>
              </List>
            </Box>
          </Drawer>
        )}
        <Container maxWidth="md" sx={{ padding: '40px 20px' }}>
          <Routes>
            <Route path="/" element={<WorkoutTracker />} />
            <Route path="/last-month" element={<LastMonthWorkouts />} />
            <Route path="/weight-entry" element={<WeightEntry />} />
            <Route path="/analysis" element={<AnalysisView />} />
            <Route path="/exercise-progress" element={<ExerciseProgressPage />} />
          </Routes>
        </Container>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;