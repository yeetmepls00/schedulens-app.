// Full-screen camera that looks for a group QR code (web).
import { useEffect, useRef, useState } from 'react';
import { Modal, View } from 'react-native';
import { readQrFromVideo } from '../lib/qr';
import { colors, space } from '../theme/tokens';
import { Button, T } from './ui';

export function QrScanner({ open, onResult, onClose }: { open: boolean; onResult: (text: string) => void; onClose: () => void }) {
  const box = useRef<View>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setError('');
    let stream: MediaStream | null = null, timer: ReturnType<typeof setInterval> | undefined, stopped = false;
    const video = document.createElement('video');
    video.setAttribute('playsinline', ''); video.muted = true;
    Object.assign(video.style, { width: '100%', height: '100%', objectFit: 'cover', borderRadius: '20px' });
    const canvas = document.createElement('canvas');
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } }).then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s; video.srcObject = s; video.play().catch(() => {});
      (box.current as unknown as HTMLElement)?.appendChild(video);
      timer = setInterval(() => { const t = readQrFromVideo(video, canvas); if (t) { clearInterval(timer); onResult(t); } }, 250);
    }).catch(() => setError('We could not open the camera. Allow camera access, or use Upload QR picture instead.'));
    if (!navigator.mediaDevices) setError('This browser cannot open the camera. Use Upload QR picture instead.');
    return () => { stopped = true; clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); video.remove(); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(30,20,22,0.9)', padding: space.xl, justifyContent: 'center', gap: space.lg }}>
        <T v="section" color={colors.white} center>Scan the group QR code</T>
        <View ref={box} style={{ width: '100%', aspectRatio: 1, borderRadius: 20, borderWidth: 3, borderColor: colors.strawberry, overflow: 'hidden', backgroundColor: '#000' }} />
        {error ? <T color={colors.white} center>{error}</T> : <T v="caption" color={colors.white} center>Hold the code inside the frame.</T>}
        <Button kind="secondary" label="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
