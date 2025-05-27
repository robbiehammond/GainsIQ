import { createTheme } from '@mui/material';
import { grey } from '@mui/material/colors';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#2c2c2c', // Dark gray
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6c6c6c', // Medium gray
      contrastText: '#ffffff',
    },
    background: {
      default: '#fafafa', // Very light gray
      paper: '#ffffff',
    },
    text: {
      primary: '#2c2c2c',
      secondary: '#6c6c6c',
    },
  },
  shape: {
    borderRadius: 12,
  },
  typography: {
    h4: {
      fontWeight: 600,
      color: '#2c2c2c',
      letterSpacing: '-0.5px',
    },
    h5: {
      color: '#2c2c2c',
      fontWeight: 500,
    },
    h6: {
      color: '#2c2c2c',
      fontWeight: 500,
    },
  },
});