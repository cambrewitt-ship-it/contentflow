const VIDEO_EXTENSIONS = /\.(mp4|mov|avi|webm|mkv|m4v|ogv|flv)(\?.*)?$/i;

export function isVideoUrl(url: string): boolean {
  return VIDEO_EXTENSIONS.test(url);
}

export function extractVideoThumbnail(source: File | string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    if (typeof source === 'string') {
      video.crossOrigin = 'anonymous';
    }

    let objectUrl: string | null = null;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 360;
      video.currentTime = 0;
    };

    video.onseeked = () => {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(thumbnail);
    };

    video.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load video'));
    };

    if (typeof source === 'string') {
      video.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      video.src = objectUrl;
    }
  });
}
