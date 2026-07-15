/* ============================================================
   GAIT ANALYSIS ENGINE
   Step detection, gait cycle segmentation, parameter calculation
   ============================================================ */

const GaitEngine = (() => {
  'use strict';

  // Default analysis settings
  const DEFAULT_SETTINGS = {
    forceThreshold: 20,       // N — minimum force to consider foot contact
    minStepDuration: 200,     // ms — minimum step duration to filter noise
    maxStepDuration: 2000,    // ms — maximum step duration (prevents merging)
    minStanceDuration: 100,   // ms — minimum stance phase duration
    asymmetryAlertThreshold: 10, // % — flag if L/R diff exceeds this
  };

  /**
   * Run full gait analysis on force data.
   * @param {object} rawData - from GaitData.generateDemoData() or parseCSV()
   * @param {object} settings - optional overrides for DEFAULT_SETTINGS
   * @returns {object} Full analysis results
   */
  function analyze(rawData, settings = {}) {
    const config = { ...DEFAULT_SETTINGS, ...settings };
    const { timestamps, leftForce, rightForce, sampleRate } = rawData;

    // 1. Detect steps for each foot
    const leftSteps = _detectSteps(timestamps, leftForce, sampleRate, config, 'Left');
    const rightSteps = _detectSteps(timestamps, rightForce, sampleRate, config, 'Right');

    // 2. Merge and sort all steps chronologically
    const allSteps = [...leftSteps, ...rightSteps]
      .sort((a, b) => a.stanceStart - b.stanceStart)
      .map((step, idx) => ({ ...step, stepNumber: idx + 1 }));

    // 3. Compute step durations and cadence (based on inter-step intervals)
    _computeInterStepMetrics(allSteps);

    // 4. Compute summary statistics
    const summary = _computeSummary(allSteps, config);

    // 5. Compute gait cycle info
    const gaitCycle = _computeGaitCycle(allSteps, rawData.duration);

    return {
      steps: allSteps,
      leftSteps,
      rightSteps,
      summary,
      gaitCycle,
      totalSteps: allSteps.length,
      duration: rawData.duration,
      sampleRate,
      settings: config,
    };
  }

  /**
   * Detect individual steps (stance phases) from a single foot's force data.
   */
  function _detectSteps(timestamps, forceData, sampleRate, config, foot) {
    const steps = [];
    const threshold = config.forceThreshold;
    const minSamples = Math.floor(config.minStanceDuration / 1000 * sampleRate);
    const maxStepSamples = Math.floor(config.maxStepDuration / 1000 * sampleRate);

    let inContact = false;
    let contactStart = -1;
    let peakForce = 0;
    let peakIdx = -1;

    for (let i = 0; i < forceData.length; i++) {
      const f = forceData[i];

      if (!inContact && f > threshold) {
        // Foot contact begins
        inContact = true;
        contactStart = i;
        peakForce = f;
        peakIdx = i;
      } else if (inContact && f > peakForce) {
        peakForce = f;
        peakIdx = i;
      }

      if (inContact && (f <= threshold || i === forceData.length - 1)) {
        // Foot contact ends
        inContact = false;
        const contactEnd = i;
        const duration = contactEnd - contactStart;

        if (duration >= minSamples && duration <= maxStepSamples) {
          const stanceStart = timestamps[contactStart];
          const stanceEnd = timestamps[contactEnd];
          const contactTimeMs = (stanceEnd - stanceStart) * 1000;

          // Compute loading rate (force rise from contact to first peak)
          const timeToPeak = (timestamps[peakIdx] - stanceStart);
          const loadingRate = timeToPeak > 0 ? peakForce / timeToPeak : 0;

          // Compute impulse (area under force curve)
          let impulse = 0;
          for (let j = contactStart; j < contactEnd; j++) {
            impulse += forceData[j] / sampleRate;
          }

          steps.push({
            foot,
            stanceStart,
            stanceEnd,
            contactTime: contactTimeMs,
            peakForce,
            peakTime: timestamps[peakIdx],
            loadingRate,
            impulse,
            stepDuration: 0,  // filled in later
            cadence: 0,       // filled in later
            stepNumber: 0,    // filled in later
          });
        }
      }
    }

    return steps;
  }

  /**
   * Compute inter-step metrics: step duration and cadence.
   */
  function _computeInterStepMetrics(allSteps) {
    for (let i = 0; i < allSteps.length; i++) {
      if (i < allSteps.length - 1) {
        const dt = (allSteps[i + 1].stanceStart - allSteps[i].stanceStart) * 1000;
        allSteps[i].stepDuration = dt;
        allSteps[i].cadence = dt > 0 ? (60000 / dt) : 0;
      } else {
        // Last step: use previous step's metrics
        if (i > 0) {
          allSteps[i].stepDuration = allSteps[i - 1].stepDuration;
          allSteps[i].cadence = allSteps[i - 1].cadence;
        }
      }
    }
  }

  /**
   * Compute summary statistics grouped by foot.
   */
  function _computeSummary(allSteps, config) {
    const leftSteps = allSteps.filter(s => s.foot === 'Left');
    const rightSteps = allSteps.filter(s => s.foot === 'Right');

    const leftStats = _computeFootStats(leftSteps);
    const rightStats = _computeFootStats(rightSteps);

    // Symmetry index: |L - R| / ((L + R) / 2) * 100
    const symmetry = {
      peakForce: _symmetryIndex(leftStats.peakForce.mean, rightStats.peakForce.mean),
      contactTime: _symmetryIndex(leftStats.contactTime.mean, rightStats.contactTime.mean),
      cadence: _symmetryIndex(leftStats.cadence.mean, rightStats.cadence.mean),
      loadingRate: _symmetryIndex(leftStats.loadingRate.mean, rightStats.loadingRate.mean),
      impulse: _symmetryIndex(leftStats.impulse.mean, rightStats.impulse.mean),
    };

    // Flag alerts
    const alerts = [];
    const thresh = config.asymmetryAlertThreshold;
    if (symmetry.peakForce > thresh) {
      alerts.push({ param: 'Peak Force', value: symmetry.peakForce, severity: symmetry.peakForce > thresh * 2 ? 'alert' : 'warn' });
    }
    if (symmetry.contactTime > thresh) {
      alerts.push({ param: 'Contact Time', value: symmetry.contactTime, severity: symmetry.contactTime > thresh * 2 ? 'alert' : 'warn' });
    }
    if (symmetry.loadingRate > thresh) {
      alerts.push({ param: 'Loading Rate', value: symmetry.loadingRate, severity: symmetry.loadingRate > thresh * 2 ? 'alert' : 'warn' });
    }

    // Overall metrics
    const allPeaks = allSteps.map(s => s.peakForce);
    const allCadence = allSteps.map(s => s.cadence).filter(c => c > 0);

    return {
      left: leftStats,
      right: rightStats,
      symmetry,
      alerts,
      overall: {
        totalSteps: allSteps.length,
        leftSteps: leftSteps.length,
        rightSteps: rightSteps.length,
        avgCadence: _mean(allCadence),
        avgPeakForce: _mean(allPeaks),
        walkingSpeed: null, // Would need distance data
      },
    };
  }

  /**
   * Compute statistics for a single foot's steps.
   */
  function _computeFootStats(steps) {
    if (steps.length === 0) {
      const empty = { mean: 0, std: 0, min: 0, max: 0 };
      return { peakForce: empty, contactTime: empty, cadence: empty, loadingRate: empty, impulse: empty, stepDuration: empty };
    }

    return {
      peakForce: _stats(steps.map(s => s.peakForce)),
      contactTime: _stats(steps.map(s => s.contactTime)),
      cadence: _stats(steps.map(s => s.cadence).filter(c => c > 0)),
      loadingRate: _stats(steps.map(s => s.loadingRate)),
      impulse: _stats(steps.map(s => s.impulse)),
      stepDuration: _stats(steps.map(s => s.stepDuration).filter(d => d > 0)),
    };
  }

  /**
   * Compute gait cycle information.
   */
  function _computeGaitCycle(allSteps, totalDuration) {
    if (allSteps.length === 0) {
      return { avgStancePercent: 0, avgSwingPercent: 0, strideDuration: 0 };
    }

    const stanceTimes = allSteps.map(s => s.contactTime);
    const stepDurations = allSteps.map(s => s.stepDuration).filter(d => d > 0);
    const avgContactTime = _mean(stanceTimes);
    const avgStepDuration = _mean(stepDurations);

    // Stride = 2 steps (left + right)
    const strideDuration = avgStepDuration * 2;
    const avgStancePercent = strideDuration > 0 ? (avgContactTime / strideDuration) * 100 : 62;
    const avgSwingPercent = 100 - avgStancePercent;

    return {
      avgStancePercent,
      avgSwingPercent,
      strideDuration,
      avgContactTime,
      avgStepDuration,
    };
  }

  // --- Utility functions ---

  function _mean(arr) {
    if (arr.length === 0) return 0;
    return arr.reduce((sum, v) => sum + v, 0) / arr.length;
  }

  function _std(arr) {
    if (arr.length < 2) return 0;
    const m = _mean(arr);
    const variance = arr.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (arr.length - 1);
    return Math.sqrt(variance);
  }

  function _stats(arr) {
    if (arr.length === 0) return { mean: 0, std: 0, min: 0, max: 0 };
    return {
      mean: _mean(arr),
      std: _std(arr),
      min: Math.min(...arr),
      max: Math.max(...arr),
    };
  }

  function _symmetryIndex(left, right) {
    const avg = (left + right) / 2;
    if (avg === 0) return 0;
    return Math.abs(left - right) / avg * 100;
  }

  /**
   * Update settings and return merged config.
   */
  function getSettings(overrides = {}) {
    return { ...DEFAULT_SETTINGS, ...overrides };
  }

  // Public API
  return {
    analyze,
    getSettings,
    DEFAULT_SETTINGS,
  };
})();
