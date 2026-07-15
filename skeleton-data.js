/* ============================================================
   SKELETON DATA PARSER — MediaPipe Pose Landmark CSV Parser
   Parses 33 landmark positions, computes joint angles,
   detects gait events from skeleton data.
   ============================================================ */

const SkeletonData = (() => {
  'use strict';

  // --- MediaPipe Pose Landmark indices ---
  const LANDMARKS = {
    NOSE: 0,
    LEFT_EYE_INNER: 1, LEFT_EYE: 2, LEFT_EYE_OUTER: 3,
    RIGHT_EYE_INNER: 4, RIGHT_EYE: 5, RIGHT_EYE_OUTER: 6,
    LEFT_EAR: 7, RIGHT_EAR: 8,
    MOUTH_LEFT: 9, MOUTH_RIGHT: 10,
    LEFT_SHOULDER: 11, RIGHT_SHOULDER: 12,
    LEFT_ELBOW: 13, RIGHT_ELBOW: 14,
    LEFT_WRIST: 15, RIGHT_WRIST: 16,
    LEFT_PINKY: 17, RIGHT_PINKY: 18,
    LEFT_INDEX: 19, RIGHT_INDEX: 20,
    LEFT_THUMB: 21, RIGHT_THUMB: 22,
    LEFT_HIP: 23, RIGHT_HIP: 24,
    LEFT_KNEE: 25, RIGHT_KNEE: 26,
    LEFT_ANKLE: 27, RIGHT_ANKLE: 28,
    LEFT_HEEL: 29, RIGHT_HEEL: 30,
    LEFT_FOOT_INDEX: 31, RIGHT_FOOT_INDEX: 32,
  };

  // Skeleton bone connections for drawing
  const CONNECTIONS = [
    // Torso
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER],
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_HIP],
    [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_HIP],
    [LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    // Left arm
    [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW],
    [LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
    // Right arm
    [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW],
    [LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
    // Left leg
    [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE],
    [LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE],
    [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HEEL],
    [LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_FOOT_INDEX],
    [LANDMARKS.LEFT_HEEL, LANDMARKS.LEFT_FOOT_INDEX],
    // Right leg
    [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE],
    [LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE],
    [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HEEL],
    [LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_FOOT_INDEX],
    [LANDMARKS.RIGHT_HEEL, LANDMARKS.RIGHT_FOOT_INDEX],
    // Face
    [LANDMARKS.NOSE, LANDMARKS.LEFT_EYE],
    [LANDMARKS.NOSE, LANDMARKS.RIGHT_EYE],
    [LANDMARKS.LEFT_EAR, LANDMARKS.LEFT_EYE],
    [LANDMARKS.RIGHT_EAR, LANDMARKS.RIGHT_EYE],
    // Head to shoulders
    [LANDMARKS.NOSE, LANDMARKS.LEFT_SHOULDER],
    [LANDMARKS.NOSE, LANDMARKS.RIGHT_SHOULDER],
  ];

  // Body part color mapping for skeleton rendering
  const BODY_PARTS = {
    leftArm: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.LEFT_ELBOW, LANDMARKS.LEFT_WRIST],
    rightArm: [LANDMARKS.RIGHT_SHOULDER, LANDMARKS.RIGHT_ELBOW, LANDMARKS.RIGHT_WRIST],
    leftLeg: [LANDMARKS.LEFT_HIP, LANDMARKS.LEFT_KNEE, LANDMARKS.LEFT_ANKLE, LANDMARKS.LEFT_HEEL, LANDMARKS.LEFT_FOOT_INDEX],
    rightLeg: [LANDMARKS.RIGHT_HIP, LANDMARKS.RIGHT_KNEE, LANDMARKS.RIGHT_ANKLE, LANDMARKS.RIGHT_HEEL, LANDMARKS.RIGHT_FOOT_INDEX],
    torso: [LANDMARKS.LEFT_SHOULDER, LANDMARKS.RIGHT_SHOULDER, LANDMARKS.LEFT_HIP, LANDMARKS.RIGHT_HIP],
    face: [LANDMARKS.NOSE, LANDMARKS.LEFT_EYE, LANDMARKS.RIGHT_EYE, LANDMARKS.LEFT_EAR, LANDMARKS.RIGHT_EAR],
  };

  /**
   * Parse skeleton CSV data.
   * @param {string} csvText - Raw CSV text
   * @returns {{ frames: Array, timestamps: number[], duration: number, fps: number, error: string|null }}
   */
  function parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      return { frames: [], timestamps: [], duration: 0, fps: 0, error: 'Empty or invalid CSV content.' };
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return { frames: [], timestamps: [], duration: 0, fps: 0, error: 'CSV must have header + data rows.' };
    }

    // Parse header to verify structure
    const header = lines[0].trim().replace(/\r$/, '').split(',');
    if (!header[0].toLowerCase().includes('timestamp')) {
      return { frames: [], timestamps: [], duration: 0, fps: 0, error: 'First column must be timestamp.' };
    }

    const frames = [];
    const timestamps = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim().replace(/\r$/, '');
      if (!line) continue;

      const cols = line.split(',');
      const timestamp = parseFloat(cols[0]);
      if (isNaN(timestamp)) continue;

      // Check if this row has landmark data (column 1 should be non-empty for valid data)
      if (!cols[1] || cols[1].trim() === '') {
        // Empty frame — no skeleton detected
        timestamps.push(timestamp);
        frames.push({ timestamp, landmarks: null, hasData: false });
        continue;
      }

      // Parse 33 landmarks (each has x, y, z, visibility = 4 columns)
      const landmarks = [];
      for (let lm = 0; lm < 33; lm++) {
        const baseIdx = 1 + (lm * 4);
        const x = parseFloat(cols[baseIdx]) || 0;
        const y = parseFloat(cols[baseIdx + 1]) || 0;
        const z = parseFloat(cols[baseIdx + 2]) || 0;
        const visibility = parseFloat(cols[baseIdx + 3]) || 0;
        landmarks.push({ x, y, z, visibility });
      }

      timestamps.push(timestamp);
      frames.push({ timestamp, landmarks, hasData: true });
    }

    if (frames.length === 0) {
      return { frames: [], timestamps: [], duration: 0, fps: 0, error: 'No valid data rows found.' };
    }

    // Compute FPS from timestamps with actual data
    const dataFrames = frames.filter(f => f.hasData);
    let fps = 30; // default
    if (dataFrames.length > 1) {
      const dtValues = [];
      for (let i = 1; i < Math.min(50, dataFrames.length); i++) {
        dtValues.push(dataFrames[i].timestamp - dataFrames[i - 1].timestamp);
      }
      const avgDt = dtValues.reduce((a, b) => a + b, 0) / dtValues.length;
      // Timestamps appear to be in microseconds
      if (avgDt > 10000) {
        fps = Math.round(1000000 / avgDt); // microseconds to fps
      } else if (avgDt > 10) {
        fps = Math.round(1000 / avgDt); // milliseconds to fps
      } else {
        fps = Math.round(1 / avgDt); // seconds to fps
      }
    }

    const duration = (timestamps[timestamps.length - 1] - timestamps[0]);

    return {
      frames,
      timestamps,
      duration,
      fps: Math.max(1, Math.min(120, fps)),
      totalFrames: frames.length,
      dataFrames: dataFrames.length,
      firstDataFrame: frames.findIndex(f => f.hasData),
      error: null,
    };
  }

  /**
   * Get the frame nearest to a given normalized time (0 to 1).
   * @param {Array} frames - Parsed frames array
   * @param {number} normalizedTime - 0.0 to 1.0
   * @returns {object|null} The nearest frame with data
   */
  function getFrameAtNormalizedTime(frames, normalizedTime) {
    if (!frames || frames.length === 0) return null;

    const dataFrames = frames.filter(f => f.hasData);
    if (dataFrames.length === 0) return null;

    const idx = Math.round(normalizedTime * (dataFrames.length - 1));
    const clampedIdx = Math.max(0, Math.min(dataFrames.length - 1, idx));
    return dataFrames[clampedIdx];
  }

  /**
   * Get the frame at a specific index in the data frames array.
   * @param {Array} frames - All frames
   * @param {number} dataFrameIndex - Index into data-only frames
   * @returns {object|null}
   */
  function getDataFrame(frames, dataFrameIndex) {
    const dataFrames = frames.filter(f => f.hasData);
    if (dataFrameIndex < 0 || dataFrameIndex >= dataFrames.length) return null;
    return dataFrames[dataFrameIndex];
  }

  /**
   * Compute the angle between three points (in degrees).
   * The angle is at point B (the middle point).
   * @param {{ x: number, y: number }} a
   * @param {{ x: number, y: number }} b - The vertex
   * @param {{ x: number, y: number }} c
   * @returns {number} Angle in degrees
   */
  function _computeAngle(a, b, c) {
    const ba = { x: a.x - b.x, y: a.y - b.y };
    const bc = { x: c.x - b.x, y: c.y - b.y };

    const dotProduct = ba.x * bc.x + ba.y * bc.y;
    const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
    const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);

    if (magBA === 0 || magBC === 0) return 0;

    const cosAngle = Math.max(-1, Math.min(1, dotProduct / (magBA * magBC)));
    return Math.acos(cosAngle) * (180 / Math.PI);
  }

  /**
   * Compute key gait joint angles from a single frame's landmarks.
   * @param {Array} landmarks - 33 landmark positions
   * @returns {object} Joint angles in degrees
   */
  function computeJointAngles(landmarks) {
    if (!landmarks || landmarks.length < 33) return null;

    const lm = landmarks;

    return {
      // Left side
      leftHip: _computeAngle(
        lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE]
      ),
      leftKnee: _computeAngle(
        lm[LANDMARKS.LEFT_HIP], lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.LEFT_ANKLE]
      ),
      leftAnkle: _computeAngle(
        lm[LANDMARKS.LEFT_KNEE], lm[LANDMARKS.LEFT_ANKLE], lm[LANDMARKS.LEFT_FOOT_INDEX]
      ),
      leftElbow: _computeAngle(
        lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_WRIST]
      ),
      leftShoulder: _computeAngle(
        lm[LANDMARKS.LEFT_ELBOW], lm[LANDMARKS.LEFT_SHOULDER], lm[LANDMARKS.LEFT_HIP]
      ),

      // Right side
      rightHip: _computeAngle(
        lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_KNEE]
      ),
      rightKnee: _computeAngle(
        lm[LANDMARKS.RIGHT_HIP], lm[LANDMARKS.RIGHT_KNEE], lm[LANDMARKS.RIGHT_ANKLE]
      ),
      rightAnkle: _computeAngle(
        lm[LANDMARKS.RIGHT_KNEE], lm[LANDMARKS.RIGHT_ANKLE], lm[LANDMARKS.RIGHT_FOOT_INDEX]
      ),
      rightElbow: _computeAngle(
        lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_ELBOW], lm[LANDMARKS.RIGHT_WRIST]
      ),
      rightShoulder: _computeAngle(
        lm[LANDMARKS.RIGHT_ELBOW], lm[LANDMARKS.RIGHT_SHOULDER], lm[LANDMARKS.RIGHT_HIP]
      ),

      // Trunk lean (angle of trunk from vertical)
      trunkLean: _computeTrunkLean(lm),
    };
  }

  /**
   * Compute trunk lean angle from vertical.
   */
  function _computeTrunkLean(lm) {
    const midShoulder = {
      x: (lm[LANDMARKS.LEFT_SHOULDER].x + lm[LANDMARKS.RIGHT_SHOULDER].x) / 2,
      y: (lm[LANDMARKS.LEFT_SHOULDER].y + lm[LANDMARKS.RIGHT_SHOULDER].y) / 2,
    };
    const midHip = {
      x: (lm[LANDMARKS.LEFT_HIP].x + lm[LANDMARKS.RIGHT_HIP].x) / 2,
      y: (lm[LANDMARKS.LEFT_HIP].y + lm[LANDMARKS.RIGHT_HIP].y) / 2,
    };

    // Angle from vertical (y-axis)
    const dx = midShoulder.x - midHip.x;
    const dy = midHip.y - midShoulder.y; // Invert because y increases downward
    const angle = Math.atan2(dx, dy) * (180 / Math.PI);
    return angle;
  }

  /**
   * Compute all joint angles for all data frames.
   * @param {Array} frames - Parsed frames
   * @returns {object} Time series of joint angles
   */
  function computeAllAngles(frames) {
    const dataFrames = frames.filter(f => f.hasData);
    const series = {
      frameIndices: [],
      leftHip: [], rightHip: [],
      leftKnee: [], rightKnee: [],
      leftAnkle: [], rightAnkle: [],
      leftElbow: [], rightElbow: [],
      leftShoulder: [], rightShoulder: [],
      trunkLean: [],
    };

    dataFrames.forEach((frame, idx) => {
      const angles = computeJointAngles(frame.landmarks);
      if (!angles) return;

      series.frameIndices.push(idx);
      Object.keys(angles).forEach(key => {
        if (series[key]) {
          series[key].push(angles[key]);
        }
      });
    });

    return series;
  }

  /**
   * Detect gait events (heel strikes and toe-offs) from ankle y-position.
   * @param {Array} frames - Parsed frames
   * @returns {object} Gait events timeline
   */
  function detectGaitEvents(frames) {
    const dataFrames = frames.filter(f => f.hasData);
    if (dataFrames.length < 10) return { leftSteps: [], rightSteps: [] };

    const leftAnkleY = dataFrames.map(f => f.landmarks[LANDMARKS.LEFT_ANKLE].y);
    const rightAnkleY = dataFrames.map(f => f.landmarks[LANDMARKS.RIGHT_ANKLE].y);

    // Detect peaks in ankle y-position (heel strikes happen at local maxima of y)
    const leftSteps = _detectPeaks(leftAnkleY, 0.01);
    const rightSteps = _detectPeaks(rightAnkleY, 0.01);

    return { leftSteps, rightSteps, leftAnkleY, rightAnkleY };
  }

  /**
   * Simple peak detection.
   */
  function _detectPeaks(data, minProminence) {
    const peaks = [];
    for (let i = 2; i < data.length - 2; i++) {
      if (data[i] > data[i - 1] && data[i] > data[i + 1] &&
          data[i] > data[i - 2] && data[i] > data[i + 2]) {
        const prominence = data[i] - Math.min(data[i - 2], data[i + 2]);
        if (prominence > minProminence) {
          peaks.push(i);
        }
      }
    }
    return peaks;
  }

  /**
   * Determine current gait phase for each leg at a given frame.
   * Uses vertical ankle position relative to hip.
   * @param {Array} landmarks - Current frame landmarks
   * @returns {{ left: string, right: string }} 'stance' or 'swing'
   */
  function getGaitPhase(landmarks) {
    if (!landmarks) return { left: 'unknown', right: 'unknown' };

    const lAnkle = landmarks[LANDMARKS.LEFT_ANKLE];
    const rAnkle = landmarks[LANDMARKS.RIGHT_ANKLE];
    const lHip = landmarks[LANDMARKS.LEFT_HIP];
    const rHip = landmarks[LANDMARKS.RIGHT_HIP];

    // If ankle is near or below hip level (high y value), it's in stance
    // If ankle y is lower (foot raised), it's in swing
    const lRelativeHeight = lAnkle.y - lHip.y;
    const rRelativeHeight = rAnkle.y - rHip.y;

    // Higher y values mean lower position (closer to ground) in image coordinates
    const threshold = 0.3;
    return {
      left: lRelativeHeight > threshold ? 'stance' : 'swing',
      right: rRelativeHeight > threshold ? 'stance' : 'swing',
    };
  }

  // Public API
  return {
    parseCSV,
    getFrameAtNormalizedTime,
    getDataFrame,
    computeJointAngles,
    computeAllAngles,
    detectGaitEvents,
    getGaitPhase,
    LANDMARKS,
    CONNECTIONS,
    BODY_PARTS,
  };
})();
