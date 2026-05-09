import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

export const acceptedMusicUploadTypes = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/midi',
  'audio/x-midi',
  'application/pdf',
  'application/vnd.recordare.musicxml+xml',
  'text/xml',
  'image/jpeg',
  'image/png',
] as const;

const safeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const musicUploadPath = (userId: string, fileName: string) =>
  `users/${userId}/music-uploads/${Date.now()}-${safeFileName(fileName) || 'upload'}`;

export const convertedLessonPath = (userId: string, fileName: string) =>
  `users/${userId}/converted-lessons/${safeFileName(fileName) || 'lesson.json'}`;

export const uploadPrivateMusicFile = async (userId: string, file: File) => {
  if (!storage) {
    throw new Error('Firebase Storage is niet geconfigureerd.');
  }

  const path = musicUploadPath(userId, file.name);
  const fileRef = ref(storage, path);
  const snapshot = await uploadBytes(fileRef, file, {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      owner: userId,
      originalName: file.name,
    },
  });

  return {
    path,
    downloadUrl: await getDownloadURL(snapshot.ref),
  };
};
