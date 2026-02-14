import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import {
  NOSE_INDEX,
  NOSE_SMOOTHING,
  NOSE_CENTER,
  NOSE_THRESHOLD,
  DIRECTION_COOLDOWN_MS,
  UI_THROTTLE_MS,
  HEAD_DIRECTIONS,
  CALIBRATION_SAMPLES_TARGET,
  getMirroredHeadDirection,
  noseOffsetFromNormalized,
  medianPoint,
} from './headTrackingConfig'
import { drawTrackingOverlay } from './drawTrackingOverlay'

const DEFAULT_MEDIAPIPE_WASM_URL =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
const DEFAULT_FACE_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'

const MEDIAPIPE_WASM_URL =
  import.meta.env.VITE_MEDIAPIPE_WASM_URL ?? DEFAULT_MEDIAPIPE_WASM_URL
const FACE_LANDMARKER_MODEL =
  import.meta.env.VITE_FACE_LANDMARKER_MODEL_URL ??
  DEFAULT_FACE_LANDMARKER_MODEL_URL
const BASELINE_BLEND_INTERVAL_MS = 5000
const BASELINE_BLEND_ALPHA = 0.1
const BASELINE_DRIFT_ENABLED = false

/**
 * @param {{ faceEnabled: boolean, onDirectionChange: (vec: { x: number, y: number }) => void, sensitivity?: number }} options
 * @returns {{ videoRef: React.RefObject, canvasRef: React.RefObject, cameraStatus: string, headDirection: string | null, noseOffset: { x: number, y: number }, fps: number, trackingStatus: 'idle'|'loading'|'ready'|'error', isCalibrating: boolean, calibrationProgress: number, calibrationMessage: string, recalibrate: () => void, retry: () => void }}
 */
