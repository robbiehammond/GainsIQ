import React from 'react';
import { Container, ThemeProvider } from '@mui/material';
import Navigation from './Navigation';
import { theme } from '../../style/theme';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <ThemeProvider theme={theme}>
      <Navigation />
      <Container 
        maxWidth="lg" 
        sx={{ 
          padding: '40px 20px', 
          backgroundColor: '#fafafa', 
          minHeight: '100vh' 
        }}
      >
        {children}
      </Container>
    </ThemeProvider>
  );
};

export default Layout;