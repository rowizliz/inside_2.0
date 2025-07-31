// Utility functions for file naming and formatting

// Remove Vietnamese accents from text
export const removeAccents = (str) => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, d => d === 'đ' ? 'd' : 'D')
    .replace(/[^a-zA-Z0-9]/g, '');
};

// Format current date and time for filename
export const formatDateTimeForFilename = () => {
  const now = new Date();
  
  // Format: HHMMSS
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const timeStr = `${hours}${minutes}${seconds}`;
  
  // Format: MMDDYYYY
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${month}${day}${year}`;
  
  return { timeStr, dateStr };
};

// Generate filename based on user display name and current time
export const generateFilename = (displayName, fileExtension = '') => {
  const { timeStr, dateStr } = formatDateTimeForFilename();
  const cleanName = removeAccents(displayName);
  
  const filename = `${cleanName}_${timeStr}_${dateStr}${fileExtension}`;
  return filename;
};

// Get file extension from original filename or MIME type
export const getFileExtension = (originalFilename, mimeType = '') => {
  if (originalFilename && originalFilename.includes('.')) {
    return '.' + originalFilename.split('.').pop();
  }
  
  // Fallback to MIME type
  if (mimeType) {
    const mimeToExt = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'video/mp4': '.mp4',
      'video/avi': '.avi',
      'video/mov': '.mov',
      'audio/wav': '.wav',
      'audio/mp3': '.mp3',
      'audio/m4a': '.m4a'
    };
    return mimeToExt[mimeType] || '';
  }
  
  return '';
}; 