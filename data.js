/* ============================================================
   GAIT ANALYSIS — Data Generator & CSV Parser
   ============================================================ */

const GaitData = (() => {
  'use strict';

  // --- Constants ---
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_EXTENSIONS = ['.csv'];
  const SAMPLE_RATE = 100; // Hz (samples per second)

  /**
   * Generate realistic synthetic gait force data.
   * Creates ~30 steps of walking with natural variability.
   * @param {object} options
   * @returns {{ timestamps: number[], leftForce: number[], rightForce: number[], sampleRate: number, duration: number }}
   */
  function generateDemoData(options = {}) {
    const {
      numSteps = 32,
      bodyWeight = 750, // ~75kg * 10 m/s² (Newtons)
      cadence = 110,    // steps/min
      asymmetry = 0.05, // 5% natural asymmetry
      noiseLevel = 0.03,
      sampleRate: sr = SAMPLE_RATE,
    } = options;

    const stepDuration = 60.0 / cadence; // seconds per step
    const stanceFraction = 0.62; // 62% stance, 38% swing
    const stanceDuration = stepDuration * stanceFraction;
    const totalDuration = numSteps * stepDuration;
    const totalSamples = Math.floor(totalDuration * sr);

    const timestamps = [];
    const leftForce = [];
    const rightForce = [];

    // Generate time array
    for (let i = 0; i < totalSamples; i++) {
      timestamps.push(i / sr);
    }

    // Generate force for each foot
    // Left and right alternate: left starts at t=0, right at t=stepDuration/2
    for (let i = 0; i < totalSamples; i++) {
      const t = timestamps[i];

      // We model a continuous walking cycle where a full stride = 2 * stepDuration
      const strideDuration = 2 * stepDuration;
      
      // Cycle time goes from 0 to strideDuration
      const cycleTimeLeft = t % strideDuration;
      const cycleTimeRight = (t + stepDuration) % strideDuration;

      // Left foot
      leftForce.push(_computeFootForce(
        cycleTimeLeft, stanceDuration, bodyWeight, 1.0, noiseLevel
      ));

      // Right foot (with asymmetry)
      rightForce.push(_computeFootForce(
        cycleTimeRight, stanceDuration, bodyWeight, 1.0 - asymmetry, noiseLevel
      ));
    }

    return {
      timestamps,
      leftForce,
      rightForce,
      sampleRate: sr,
      duration: totalDuration,
      metadata: {
        source: 'Demo Data',
        date: new Date().toISOString().split('T')[0],
        bodyWeight,
        cadence,
        numSteps,
      },
    };
  }

  /**
   * Compute force value for a single foot at cycleTime.
   * Uses a realistic double-peak GRF pattern (M-curve).
   */
  function _computeFootForce(cycleTime, stanceDuration, bodyWeight, scaleFactor, noiseLevel) {
    // If in swing phase, force is ~0
    if (cycleTime > stanceDuration) {
      return Math.max(0, _gaussianNoise() * bodyWeight * 0.005);
    }

    // Normalized stance position [0, 1]
    const s = cycleTime / stanceDuration;

    // Classic double-peak GRF (M-shaped curve)
    // First peak at ~25% of stance, valley at 50%, second peak at ~75%
    const peak1 = 1.15 * Math.exp(-Math.pow((s - 0.22) / 0.12, 2));
    const peak2 = 1.10 * Math.exp(-Math.pow((s - 0.78) / 0.12, 2));
    const valley = -0.15 * Math.exp(-Math.pow((s - 0.50) / 0.15, 2));

    // Heel strike ramp-up
    const rampUp = 1 - Math.exp(-s * 15);
    // Toe-off ramp-down
    const rampDown = 1 - Math.exp(-(1 - s) * 15);

    let force = (peak1 + peak2 + valley) * rampUp * rampDown;
    force *= bodyWeight * scaleFactor;

    // Add natural variability
    const stepVariation = 1 + 0.02 * Math.sin(cycleTime * 0.3);
    force *= stepVariation;

    // Add noise
    force += _gaussianNoise() * bodyWeight * noiseLevel;

    return Math.max(0, force);
  }

  /**
   * Gaussian random noise (Box-Muller transform)
   */
  function _gaussianNoise() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  /**
   * Parse uploaded CSV file content.
   * Expected format: timestamp,left_force,right_force
   * @param {string} csvText
   * @returns {{ data: object|null, error: string|null }}
   */
  function parseCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') {
      return { data: null, error: 'Empty or invalid file content.' };
    }

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) {
      return { data: null, error: 'CSV must have at least a header row and one data row.' };
    }

    // Parse header
    const header = lines[0].toLowerCase().trim().split(',').map(h => h.trim());
    const tsIdx = header.findIndex(h => h === 'timestamp' || h === 'time' || h === 't');
    const leftIdx = header.findIndex(h => h.includes('left') || h === 'l_force' || h === 'lf');
    const rightIdx = header.findIndex(h => h.includes('right') || h === 'r_force' || h === 'rf');

    if (tsIdx === -1 || leftIdx === -1 || rightIdx === -1) {
      // Fallback: If it's a MediaPipe skeleton CSV, parse it and convert to force data
      if (header.length >= 130 && typeof SkeletonData !== 'undefined') {
        return _parseSkeletonToForce(csvText);
      }
      return { data: null, error: 'CSV must contain columns: timestamp, left_force, right_force' };
    }

    const timestamps = [];
    const leftForce = [];
    const rightForce = [];
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].trim().split(',');
      if (cols.length < 3) continue;

      const ts = parseFloat(cols[tsIdx]);
      const lf = parseFloat(cols[leftIdx]);
      const rf = parseFloat(cols[rightIdx]);

      if (isNaN(ts) || isNaN(lf) || isNaN(rf)) {
        errorCount++;
        if (errorCount > 50) {
          return { data: null, error: 'Too many invalid data rows. Please check your CSV format.' };
        }
        continue;
      }

      timestamps.push(ts);
      leftForce.push(Math.max(0, lf));
      rightForce.push(Math.max(0, rf));
    }

    if (timestamps.length < 10) {
      return { data: null, error: 'Not enough valid data points (minimum 10 required).' };
    }

    // Estimate sample rate from timestamps
    const dtSum = timestamps.slice(1, Math.min(100, timestamps.length))
      .reduce((sum, t, i) => sum + (t - timestamps[i]), 0);
    const avgDt = dtSum / Math.min(99, timestamps.length - 1);
    const estimatedSR = Math.round(1 / avgDt);

    return {
      data: {
        timestamps,
        leftForce,
        rightForce,
        sampleRate: estimatedSR || 100,
        duration: timestamps[timestamps.length - 1] - timestamps[0],
        metadata: {
          source: 'Uploaded CSV',
          date: new Date().toISOString().split('T')[0],
          bodyWeight: null,
          cadence: null,
          numSteps: null,
        },
      },
      error: null,
    };
  }

  /**
   * Convert Skeleton MediaPipe CSV to synthetic Force data.
   * Derives pseudo ground reaction force from ankle vertical positions.
   */
  function _parseSkeletonToForce(csvText) {
    const parsed = SkeletonData.parseCSV(csvText);
    if (parsed.error) return { data: null, error: parsed.error };

    // Normalize timestamps to seconds starting at 0 (source may be in µs, ms, or s)
    const rawTs = parsed.timestamps;
    let scale = 1;
    if (rawTs.length > 1) {
      const avgDt = (rawTs[rawTs.length - 1] - rawTs[0]) / (rawTs.length - 1);
      if (avgDt > 10000) scale = 1e-6;      // microseconds
      else if (avgDt > 10) scale = 1e-3;    // milliseconds
    }
    const t0 = rawTs[0];
    const timestamps = rawTs.map(t => (t - t0) * scale);
    const leftForce = [];
    const rightForce = [];
    const bw = 750; // Standard synthetic body weight

    // Find the ground plane (95th percentile of y-coordinates, which are higher near the ground)
    const validLY = [], validRY = [];
    parsed.frames.forEach(f => {
      if (f.hasData) {
        validLY.push(f.landmarks[SkeletonData.LANDMARKS.LEFT_ANKLE].y);
        validRY.push(f.landmarks[SkeletonData.LANDMARKS.RIGHT_ANKLE].y);
      }
    });

    validLY.sort((a, b) => a - b);
    validRY.sort((a, b) => a - b);
    
    // Fallback to 0.9 if arrays are somehow empty
    const lGround = validLY.length > 0 ? validLY[Math.floor(validLY.length * 0.95)] : 0.9;
    const rGround = validRY.length > 0 ? validRY[Math.floor(validRY.length * 0.95)] : 0.9;
    
    // Threshold for ground contact (normalized image height, e.g., 0.06 is ~6% of frame height)
    const contactThreshold = 0.06;

    parsed.frames.forEach((f) => {
      if (!f.hasData) {
        leftForce.push(0);
        rightForce.push(0);
        return;
      }

      const ly = f.landmarks[SkeletonData.LANDMARKS.LEFT_ANKLE].y;
      const ry = f.landmarks[SkeletonData.LANDMARKS.RIGHT_ANKLE].y;

      // Calculate depth relative to ground threshold (positive means foot is down)
      const lDepth = (ly - (lGround - contactThreshold)) / contactThreshold;
      const rDepth = (ry - (rGround - contactThreshold)) / contactThreshold;

      let lf = 0, rf = 0;
      
      if (lDepth > 0) {
        // Map depth to an M-curve like force
        const forceScale = Math.min(1.2, lDepth * 1.5);
        lf = forceScale * bw + _gaussianNoise() * bw * 0.03;
      }
      
      if (rDepth > 0) {
        const forceScale = Math.min(1.2, rDepth * 1.5);
        rf = forceScale * bw + _gaussianNoise() * bw * 0.03;
      }

      leftForce.push(Math.max(0, lf));
      rightForce.push(Math.max(0, rf));
    });

    return {
      data: {
        timestamps,
        leftForce,
        rightForce,
        sampleRate: parsed.fps || 100,
        duration: timestamps[timestamps.length - 1] - timestamps[0],
        metadata: {
          source: 'Skeleton AI Data',
          date: new Date().toISOString().split('T')[0],
          bodyWeight: 75,
          cadence: null,
          numSteps: null,
        },
      },
      error: null,
    };
  }

  /**
   * Validate a file before parsing.
   * @param {File} file
   * @returns {{ valid: boolean, error: string|null }}
   */
  function validateFile(file) {
    if (!file) {
      return { valid: false, error: 'No file selected.' };
    }

    // Check extension
    const name = file.name.toLowerCase();
    const hasValidExt = ALLOWED_EXTENSIONS.some(ext => name.endsWith(ext));
    if (!hasValidExt) {
      return { valid: false, error: 'Only CSV files are supported (.csv).' };
    }

    // Check size
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: 'File too large. Maximum size is 10MB.' };
    }

    if (file.size === 0) {
      return { valid: false, error: 'File is empty.' };
    }

    return { valid: true, error: null };
  }

  /**
   * Export analysis results to CSV format.
   * @param {object} analysisResults - from GaitEngine.analyze()
   * @returns {string} CSV content
   */
  function exportToCSV(analysisResults) {
    if (!analysisResults || !analysisResults.steps) {
      return '';
    }

    const lines = [];

    // Header
    lines.push([
      'Step', 'Foot', 'Peak Force (N)', 'Contact Time (ms)',
      'Step Duration (ms)', 'Cadence (steps/min)', 'Loading Rate (N/s)',
      'Stance Start (s)', 'Stance End (s)'
    ].join(','));

    // Data rows
    analysisResults.steps.forEach(step => {
      lines.push([
        step.stepNumber,
        step.foot,
        step.peakForce.toFixed(1),
        step.contactTime.toFixed(1),
        step.stepDuration.toFixed(1),
        step.cadence.toFixed(1),
        step.loadingRate.toFixed(1),
        step.stanceStart.toFixed(4),
        step.stanceEnd.toFixed(4),
      ].join(','));
    });

    // Summary section
    lines.push('');
    lines.push('--- Summary Statistics ---');
    const s = analysisResults.summary;
    lines.push('Parameter,Left Mean,Left StdDev,Right Mean,Right StdDev,Symmetry Index (%)');
    lines.push([
      'Peak Force (N)',
      s.left.peakForce.mean.toFixed(1), s.left.peakForce.std.toFixed(1),
      s.right.peakForce.mean.toFixed(1), s.right.peakForce.std.toFixed(1),
      s.symmetry.peakForce.toFixed(1),
    ].join(','));
    lines.push([
      'Contact Time (ms)',
      s.left.contactTime.mean.toFixed(1), s.left.contactTime.std.toFixed(1),
      s.right.contactTime.mean.toFixed(1), s.right.contactTime.std.toFixed(1),
      s.symmetry.contactTime.toFixed(1),
    ].join(','));
    lines.push([
      'Cadence (steps/min)',
      s.left.cadence.mean.toFixed(1), s.left.cadence.std.toFixed(1),
      s.right.cadence.mean.toFixed(1), s.right.cadence.std.toFixed(1),
      s.symmetry.cadence.toFixed(1),
    ].join(','));

    return lines.join('\n');
  }

  /**
   * Trigger file download in the browser.
   * @param {string} content
   * @param {string} filename
   * @param {string} mimeType
   */
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Public API
  return {
    generateDemoData,
    parseCSV,
    validateFile,
    exportToCSV,
    downloadFile,
    SAMPLE_RATE,
  };
})();
