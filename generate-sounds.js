const fs = require('fs');
const path = require('path');

// Function to create a WAV file
function createWavFile(samples, sampleRate, filename) {
    const length = samples.length;
    const buffer = Buffer.alloc(44 + length * 2);
    
    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + length * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20);
    buffer.writeUInt16LE(1, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(length * 2, 40);
    
    // Convert float samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, samples[i]));
        buffer.writeInt16LE(sample * 0x7FFF, offset);
        offset += 2;
    }
    
    fs.writeFileSync(filename, buffer);
    console.log(`Generated: ${filename}`);
}

// Generate ringtone
function generateRingtone() {
    const sampleRate = 44100;
    const duration = 3; // 3 seconds
    const samples = [];
    
    for (let i = 0; i < sampleRate * duration; i++) {
        const time = i / sampleRate;
        const freq1 = 523.25; // C5
        const freq2 = 659.25; // E5
        
        // Create pattern: C5 for 0.3s, silence for 0.1s, E5 for 0.3s, silence for 0.3s
        const cycle = time % 1.0; // 1 second cycle
        let amplitude = 0;
        let freq = freq1;
        
        if (cycle < 0.3) {
            freq = freq1;
            amplitude = 0.3;
        } else if (cycle < 0.4) {
            amplitude = 0; // silence
        } else if (cycle < 0.7) {
            freq = freq2;
            amplitude = 0.3;
        } else {
            amplitude = 0; // silence
        }
        
        samples.push(Math.sin(2 * Math.PI * freq * time) * amplitude);
    }
    
    createWavFile(samples, sampleRate, 'public/sounds/ringtone.wav');
}

// Generate connected sound
function generateConnected() {
    const sampleRate = 44100;
    const duration = 0.5; // 0.5 seconds
    const samples = [];
    
    for (let i = 0; i < sampleRate * duration; i++) {
        const time = i / sampleRate;
        const freq = 400 + (400 * time / duration); // 400Hz to 800Hz
        const envelope = Math.sin(time * Math.PI / duration); // Bell curve
        samples.push(Math.sin(2 * Math.PI * freq * time) * envelope * 0.2);
    }
    
    createWavFile(samples, sampleRate, 'public/sounds/connected.wav');
}

// Generate busy sound
function generateBusy() {
    const sampleRate = 44100;
    const duration = 2; // 2 seconds
    const samples = [];
    
    for (let i = 0; i < sampleRate * duration; i++) {
        const time = i / sampleRate;
        const freq = 480; // Hz
        
        // Create pattern: 0.25s beep, 0.25s silence
        const cycle = time % 0.5;
        const amplitude = cycle < 0.25 ? 0.3 : 0;
        
        samples.push(Math.sin(2 * Math.PI * freq * time) * amplitude);
    }
    
    createWavFile(samples, sampleRate, 'public/sounds/busy.wav');
}

// Generate ended sound
function generateEnded() {
    const sampleRate = 44100;
    const duration = 1; // 1 second
    const samples = [];
    
    for (let i = 0; i < sampleRate * duration; i++) {
        const time = i / sampleRate;
        const freq = 600 - (400 * time / duration); // 600Hz to 200Hz
        const envelope = Math.exp(-time * 3); // Quick decay
        samples.push(Math.sin(2 * Math.PI * freq * time) * envelope * 0.2);
    }
    
    createWavFile(samples, sampleRate, 'public/sounds/ended.wav');
}

// Create sounds directory if it doesn't exist
if (!fs.existsSync('public/sounds')) {
    fs.mkdirSync('public/sounds', { recursive: true });
}

// Generate all sounds
console.log('Generating sound files...');
generateRingtone();
generateConnected();
generateBusy();
generateEnded();
console.log('All sound files generated!');
