import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Avatar,
  IconButton,
  Paper,
  Card,
  CardContent
} from '@mui/material';
import {
  Call,
  CallEnd,
  Mic,
  MicOff,
  VolumeUp
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Hotel, ConversationMessage } from '../types';
import io from 'socket.io-client';
import axios from 'axios';

interface CallSimulationProps {
  open: boolean;
  onClose: () => void;
  hotel: Hotel | null;
  phoneNumber?: string;
}

const CallSimulation: React.FC<CallSimulationProps> = ({ open, onClose, hotel, phoneNumber }) => {
  const [callState, setCallState] = useState<'calling' | 'connecting' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [conversations, setConversations] = useState<ConversationMessage[]>([]);
  const [muted, setMuted] = useState(false);
  const [isInitiatingCall, setIsInitiatingCall] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<any>(null);
  const callTimerRef = useRef<NodeJS.Timeout>();
  const conversationEndRef = useRef<HTMLDivElement>(null);
  const callInProgressRef = useRef(false);
  const hasInitiatedRef = useRef(false); // Track if call has been initiated for this session

  // Auto initiate call function
  const initiateCall = async () => {
    console.log('initiateCall called - checking conditions');
    console.log('callInProgressRef.current:', callInProgressRef.current);
    console.log('hasInitiatedRef.current:', hasInitiatedRef.current);
    
    if (callInProgressRef.current || hasInitiatedRef.current) {
      console.log('Call already in progress or initiated, skipping...');
      return;
    }
    
    console.log('Starting call initiation process...');
    hasInitiatedRef.current = true; // Mark as initiated
    setIsInitiatingCall(true);
    callInProgressRef.current = true;
    
    try {
      // Generate dynamic context based on the selected hotel
      const context = `You are Sarah, a friendly sales representative from Hotel Breakfast Supplies Co. 
You are calling ${hotel?.managerName} at ${hotel?.hotelName}. 

IMPORTANT CONTEXT:
- ${hotel?.managerName} just opened your email about ${hotel?.recommendedProduct}
- They previously purchased ${hotel?.lastPurchasedProduct} on ${hotel?.lastPurchaseDate}
- You're following up on your email recommendation for ${hotel?.recommendedProduct}
- Be natural and reference the email they just opened
- Focus on the benefits of ${hotel?.recommendedProduct} for their hotel
- Mention how it's perfect for ${hotel?.hotelName}'s breakfast service
- Keep responses conversational and brief (1-2 sentences)
- Try to understand their current needs and close the sale

Start by greeting them naturally and mentioning that you hope they had a chance to see your email.`;

      console.log('Making API call to initiate phone call...');
      const response = await axios.post('/api/make-call', {
        phoneNumber: phoneNumber || '(925) 325-2609',
        context: context
      });
      
      console.log('Call initiated successfully:', response.data);
      setIsInitiatingCall(false);
    } catch (error) {
      console.error('Error making call:', error);
      setCallState('ended');
      callInProgressRef.current = false;
      hasInitiatedRef.current = false;
      setIsInitiatingCall(false);
    }
  };

  // Auto answer simulation
  const simulateAnswerCall = () => {
    console.log('Simulating answer call...');
    // Directly transition to connecting state
    setCallState('connecting');
    setTimeout(() => {
      setCallState('connected');
    }, 2000);
  };

  // Initialize socket connection and start auto call
  useEffect(() => {
    if (open) {
      console.log('Modal opened - resetting states');
      // Reset all flags when modal opens
      setIsInitiatingCall(false);
      callInProgressRef.current = false;
      hasInitiatedRef.current = false;
      
      socketRef.current = io('http://localhost:8000');
      console.log('🔌 Attempting to connect to socket server at http://localhost:8000');

      socketRef.current.on('connect', () => {
        console.log('✅ Connected to server for call');
        console.log('Socket ID:', socketRef.current?.id);
        console.log('Socket connected:', socketRef.current?.connected);
      });

      socketRef.current.on('callStatus', (data: { callId: string; status: string; message?: string }) => {
        console.log('📞 Call status update:', data);
        if (data.status === 'connected') {
          console.log('🔗 Setting call state to connected');
          setCallState('connected');
        }
      });

      socketRef.current.on('disconnect', (reason: string) => {
        console.log('❌ Socket disconnected:', reason);
      });

      socketRef.current.on('error', (error: any) => {
        console.error('🚨 Socket error:', error);
      });

      socketRef.current.on('connect_error', (error: any) => {
        console.error('🔥 Socket connection error:', error);
      });

      // Add debugging for any message received
      socketRef.current.onAny((eventName: string, ...args: any[]) => {
        console.log(`🔔 Socket event received: ${eventName}`, args);
      });

      socketRef.current.on('conversationUpdate', (data: any) => {
        console.log('🎤 Conversation update received:', data);
        console.log('Data type:', typeof data);
        console.log('Data keys:', Object.keys(data || {}));
        console.log('Current conversations count:', conversations.length);
        
        if (!data) {
          console.error('❌ Conversation data is null or undefined');
          return;
        }
        
        const messageWithDate = {
          ...data,
          id: Date.now() + Math.random(),
          timestamp: new Date(data.timestamp || Date.now())
        };
        
        console.log('📝 Adding message to conversations:', messageWithDate);
        
        setConversations(prev => {
          const newConversations = [...prev, messageWithDate];
          console.log('📋 New conversations array:', newConversations);
          return newConversations;
        });
      });

      socketRef.current.on('callCompleted', () => {
        setCallState('ended');
        setTimeout(() => {
          onClose();
        }, 3000);
      });

      // Auto initiate call after 2 seconds - only once when modal opens
      const initiateTimer = setTimeout(() => {
        console.log('Timer triggered - checking if we should initiate call');
        initiateCall();
      }, 2000);

      // Auto answer after 5 seconds - only once when modal opens
      const answerTimer = setTimeout(() => {
        console.log('Timer triggered - simulating answer');
        simulateAnswerCall();
      }, 5000);

      return () => {
        console.log('Cleaning up timers and socket');
        if (socketRef.current) {
          socketRef.current.disconnect();
        }
        clearTimeout(initiateTimer);
        clearTimeout(answerTimer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]); // Include onClose to satisfy linter

  // Play ringtone
  useEffect(() => {
    if (open && callState === 'calling') {
      if (audioRef.current) {
        audioRef.current.loop = true;
        audioRef.current.play().catch(console.error);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [open, callState]);

  // Call timer
  useEffect(() => {
    if (callState === 'connecting' || callState === 'connected') { // Start timer on connecting
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState]);

  // Debug conversations state changes
  useEffect(() => {
    console.log('💬 Conversations state updated:', conversations);
    console.log('Conversations length:', conversations.length);
    conversations.forEach((conv, index) => {
      console.log(`Message ${index}:`, conv);
    });
  }, [conversations]);

  // Auto-scroll conversation
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversations]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    setCallState('ended');
    setTimeout(() => {
      onClose();
      // Reset state
      setCallDuration(0);
      setConversations([]);
      setCallState('calling');
      setIsInitiatingCall(false);
      callInProgressRef.current = false; // Reset processing flag
      hasInitiatedRef.current = false; // Reset initiated flag
    }, 1000);
  };

  if (!open) return null;

  return (
    <Dialog
      open={open}
      fullScreen
      PaperProps={{
        sx: {
          background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)',
          color: 'white'
        }
      }}
    >
      {/* Audio element for ringtone */}
      <audio ref={audioRef} preload="auto">
        <source src="/sounds/tone.mp3" type="audio/mpeg" />
      </audio>

      <Box sx={{ height: '100vh', display: 'flex' }}>
        {/* Left Side - iPhone Call Interface */}
        <Box sx={{ 
          width: '50%',
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center',
          alignItems: 'center',
          position: 'relative',
          background: 'linear-gradient(180deg, #000000 0%, #1a1a1a 100%)'
        }}>
          {/* iPhone Notch */}
          <Box sx={{
            position: 'absolute',
            top: 0,
            width: '150px',
            height: '30px',
            background: '#000',
            borderRadius: '0 0 15px 15px',
            zIndex: 10
          }} />

          <AnimatePresence mode="wait">
            {callState === 'calling' && (
              <motion.div
                key="calling"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{ textAlign: 'center', width: '100%', padding: '0 40px' }}
              >
                <Typography variant="body2" sx={{ color: '#ccc', mb: 1 }}>
                  Calling {hotel?.managerName}
                </Typography>
                
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Avatar sx={{ 
                    width: 120, 
                    height: 120, 
                    mx: 'auto', 
                    mb: 3,
                    background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
                    fontSize: '48px',
                    fontWeight: 'bold'
                  }}>
                    {hotel?.managerName?.split(' ').map(name => name[0]).join('') || 'MG'}
                  </Avatar>
                </motion.div>

                <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
                  {hotel?.managerName || 'Manager'}
                </Typography>
                <Typography variant="h6" sx={{ color: '#ccc', mb: 2 }}>
                  {hotel?.hotelName || 'Hotel'}
                </Typography>
                <Typography variant="body2" sx={{ color: '#999', mb: 2 }}>
                  {phoneNumber || '(555) 123-4567'}
                </Typography>

                {/* Call Initiation Status */}
                {isInitiatingCall && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ marginBottom: 24 }}
                  >
                    <Typography variant="body2" sx={{ 
                      color: '#10b981', 
                      fontWeight: 'bold',
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 1
                    }}>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        style={{ display: 'flex' }}
                      >
                        📞
                      </motion.div>
                      Initiating call to {hotel?.managerName}...
                    </Typography>
                    <motion.div
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Typography variant="caption" sx={{ color: '#60a5fa', fontSize: '12px' }}>
                        Your phone will ring shortly
                      </Typography>
                    </motion.div>
                  </motion.div>
                )}

                {/* Simple Calling Animation */}
                <Box sx={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  mb: 4
                }}>
                  <motion.div
                    animate={{ 
                      scale: [1, 1.2, 1],
                      opacity: [0.7, 1, 0.7]
                    }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Box sx={{
                      width: '80px',
                      height: '80px',
                      background: 'linear-gradient(45deg, #3b82f6, #1d4ed8)',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 30px rgba(59, 130, 246, 0.5)',
                      mb: 2
                    }}>
                      <Call sx={{ 
                        color: 'white', 
                        fontSize: '36px'
                      }} />
                    </Box>
                  </motion.div>
                  
                  <Typography variant="body1" sx={{ 
                    color: '#60a5fa',
                    fontSize: '16px',
                    fontWeight: 'medium'
                  }}>
                    Calling...
                  </Typography>
                  
                  {/* Animated dots */}
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ 
                          scale: [1, 1.5, 1],
                          opacity: [0.3, 1, 0.3]
                        }}
                        transition={{ 
                          duration: 1.5, 
                          repeat: Infinity,
                          delay: i * 0.2
                        }}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          backgroundColor: '#60a5fa'
                        }}
                      />
                    ))}
                  </Box>
                </Box>

                <IconButton
                  onClick={handleEndCall}
                  sx={{
                    background: 'linear-gradient(45deg, #ef4444, #dc2626)',
                    color: 'white',
                    width: 60,
                    height: 60,
                    '&:hover': {
                      background: 'linear-gradient(45deg, #dc2626, #b91c1c)',
                    }
                  }}
                >
                  <CallEnd sx={{ fontSize: '28px' }} />
                </IconButton>
              </motion.div>
            )}

            {callState === 'connecting' && (
              <motion.div
                key="connecting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center' }}
              >
                <Avatar sx={{ 
                  width: 120, 
                  height: 120, 
                  mx: 'auto', 
                  mb: 3,
                  background: 'linear-gradient(45deg, #10b981, #059669)',
                  fontSize: '48px',
                  fontWeight: 'bold'
                }}>
                  HS
                </Avatar>
                
                <Typography variant="h5" sx={{ color: '#10b981', mb: 2 }}>
                  Connected to {hotel?.managerName}
                </Typography>
                <Typography variant="h6" sx={{ color: '#ccc', mb: 4 }}>
                  {formatTime(callDuration)}
                </Typography>
                
                <IconButton
                  onClick={handleEndCall}
                  sx={{
                    background: 'linear-gradient(45deg, #ef4444, #dc2626)',
                    color: 'white',
                    width: 60,
                    height: 60,
                    '&:hover': {
                      background: 'linear-gradient(45deg, #dc2626, #b91c1c)',
                    }
                  }}
                >
                  <CallEnd sx={{ fontSize: '28px' }} />
                </IconButton>
              </motion.div>
            )}

            {callState === 'connected' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ textAlign: 'center', width: '100%' }}
              >
                <Avatar sx={{ 
                  width: 100, 
                  height: 100, 
                  mx: 'auto', 
                  mb: 2,
                  background: 'linear-gradient(45deg, #10b981, #059669)',
                  fontSize: '40px',
                  fontWeight: 'bold'
                }}>
                  HS
                </Avatar>
                
                <Typography variant="h5" fontWeight="bold" sx={{ mb: 1 }}>
                  {hotel?.managerName}
                </Typography>
                <Typography variant="body1" sx={{ color: '#10b981', mb: 1 }}>
                  Connected
                </Typography>
                <Typography variant="h6" sx={{ color: '#ccc', mb: 4 }}>
                  {formatTime(callDuration)}
                </Typography>

                {/* Call Controls */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 3, mb: 4 }}>
                  <IconButton
                    onClick={() => setMuted(!muted)}
                    sx={{
                      background: muted ? '#ef4444' : 'rgba(255,255,255,0.1)',
                      color: 'white',
                      width: 50,
                      height: 50
                    }}
                  >
                    {muted ? <MicOff /> : <Mic />}
                  </IconButton>
                  
                  <IconButton
                    sx={{
                      background: 'rgba(255,255,255,0.1)',
                      color: 'white',
                      width: 50,
                      height: 50
                    }}
                  >
                    <VolumeUp />
                  </IconButton>
                </Box>

                <IconButton
                  onClick={handleEndCall}
                  sx={{
                    background: 'linear-gradient(45deg, #ef4444, #dc2626)',
                    color: 'white',
                    width: 60,
                    height: 60,
                    '&:hover': {
                      background: 'linear-gradient(45deg, #dc2626, #b91c1c)',
                    }
                  }}
                >
                  <CallEnd sx={{ fontSize: '28px' }} />
                </IconButton>
              </motion.div>
            )}

            {callState === 'ended' && (
              <motion.div
                key="ended"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{ textAlign: 'center' }}
              >
                <Typography variant="h5" sx={{ color: '#ef4444', mb: 2 }}>
                  Call Ended
                </Typography>
                <Typography variant="body1" sx={{ color: '#ccc' }}>
                  Duration: {formatTime(callDuration)}
                </Typography>
              </motion.div>
            )}
          </AnimatePresence>
        </Box>

        {/* Right Side - Conversation Window */}
        <Box sx={{ width: '50%' }}>
          <Paper sx={{ 
            height: '100vh', 
            background: 'white',
            color: 'black',
            borderRadius: 0,
            display: 'flex',
            flexDirection: 'column'
          }}>
            {/* Header */}
            <Box sx={{ 
              p: 3, 
              borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)'
            }}>
              <Typography variant="h6" fontWeight="bold" color="primary">
                Live Conversation - {hotel?.hotelName}
              </Typography>
              {callState === 'connected' && (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <Box sx={{ 
                    width: 8, 
                    height: 8, 
                    background: '#ef4444', 
                    borderRadius: '50%',
                    mr: 1,
                    animation: 'pulse 2s infinite'
                  }} />
                  <Typography variant="body2" color="text.secondary">
                    Recording live • {formatTime(callDuration)}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Conversation Area */}
            <Box sx={{ 
              flex: 1, 
              overflowY: 'auto', 
              p: 3,
              background: '#f8fafc'
            }}>
              {(() => {
                console.log('🎨 Rendering conversation area');
                console.log('Current call state:', callState);
                console.log('Conversations array length:', conversations.length);
                console.log('Conversations data:', conversations);
                
                if (conversations.length === 0) {
                  console.log('📭 No conversations - showing waiting message');
                  return (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%',
                      color: 'text.secondary'
                    }}>
                      <Typography variant="body1" textAlign="center">
                        {callState === 'calling' 
                          ? 'Calling...'
                          : callState === 'connecting'
                          ? 'Connecting...'
                          : 'Waiting for conversation to begin...'}
                      </Typography>
                    </Box>
                  );
                } else {
                  console.log('💬 Rendering conversations:', conversations.length, 'messages');
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {conversations.map((message, index) => {
                        console.log(`Rendering message ${index}:`, message);
                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Card sx={{
                              alignSelf: message.type === 'ai_response' ? 'flex-start' : 'flex-end',
                              maxWidth: '80%',
                              background: message.type === 'ai_response' 
                                ? 'linear-gradient(135deg, #e0f2fe 0%, #b3e5fc 100%)'
                                : 'linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%)'
                            }}>
                              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                                <Typography variant="subtitle2" color="primary" sx={{ mb: 1 }}>
                                  {message.type === 'ai_response' ? '🤖 AI Agent' : '👤 Customer'}
                                </Typography>
                                <Typography variant="body2">
                                  {message.content}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                                  {message.timestamp.toLocaleTimeString()}
                                </Typography>
                              </CardContent>
                            </Card>
                          </motion.div>
                        );
                      })}
                      <div ref={conversationEndRef} />
                    </Box>
                  );
                }
              })()}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Dialog>
  );
};

export default CallSimulation;
