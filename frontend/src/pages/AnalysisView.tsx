import React, { useEffect, useState } from 'react';
import { Container, Typography, Paper } from '@mui/material';
import { client } from '../utils/ApiUtils';

const AnalysisView: React.FC = () => {
  const [analysis, setAnalysis] = useState<any>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await client.fetchAnalysis();
        setAnalysis(response);
      } catch (error) {
        console.error('Error fetching analysis:', error);
      }
    };

    fetchAnalysis();
  }, []);

  return (
    <Container sx={{ padding: '40px 20px' }}>
      <Paper elevation={3} sx={{ padding: '20px' }}>
        <Typography variant="h4" gutterBottom>
          Most Recent Analysis
        </Typography>

        {analysis ? (
          <Typography variant="body1" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(analysis, null, 2)}
          </Typography>
        ) : (
          <Typography>Loading analysis...</Typography>
        )}
      </Paper>
    </Container>
  );
};

export default AnalysisView;