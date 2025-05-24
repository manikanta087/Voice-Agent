import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Container
} from '@mui/material';
import { motion } from 'framer-motion';
import { Hotel, DashboardMetrics } from '../types';
import EmailDraftModal from './EmailDraftModal';

const sampleHotels: Hotel[] = [
  {
    id: '1',
    hotelName: 'Grand Plaza',
    managerName: 'John Doe',
    lastPurchasedProduct: 'Asiago Cheese Bagel (Pack of 4)',
    recommendedProduct: 'Blueberry Bagel (Seasonal)',
    lastPurchaseDate: '2023-05-12',
    phone: '(925) 325-2609',
    email: 'john.doe@grandplaza.com'
  },
  {
    id: '2',
    hotelName: 'Sunrise Inn',
    managerName: 'Sarah Lee',
    lastPurchasedProduct: 'Vanilla Shower Gel (500ml)',
    recommendedProduct: 'Lavender Shower Gel (500ml)',
    lastPurchaseDate: '2023-05-13',
    phone: '(925) 325-2609',
    email: 'sarah.lee@sunriseinn.com'
  },
  {
    id: '3',
    hotelName: 'Ocean Breeze',
    managerName: 'Michael Tan',
    lastPurchasedProduct: 'Greek Yogurt (500g)',
    recommendedProduct: 'Mango Greek Yogurt (Seasonal)',
    lastPurchaseDate: '2023-05-14',
    phone: '(925) 325-2609',
    email: 'michael.tan@oceanbreeze.com'
  },
  {
    id: '4',
    hotelName: 'Seaside Suites',
    managerName: 'Emma Green',
    lastPurchasedProduct: 'Classic Croissant (Pack of 6)',
    recommendedProduct: 'Almond Croissant (Pack of 6)',
    lastPurchaseDate: '2023-05-10',
    phone: '(925) 325-2609',
    email: 'emma.green@seasidesuites.com'
  },
  {
    id: '5',
    hotelName: 'City Comforts',
    managerName: 'David Wilson',
    lastPurchasedProduct: 'Strawberry Jam (250g)',
    recommendedProduct: 'Raspberry Jam (250g)',
    lastPurchaseDate: '2023-05-05',
    phone: '(925) 325-2609',
    email: 'david.wilson@citycomforts.com'
  }
];

const Dashboard: React.FC = () => {
  const [metrics] = useState<DashboardMetrics>({
    leadsGenerated: 247,
    leadsContacted: 156,
    leadsClosed: 89
  });

  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null);
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const handleOutreach = (hotel: Hotel) => {
    setSelectedHotel(hotel);
    setEmailModalOpen(true);
  };

  const MetricCard = ({ title, value, gradient }: { title: string; value: number; gradient: string }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card 
        sx={{ 
          background: gradient,
          color: 'white',
          height: '140px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography variant="h3" component="div" fontWeight="bold">
            {value}
          </Typography>
          <Typography variant="h6" component="div" sx={{ opacity: 0.9 }}>
            {title}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        <Typography 
          variant="h3" 
          component="h1" 
          gutterBottom 
          sx={{ 
            textAlign: 'center', 
            background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            fontWeight: 'bold',
            mb: 4
          }}
        >
          Hotel Supply Sales Agent
        </Typography>

        {/* Metrics Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 3, mb: 4 }}>
          <MetricCard 
            title="Leads Generated" 
            value={metrics.leadsGenerated}
            gradient="linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)"
          />
          <MetricCard 
            title="Leads Contacted" 
            value={metrics.leadsContacted}
            gradient="linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)"
          />
          <MetricCard 
            title="Leads Closed" 
            value={metrics.leadsClosed}
            gradient="linear-gradient(135deg, #10b981 0%, #059669 100%)"
          />
        </Box>

        {/* Hotel Leads Table */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        >
          <Paper sx={{ mb: 4, borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 3, background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
              <Typography variant="h5" component="h2" fontWeight="bold" color="primary">
                Hotel Leads Management
              </Typography>
            </Box>
            
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f1f5f9' }}>
                    <TableCell><strong>Hotel Name</strong></TableCell>
                    <TableCell><strong>Manager Name</strong></TableCell>
                    <TableCell><strong>Last Purchased Product</strong></TableCell>
                    <TableCell><strong>Recommended Product</strong></TableCell>
                    <TableCell><strong>Last Purchase Date</strong></TableCell>
                    <TableCell align="center"><strong>Action</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sampleHotels.map((hotel, index) => (
                    <TableRow
                      key={hotel.id}
                      component={motion.tr}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: index * 0.1 }}
                      sx={{ '&:hover': { backgroundColor: '#f8fafc' } }}
                    >
                      <TableCell>{hotel.hotelName}</TableCell>
                      <TableCell>{hotel.managerName}</TableCell>
                      <TableCell>{hotel.lastPurchasedProduct}</TableCell>
                      <TableCell>
                        <Typography color="primary" fontWeight="medium">
                          {hotel.recommendedProduct}
                        </Typography>
                      </TableCell>
                      <TableCell>{hotel.lastPurchaseDate}</TableCell>
                      <TableCell align="center">
                        <Button
                          variant="contained"
                          onClick={() => handleOutreach(hotel)}
                          sx={{
                            background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
                            '&:hover': {
                              background: 'linear-gradient(45deg, #1d4ed8, #1e40af)',
                            },
                            fontWeight: 'bold',
                            px: 3
                          }}
                        >
                          OUTREACH
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </motion.div>
      </motion.div>

      {/* Email Draft Modal */}
      <EmailDraftModal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        hotel={selectedHotel}
      />
    </Container>
  );
};

export default Dashboard; 