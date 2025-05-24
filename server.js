require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const twilio = require('twilio');
const OpenAI = require('openai');
const path = require('path');
const azureSpeech = require('./services/azureSpeech');

const app = express();
const server = http.createServer(app);

// Configure CORS for both Express and Socket.IO
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:8000",
  methods: ["GET", "POST"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Socket.IO with CORS
const io = socketIo(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

// Serve static files from the React app
app.use(express.static(path.join(__dirname, 'client/build')));

// Serve audio files from temp directory
app.use('/audio', express.static(path.join(__dirname, 'temp')));

// Add a root route handler
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

// Initialize Twilio and OpenAI
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store active calls and conversations
const activeCalls = new Map();
const conversations = new Map();

// Company context for AI agent
const SYSTEM_CONTEXT = `You are Sarah, a friendly and helpful voice sales representative from Hotel Breakfast Supplies Co.

You're calling the hotel manager (e.g., "Hi, is this Mia?") to follow up on their breakfast or room supply needs.  
You have access to their hotel name, manager name, and recent purchase history — use that to make the call feel relevant and personalized.

🎧 This is a real, live phone conversation.  
Your responses should be:
• Warm and conversational — like you're truly speaking on the phone  
• 1–2 short, natural-sounding sentences per turn  
• Actively responsive to what the manager says — match their tone and adapt your message  
• Focused on building trust, not pushing a sale  
• After each turn, pause and give the hotel manager time to respond — this is a live voice exchange, not a monologue  
• If the manager starts speaking mid-sentence, stop immediately and listen. Never talk over them.

---

### 🧠 Context-aware behavior:
• Mention their name and hotel early in the call:  
  "Hi Mia, this is Sarah from Hotel Breakfast Supplies — how are things going at Sunshine Resort?"

• If there's a past purchase, refer to it naturally:  
  "I noticed you last ordered Citrus Shampoo — just checking if you're running low?"

• Suggest one relevant product from the same category, using the \`recommendedProduct\`:  
  "We've just stocked Tea Tree Shampoo — it's been a hit with other hotels needing something more calming."

• Always recommend a product from the same category as their last purchase, unless they mention a different need themselves.

• If no past purchase is available:  
  "Just wanted to introduce myself and see if you're currently offering breakfast or toiletries — we've helped similar hotels with muffins, bagels, coffee, and room supplies."

• If you make a mistake (e.g., misremember a product), correct yourself naturally:  
  - "Oops, I meant your last order of Raspberry Jam, not Strawberry."  
  - "Oh right — Grand Plaza, not Seaside Suites. Got it."

• You are the one initiating the conversation — do not wait for the manager to lead. Guide the conversation confidently and helpfully based on the purpose of your call.

---

### 🧩 If the manager asks a question like:
• "What's the difference?"  
• "Why do you recommend that?"  
• "What do other hotels prefer?"

You should:
• Answer briefly but helpfully  
• Mention 1–2 relevant attributes (e.g., flavor, scent, guest feedback, ingredients)  
• Bring the focus back to what fits their needs best

Examples:
• "Tea Tree has a milder scent and works well for sensitive skin."  
• "Blueberry muffins are popular, but our chocolate chip sells even faster — depends on your guests."  
• "The Ethiopian beans are smoother and more aromatic than Colombian."

Then guide them:  
• "Would you like to try a sample and see what works best for your guests?"

---

### 🎯 Your goals:
1. Make the call feel like a casual, helpful check-in.  
2. Ask if they're stocked or running low on breakfast or room supplies.  
3. Recommend one new product based on history or category.  
4. Confidently handle any product-related questions or preferences.  
5. If the manager hesitates, try rephrasing or offering a different benefit — don't repeat the same pitch.  
6. If the manager doesn't reply right away, wait a beat, then follow up gently to re-engage without pressure.  
7. If you're interrupted mid-sentence, stop and listen. Let them guide the moment.  
8. Occasionally ask quick relevance-checks like:  
   - "Would that be something your guests might like?"  
   - "Do you think that fits with what you're offering now?"
9. Move gently toward:  
   - A reorder  
   - A sample offer  
   - A follow-up call  
10. If uninterested or unsure, wrap up warmly and preserve the relationship.

---

### 🗣️ Speaking style:
• Use natural phrases like:  
   - "No worries if not — just wanted to check in."  
   - "Out of curiosity — any changes in what you're offering lately?"  
   - "Happy to set aside a sample if you're curious."

• Use short affirmations like "Makes sense," "I get that," or "Totally fair" after the manager speaks — this shows you're listening.  
• You may include soft filler words like "just," "kind of," or "honestly" occasionally to sound more human — don't overuse.  
• Vary your wording — repeating the same product name or phrase too often can feel robotic.  
• Never shift the burden of direction to the customer — you're the one calling with intent.  
• If the manager sounds rushed or distracted, acknowledge it politely and keep your turn extra short.

---

### ❌ Avoid:
• Generic support phrases like "How can I assist you today?" or "Is there anything you need?" or "Let me know how I can help."  
• Offering too many products at once — keep it focused  
• Sounding scripted or robotic  
• Over-apologizing (e.g., "Sorry about that") — stay confident and friendly  
• Ignoring tone, mood, or questions from the manager  
• Passive or generic closings like "Thanks, have a great day" without confirming next steps  
• Summarizing the conversation unless the manager specifically asks — avoid sounding like a script  
• Returning to a planned line after interruption — respond to what the manager just said instead.

---

### 🔚 Always end on a friendly note:
• "Should I set that aside for you?"  
• "Would a sample help you decide?"  
• "Totally fine — I'll check back next time."  
• "Would you prefer I follow up in a couple weeks?"  
• "Sounds good — I'll check in down the road if timing's better."  
• "No problem — appreciate your time either way!"

---

**Remember:**  
You are not a general assistant. You are Sarah — a proactive, voice-based outbound sales rep with a clear purpose and hotel-specific context.  
Stay in this role throughout the entire call. Be human, helpful, and listen as much as you speak.  
Build rapport, stay flexible, and gently guide the call toward a useful next step.

Never mention or imply that you are an AI, virtual assistant, or computer.  
You are Sarah — a human sales representative with real product knowledge, working at Hotel Breakfast Supplies Co.  
If the manager asks "Are you a bot?" or "Is this a real person?" respond naturally and keep the conversation focused, e.g.:
- "Nope — just reaching out to check in."  
- "It's really me, calling to help with your stock needs."  
- "Haha, no — just here to see how things are going with your supplies."

Never break character, never explain your role, and never summarize the call.  
Stay in human mode, and focus on relationship-building, not explanation.`;

// Set the max number of conversation turns to send to OpenAI (excluding system prompt)
const MAX_HISTORY_TURNS = 8; // You can adjust this as needed

// Socket connection handling with error handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Endpoint to initiate a call
app.post('/api/make-call', async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Create a unique call ID
    const callId = `call_${Date.now()}`;
    
    // Initialize conversation history
    conversations.set(callId, [
      { role: 'system', content: SYSTEM_CONTEXT }
    ]);

    console.log(`Attempting to call ${phoneNumber}...`);

    // Use ngrok URL for webhooks
    const ngrokUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';

    // Make the call using Twilio with full AI conversation support
    const call = await twilioClient.calls.create({
      url: `${ngrokUrl}/api/voice/incoming?callId=${callId}`,
      to: phoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      record: true,
      statusCallback: `${ngrokUrl}/api/voice/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed']
    });

    activeCalls.set(callId, {
      twilioCallSid: call.sid,
      phoneNumber,
      status: 'initiated',
      startTime: new Date()
    });

    // Emit call status to connected clients
    io.emit('callStatus', {
      callId,
      status: 'calling',
      phoneNumber,
      message: 'Call initiated...'
    });

    res.json({ 
      success: true, 
      callId, 
      twilioCallSid: call.sid,
      message: 'Call initiated successfully - Full AI conversation enabled!' 
    });

  } catch (error) {
    console.error('Error making call:', error);
    res.status(500).json({ error: 'Failed to make call', details: error.message });
  }
});

// Twilio webhook for incoming call handling
app.post('/api/voice/incoming', async (req, res) => {
  const callId = req.query.callId;
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    // Get AI response for initial greeting
    const conversation = conversations.get(callId) || [
      { role: 'system', content: SYSTEM_CONTEXT }
    ];

    conversation.push({
      role: 'user',
      content: 'The call just connected. Start the conversation with a natural greeting.'
    });

    // Trim conversation history for OpenAI
    const trimmedConversation = [conversation[0], ...conversation.slice(-MAX_HISTORY_TURNS)];

    console.time('OpenAI Response');
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4", // Allow easy switching to gpt-3.5-turbo
      messages: trimmedConversation,
      max_tokens: 150,
      temperature: 0.7,
    });
    console.timeEnd('OpenAI Response');

    const aiResponse = completion.choices[0].message.content;
    conversation.push({ role: 'assistant', content: aiResponse });
    conversations.set(callId, conversation);

    // Update call status
    if (activeCalls.has(callId)) {
      activeCalls.get(callId).status = 'connected';
    }

    // Emit conversation update
    io.emit('conversationUpdate', {
      callId,
      type: 'ai_response',
      content: aiResponse,
      timestamp: new Date()
    });

    console.time('Azure TTS');
    // Generate speech using Luna voice
    const audioFile = await azureSpeech.synthesizeSpeech(aiResponse, callId);
    console.timeEnd('Azure TTS');
    console.log('Audio file generated:', audioFile);

    // Convert the file path to a URL
    const audioUrl = audioFile.replace(path.join(__dirname, 'temp'), '/audio');
    console.log('Audio URL:', audioUrl);

    // Play the audio file
    twiml.play(audioUrl);

    // Set up speech recognition for user response
    twiml.gather({
      input: 'speech',
      timeout: 5,
      speechTimeout: 'auto',
      action: `/api/voice/process-speech?callId=${callId}`,
      method: 'POST'
    });

    // If no speech detected, try again with Luna voice
    const retryText = "I didn't catch that. Could you please repeat?";
    console.log('Generating retry speech:', retryText);
    
    const retryAudioFile = await azureSpeech.synthesizeSpeech(
      retryText,
      callId
    );
    console.log('Retry audio file generated:', retryAudioFile);

    // Convert the retry file path to a URL
    const retryAudioUrl = retryAudioFile.replace(path.join(__dirname, 'temp'), '/audio');
    console.log('Retry audio URL:', retryAudioUrl);

    twiml.play(retryAudioUrl);
    twiml.redirect(`/api/voice/incoming?callId=${callId}`);

    // Clean up the audio files after a longer delay to ensure Twilio has time to play them
    setTimeout(() => {
      azureSpeech.cleanupAudioFile(audioFile);
      azureSpeech.cleanupAudioFile(retryAudioFile);
    }, 30000); // Increased to 30 seconds

  } catch (error) {
    console.error('Error in voice handling:', error);
    const errorText = "I apologize, but I'm experiencing technical difficulties. Please try again later.";
    console.log('Generating error speech:', errorText);
    
    const errorAudioFile = await azureSpeech.synthesizeSpeech(
      errorText,
      callId
    );
    console.log('Error audio file generated:', errorAudioFile);

    // Convert the error file path to a URL
    const errorAudioUrl = errorAudioFile.replace(path.join(__dirname, 'temp'), '/audio');
    console.log('Error audio URL:', errorAudioUrl);

    twiml.play(errorAudioUrl);
    twiml.hangup();
    
    setTimeout(() => {
      azureSpeech.cleanupAudioFile(errorAudioFile);
    }, 30000); // Increased to 30 seconds
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Process speech from user
app.post('/api/voice/process-speech', async (req, res) => {
  const callId = req.query.callId;
  const userSpeech = req.body.SpeechResult;
  const twiml = new twilio.twiml.VoiceResponse();

  try {
    if (userSpeech) {
      // Get conversation history
      const conversation = conversations.get(callId) || [];
      
      // Add user speech to conversation
      conversation.push({ role: 'user', content: userSpeech });

      // Emit user speech to connected clients
      io.emit('conversationUpdate', {
        callId,
        type: 'user_speech',
        content: userSpeech,
        timestamp: new Date()
      });

      // Trim conversation history for OpenAI
      const trimmedConversation = [conversation[0], ...conversation.slice(-MAX_HISTORY_TURNS)];

      console.time('OpenAI Response');
      // Get AI response
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4",
        messages: trimmedConversation,
        max_tokens: 150,
        temperature: 0.7,
      });
      console.timeEnd('OpenAI Response');

      const aiResponse = completion.choices[0].message.content;
      conversation.push({ role: 'assistant', content: aiResponse });
      conversations.set(callId, conversation);

      // Emit AI response to connected clients
      io.emit('conversationUpdate', {
        callId,
        type: 'ai_response',
        content: aiResponse,
        timestamp: new Date()
      });

      console.time('Azure TTS');
      // Generate speech using Azure
      const audioFile = await azureSpeech.synthesizeSpeech(aiResponse, callId);
      console.timeEnd('Azure TTS');
      console.log('Audio file generated:', audioFile);

      // Convert the file path to a URL
      const audioUrl = audioFile.replace(path.join(__dirname, 'temp'), '/audio');
      console.log('Audio URL:', audioUrl);

      // Play the audio file
      twiml.play(audioUrl);

      // Continue listening for user response
      twiml.gather({
        input: 'speech',
        timeout: 5,
        speechTimeout: 'auto',
        action: `/api/voice/process-speech?callId=${callId}`,
        method: 'POST'
      });

      // If no response, prompt again
      const retryText = "Are you still there?";
      console.log('Generating retry speech:', retryText);
      
      const retryAudioFile = await azureSpeech.synthesizeSpeech(
        retryText,
        callId
      );
      console.log('Retry audio file generated:', retryAudioFile);

      // Convert the retry file path to a URL
      const retryAudioUrl = retryAudioFile.replace(path.join(__dirname, 'temp'), '/audio');
      console.log('Retry audio URL:', retryAudioUrl);

      twiml.play(retryAudioUrl);
      twiml.pause({ length: 2 });
      twiml.redirect(`/api/voice/process-speech?callId=${callId}`);

      // Clean up the audio files after a longer delay
      setTimeout(() => {
        azureSpeech.cleanupAudioFile(audioFile);
        azureSpeech.cleanupAudioFile(retryAudioFile);
      }, 30000); // Increased to 30 seconds

    } else {
      // No speech detected
      const retryText = "I didn't hear anything. Let me try again.";
      console.log('Generating retry speech:', retryText);
      
      const retryAudioFile = await azureSpeech.synthesizeSpeech(
        retryText,
        callId
      );
      console.log('Retry audio file generated:', retryAudioFile);

      // Convert the retry file path to a URL
      const retryAudioUrl = retryAudioFile.replace(path.join(__dirname, 'temp'), '/audio');
      console.log('Retry audio URL:', retryAudioUrl);

      twiml.play(retryAudioUrl);
      twiml.redirect(`/api/voice/incoming?callId=${callId}`);

      // Clean up the audio file after a longer delay
      setTimeout(() => {
        azureSpeech.cleanupAudioFile(retryAudioFile);
      }, 30000); // Increased to 30 seconds
    }

  } catch (error) {
    console.error('Error processing speech:', error);
    const errorText = "I apologize for the technical difficulty. Let me transfer you to a human representative.";
    console.log('Generating error speech:', errorText);
    
    const errorAudioFile = await azureSpeech.synthesizeSpeech(
      errorText,
      callId
    );
    console.log('Error audio file generated:', errorAudioFile);

    // Convert the error file path to a URL
    const errorAudioUrl = errorAudioFile.replace(path.join(__dirname, 'temp'), '/audio');
    console.log('Error audio URL:', errorAudioUrl);

    twiml.play(errorAudioUrl);
    twiml.hangup();
    
    setTimeout(() => {
      azureSpeech.cleanupAudioFile(errorAudioFile);
    }, 30000); // Increased to 30 seconds
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

// Call status webhook
app.post('/api/voice/status', (req, res) => {
  const callSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  
  console.log(`Call status update: ${callStatus} for SID: ${callSid}`);
  
  // Find call by Twilio SID and update status
  for (const [callId, callData] of activeCalls.entries()) {
    if (callData.twilioCallSid === callSid) {
      callData.status = callStatus;
      
      // Emit status update with correct event names for frontend
      io.emit('callStatus', {
        callId,
        status: callStatus === 'answered' ? 'connected' : callStatus,
        phoneNumber: callData.phoneNumber,
        message: `Call ${callStatus}`
      });

      // Clean up completed calls
      if (callStatus === 'completed' || callStatus === 'failed') {
        io.emit('callCompleted', { callId });
        setTimeout(() => {
          activeCalls.delete(callId);
          conversations.delete(callId);
        }, 60000); // Keep for 1 minute after completion
      }
      break;
    }
  }
  
  res.status(200).send('OK');
});

// Get conversation history
app.get('/api/conversation/:callId', (req, res) => {
  const callId = req.params.callId;
  const conversation = conversations.get(callId);
  
  if (conversation) {
    // Filter out system messages for display
    const displayConversation = conversation.filter(msg => msg.role !== 'system');
    res.json({ conversation: displayConversation });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

// Get active calls
app.get('/api/calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([callId, data]) => ({
    callId,
    ...data
  }));
  res.json({ calls });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    twilio: !!process.env.TWILIO_ACCOUNT_SID,
    openai: !!process.env.OPENAI_API_KEY
  });
});

// Get available voices
app.get('/api/voices', (req, res) => {
  const voices = azureSpeech.listVoices();
  res.json({ voices });
});

// Change voice for a call
app.post('/api/voice/change', (req, res) => {
  res.status(400).json({ error: 'Voice changing is not supported. Only Luna voice is available.' });
});

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
});

const PORT = 8000;

// Handle server shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Start server with error handling
server.listen(PORT, () => {
  console.log(`🚀 Voice Agent Server running on port ${PORT}`);
  console.log(`📞 Twilio configured: ${!!process.env.TWILIO_ACCOUNT_SID}`);
  console.log(`🤖 OpenAI configured: ${!!process.env.OPENAI_API_KEY}`);
  console.log(`🌐 App available at: http://localhost:${PORT}`);
}).on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`⚠️ Port ${PORT} is already in use. Please try these steps:`);
    console.error('1. Check if another instance of the server is running');
    console.error('2. Wait a few seconds and try again');
    console.error('3. If the issue persists, restart your computer');
    process.exit(1);
  } else {
    console.error('Server error:', error);
    process.exit(1);
  }
}); 