export function useHeadTracking({
  faceEnabled,
  onDirectionChange,
  sensitivity = 1,
}) {
  const [trackingStatus, setTrackingStatus] = useState('loading')
  const [cameraStatus, setCameraStatus] = useState('Initializing camera…')
  const [headDirection, setHeadDirection] = useState(null)
  const [noseOffset, setNoseOffset] = useState({ x: 0, y: 0 })
  const [fps, setFps] = useState(0)
  const [retryKey, setRetryKey] = useState(0)
  const [isCalibrating, setIsCalibrating] = useState(false)
  const [calibrationProgress, setCalibrationProgress] = useState(0)
  const [hasSeenFaceThisCalibration, setHasSeenFaceThisCalibration] =
    useState(false)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const smoothedNoseRef = useRef(null)
  const faceEnabledRef = useRef(faceEnabled)
  const lastDirectionRef = useRef(0)
  const baselineNoseRef = useRef(null)
  const lastBaselineBlendRef = useRef(0)
  const fpsLastRef = useRef(0)
  const fpsCountRef = useRef(0)
  const lastUIThrottleRef = useRef(0)
  const onDirectionChangeRef = useRef(onDirectionChange)
  const isCalibratingRef = useRef(false)
  const calibrationSamplesRef = useRef([])

  useEffect(() => {
    onDirectionChangeRef.current = onDirectionChange
  }, [onDirectionChange])
  useEffect(() => {
    faceEnabledRef.current = faceEnabled
  }, [faceEnabled])

  const clearOverlay = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const recalibrate = useCallback(() => {
    baselineNoseRef.current = null
    lastBaselineBlendRef.current = 0
    smoothedNoseRef.current = null
    calibrationSamplesRef.current = []
    isCalibratingRef.current = true
    setNoseOffset({ x: 0, y: 0 })
    setHeadDirection(null)
    setIsCalibrating(true)
    setCalibrationProgress(0)
    setHasSeenFaceThisCalibration(false)
  }, [])

  const retry = useCallback(() => {
    setTrackingStatus('loading')
    setCameraStatus('Initializing camera…')
    setRetryKey((k) => k + 1)
  }, [])

  useEffect(() => {
    let active = true
    let landmarker = null
    let animationId = null
    let streamToClean = null

    function smoothPoint(point) {
      const prev = smoothedNoseRef.current
      if (!prev) {
        smoothedNoseRef.current = { x: point.x, y: point.y }
        return smoothedNoseRef.current
      }
      const next = {
        x: prev.x + (point.x - prev.x) * NOSE_SMOOTHING,
        y: prev.y + (point.y - prev.y) * NOSE_SMOOTHING,
      }
      smoothedNoseRef.current = next
      return next
    }

    const setup = async () => {
      setTrackingStatus('loading')
      try {
        const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_URL)
        landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
          runningMode: 'VIDEO',
          numFaces: 1,
        })

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
        })
        if (!videoRef.current || !active) return
        streamToClean = stream
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        videoRef.current.style.transform = 'scaleX(-1)'
        setTrackingStatus('ready')
        setCameraStatus('Head tracking active')
        if (!baselineNoseRef.current) {
          isCalibratingRef.current = true
          calibrationSamplesRef.current = []
          setIsCalibrating(true)
          setCalibrationProgress(0)
          setHasSeenFaceThisCalibration(false)
        }

        const loop = () => {
          if (!active || !videoRef.current) return
          if (!faceEnabledRef.current) {
            clearOverlay()
            animationId = requestAnimationFrame(loop)
            return
          }
          if (videoRef.current.readyState >= 2 && landmarker) {
            const canvas = canvasRef.current
            if (
              canvas &&
              videoRef.current.videoWidth &&
              videoRef.current.videoHeight
            ) {
              canvas.width = videoRef.current.videoWidth
              canvas.height = videoRef.current.videoHeight
            }
            const result = landmarker.detectForVideo(
              videoRef.current,
              performance.now(),
            )
            if (result.faceLandmarks && result.faceLandmarks.length) {
              const face = result.faceLandmarks[0]
              const nose = face[NOSE_INDEX]
              const now = performance.now()

              if (!baselineNoseRef.current && !isCalibratingRef.current) {
                isCalibratingRef.current = true
                calibrationSamplesRef.current = []
                setIsCalibrating(true)
                setCalibrationProgress(0)
                setHasSeenFaceThisCalibration(false)
              }

              if (isCalibratingRef.current) {
                setHasSeenFaceThisCalibration(true)
                calibrationSamplesRef.current.push({ x: nose.x, y: nose.y })
                const progress =
                  calibrationSamplesRef.current.length /
                  CALIBRATION_SAMPLES_TARGET
                setCalibrationProgress(Math.min(1, progress))
                if (
                  calibrationSamplesRef.current.length >=
                  CALIBRATION_SAMPLES_TARGET
                ) {
                  const baseline = medianPoint(calibrationSamplesRef.current)
                  baselineNoseRef.current = baseline
                  lastBaselineBlendRef.current = now
                  calibrationSamplesRef.current = []
                  isCalibratingRef.current = false
                  setIsCalibrating(false)
                  setCalibrationProgress(0)
                  smoothedNoseRef.current = null
                }
                animationId = requestAnimationFrame(loop)
                return
              }

              if (
                BASELINE_DRIFT_ENABLED &&
                now - lastBaselineBlendRef.current >=
                  BASELINE_BLEND_INTERVAL_MS
              ) {
                lastBaselineBlendRef.current = now
                const b = baselineNoseRef.current
                baselineNoseRef.current = {
                  x:
                    b.x * (1 - BASELINE_BLEND_ALPHA) +
                    nose.x * BASELINE_BLEND_ALPHA,
                  y:
                    b.y * (1 - BASELINE_BLEND_ALPHA) +
                    nose.y * BASELINE_BLEND_ALPHA,
                }
              }
              const calibrated = {
                x: nose.x - baselineNoseRef.current.x + NOSE_CENTER,
                y: nose.y - baselineNoseRef.current.y + NOSE_CENTER,
              }
              const smoothNose = smoothPoint(calibrated)
              const threshold = NOSE_THRESHOLD / Math.max(0.25, sensitivity)
              const mirrored = getMirroredHeadDirection(smoothNose, threshold)
              if (now - lastUIThrottleRef.current >= UI_THROTTLE_MS) {
                lastUIThrottleRef.current = now
                setHeadDirection(mirrored)
                setNoseOffset(noseOffsetFromNormalized(smoothNose))
                setCameraStatus('Face detected')
              }
              if (canvas) {
                const ctx = canvas.getContext('2d')
                if (ctx) {
                  drawTrackingOverlay(ctx, canvas.width, canvas.height, {
                    nose: smoothNose,
                    direction: mirrored,
                    faceLandmarks: face,
                    mirror: true,
                  })
                }
              }
              if (mirrored) {
                const next = HEAD_DIRECTIONS[mirrored]
                if (now - lastDirectionRef.current > DIRECTION_COOLDOWN_MS) {
                  lastDirectionRef.current = now
                  onDirectionChangeRef.current(next)
                }
              }
            } else {
              const now = performance.now()
              if (now - lastUIThrottleRef.current >= UI_THROTTLE_MS) {
                lastUIThrottleRef.current = now
                setHeadDirection(null)
                setNoseOffset({ x: 0, y: 0 })
                setCameraStatus('No face detected')
              }
              if (!isCalibratingRef.current) {
                baselineNoseRef.current = null
              }
              clearOverlay()
            }
          }
          fpsCountRef.current += 1
          const now = performance.now()
          if (now - fpsLastRef.current >= 500) {
            setFps(
              Math.round(
                (fpsCountRef.current * 1000) / (now - fpsLastRef.current),
              ),
            )
            fpsCountRef.current = 0
            fpsLastRef.current = now
          }
          animationId = requestAnimationFrame(loop)
        }

        animationId = requestAnimationFrame(loop)
      } catch (error) {
        console.error(error)
        setTrackingStatus('error')
        setCameraStatus('Camera access failed')
      }
    }

    setup()

    return () => {
      active = false
      if (animationId) cancelAnimationFrame(animationId)
      clearOverlay()
      setHeadDirection(null)
      setNoseOffset({ x: 0, y: 0 })
      smoothedNoseRef.current = null
      if (streamToClean) {
        streamToClean.getTracks().forEach((t) => t.stop())
      }
    }
  }, [clearOverlay, retryKey])

  useEffect(() => {
    /* Sync UI status and clear tracking state when face toggle is turned off */
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional sync of faceEnabled to status/refs
    setCameraStatus(faceEnabled ? 'Head tracking active' : 'Face tracking off')
    if (!faceEnabled) {
      setHeadDirection(null)
      setNoseOffset({ x: 0, y: 0 })
      clearOverlay()
      baselineNoseRef.current = null
      isCalibratingRef.current = false
      calibrationSamplesRef.current = []
      setIsCalibrating(false)
      setCalibrationProgress(0)
    }
  }, [faceEnabled, clearOverlay])

  const calibrationMessage = isCalibrating
    ? hasSeenFaceThisCalibration
      ? 'Look at the camera, hold still…'
      : 'Position your face in frame, then hold still…'
    : ''

  return {
    videoRef,
    canvasRef,
    cameraStatus,
    headDirection,
    noseOffset,
    fps,
    trackingStatus,
    isCalibrating,
    calibrationProgress,
    calibrationMessage,
    recalibrate,
    retry,
  }
}
