const sdk = require('microsoft-cognitiveservices-speech-sdk');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);

class AzureSpeechService {
  constructor() {
    // Debug logging for environment variables
    console.log('Azure Speech Configuration:');
    console.log('AZURE_SPEECH_KEY:', process.env.AZURE_SPEECH_KEY ? 'Present' : 'Missing');
    console.log('AZURE_SPEECH_REGION:', process.env.AZURE_SPEECH_REGION || 'Missing');

    if (!process.env.AZURE_SPEECH_KEY || !process.env.AZURE_SPEECH_REGION) {
      throw new Error('Azure Speech Service credentials are missing. Please check your .env file.');
    }

    this.speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY,
      process.env.AZURE_SPEECH_REGION
    );
    // Set Luna voice (en-US-LunaNeural)
    this.speechConfig.speechSynthesisVoiceName = "en-US-LunaNeural";
    this.speechConfig.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;
    console.log('Voice set to: en-US-LunaNeural (Luna, conversation style)');
  }

  async synthesizeSpeech(text, callId) {
    try {
      console.log(`Starting speech synthesis for call ${callId}`);
      console.log(`Text to synthesize: ${text}`);
      // Create a unique filename for this audio
      const audioFile = path.join(__dirname, `../temp/${callId}_${Date.now()}.mp3`);
      console.log(`Audio file path: ${audioFile}`);
      // Ensure temp directory exists
      const tempDir = path.join(__dirname, '../temp');
      if (!fs.existsSync(tempDir)) {
        console.log('Creating temp directory');
        fs.mkdirSync(tempDir);
      }
      // Create audio config
      const audioConfig = sdk.AudioConfig.fromAudioFileOutput(audioFile);
      // Create synthesizer
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig, audioConfig);
      // Create SSML for Luna with conversation style
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="en-US">
          <voice name="en-US-LunaNeural">
            <mstts:express-as style="conversation">
              <prosody rate="-10%" pitch="+4%">
                ${text}
              </prosody>
            </mstts:express-as>
          </voice>
        </speak>
      `;
      // Synthesize speech with SSML
      const result = await new Promise((resolve, reject) => {
        synthesizer.speakSsmlAsync(
          ssml,
          result => {
            synthesizer.close();
            if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
              console.log('Speech synthesis completed successfully');
              console.log(`Audio file created at: ${audioFile}`);
              resolve(audioFile);
            } else {
              console.error('Speech synthesis failed:', result.errorDetails);
              reject(new Error(`Speech synthesis failed: ${result.errorDetails}`));
            }
          },
          error => {
            synthesizer.close();
            console.error('Speech synthesis error:', error);
            reject(error);
          }
        );
      });
      // Verify the file exists
      if (fs.existsSync(result)) {
        const stats = fs.statSync(result);
        console.log(`Audio file size: ${stats.size} bytes`);
      } else {
        console.error('Audio file was not created');
      }
      return result;
    } catch (error) {
      console.error('Error in speech synthesis:', error);
      throw error;
    }
  }

  async cleanupAudioFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
        console.log(`Cleaned up audio file: ${filePath}`);
      } else {
        console.log(`Audio file not found for cleanup: ${filePath}`);
      }
    } catch (error) {
      console.error('Error cleaning up audio file:', error);
    }
  }
}

module.exports = new AzureSpeechService(); 