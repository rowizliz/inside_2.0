// Global AudioContext để tránh tạo nhiều context
let globalAudioContext = null;

export const getAudioContext = () => {
  if (!globalAudioContext) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    globalAudioContext = new AudioContext();
  }
  return globalAudioContext;
};

export const resumeAudioContext = async () => {
  const context = getAudioContext();
  if (context.state === 'suspended') {
    await context.resume();
  }
  return context;
};

export const closeAudioContext = () => {
  if (globalAudioContext) {
    globalAudioContext.close();
    globalAudioContext = null;
  }
}; 