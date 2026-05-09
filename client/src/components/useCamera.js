import { useState, useRef, useCallback, useEffect } from "react";

export function useCamera() {
  const [isActive, setIsActive] = useState(false);
  const [hasCamera, setHasCamera] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const pendingStreamRef = useRef(null);

  // When videoRef gets attached to DOM, connect any pending stream
  const setVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && pendingStreamRef.current) {
      node.srcObject = pendingStreamRef.current;
      node.play().catch(() => {});
      pendingStreamRef.current = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
      streamRef.current = s;

      if (videoRef.current) {
        // Video element already in DOM
        videoRef.current.srcObject = s;
        videoRef.current.play().catch(() => {});
      } else {
        // Video element not mounted yet — save stream for later
        pendingStreamRef.current = s;
      }

      setIsActive(true);
      setHasCamera(true);
    } catch (e) {
      console.error("Camera error:", e.message);
      setHasCamera(false);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    pendingStreamRef.current = null;
    setIsActive(false);
  }, []);

  const getSnapshot = useCallback(() => {
    try {
      if (!videoRef.current || !videoRef.current.srcObject) return null;
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      canvas.getContext("2d").drawImage(videoRef.current, 0, 0, 320, 240);
      return canvas.toDataURL("image/jpeg", 0.7);
    } catch (e) { return null; }
  }, []);

  const getSnapshots = useCallback(() => [], []);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
  }, []);

  return { videoRef: setVideoRef, isActive, hasCamera, startCamera, stopCamera, getSnapshot, getSnapshots };
}
