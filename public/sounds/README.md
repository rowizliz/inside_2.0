# Sound Files for Video Call System

This directory should contain the following sound files for the video calling feature:

## Required Sound Files:

1. **ringtone.mp3** - Sound played when receiving an incoming call
   - Duration: Loop (will be played repeatedly)
   - Recommended: Similar to iPhone/FaceTime ringtone
   
2. **connected.mp3** - Sound played when call is successfully connected
   - Duration: Short (0.5-1 second)
   - Recommended: Subtle connection chime
   
3. **busy.mp3** - Sound played when call is rejected or line is busy
   - Duration: 2-3 seconds
   - Recommended: Standard busy tone
   
4. **ended.mp3** - Sound played when call ends
   - Duration: Short (0.5-1 second)
   - Recommended: Soft disconnection sound

## Free Sound Resources:

You can find free sounds at:
- https://freesound.org/
- https://www.zapsplat.com/
- https://mixkit.co/free-sound-effects/

## File Format:
- Format: MP3 or WAV
- Bitrate: 128kbps or higher
- Sample Rate: 44.1kHz

## Installation:
1. Download or create the sound files
2. Place them in this directory (/public/sounds/)
3. Make sure filenames match exactly as listed above

## Testing:
You can test the sounds by opening the browser console and running:
```javascript
new Audio('/sounds/ringtone.mp3').play();