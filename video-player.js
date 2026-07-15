/* ============================================================
   VIDEO PLAYER — Video + Skeleton Canvas Overlay + Sync Engine
   Handles video playback, skeleton rendering, and data sync.
   ============================================================ */

const VideoPlayer = (() => {
  'use strict';

  // --- State ---
  let _state = {
    videoEl: null,
    canvasEl: null,
    ctx: null,
    skeletonData: null,
    angleSeries: null,
    gaitEvents: null,
    isPlaying: false,
    currentFrameIdx: 0,
    totalDataFrames: 0,
    animFrameId: null,
    playbackSpeed: 1.0,
    showSkeleton: true,
    showAngles: true,
    onFrameUpdate: null, // callback
  };

  // --- Color scheme matching GaitPro design ---
  const COLORS = {
    leftSide: '#00e5ff',     // cyan
    rightSide: '#ff4081',    // magenta
    torso: '#b388ff',        // purple
    face: '#ffab40',         // amber
    joint: '#ffffff',
    jointGlow: 'rgba(0, 229, 255, 0.4)',
    bone: 'rgba(255, 255, 255, 0.7)',
    angleText: '#00e676',
  };

  /**
   * Initialize the video player module.
   * @param {object} options
   */
  function init(options = {}) {
    _state.videoEl = options.videoEl || document.getElementById('video-player');
    _state.canvasEl = options.canvasEl || document.getElementById('skeleton-canvas');
    _state.onFrameUpdate = options.onFrameUpdate || null;

    if (_state.canvasEl) {
      _state.ctx = _state.canvasEl.getContext('2d');
    }

    _bindVideoEvents();
  }

  /**
   * Load skeleton data from parsed CSV.
   * @param {object} parsedData - from SkeletonData.parseCSV()
   */
  function loadSkeletonData(parsedData) {
    _state.skeletonData = parsedData;
    _state.totalDataFrames = parsedData.dataFrames;
    _state.currentFrameIdx = 0;

    // Pre-compute all angles
    _state.angleSeries = SkeletonData.computeAllAngles(parsedData.frames);

    // Detect gait events
    _state.gaitEvents = SkeletonData.detectGaitEvents(parsedData.frames);
  }

  /**
   * Load a video file (from File input).
   * @param {File} videoFile
   */
  function loadVideoFile(videoFile) {
    if (!_state.videoEl) return;

    const url = URL.createObjectURL(videoFile);
    _state.videoEl.src = url;
    _state.videoEl.load();
  }

  /**
   * Load video from a URL path.
   * @param {string} videoUrl
   */
  function loadVideoUrl(videoUrl) {
    if (!_state.videoEl) return;
    _state.videoEl.src = videoUrl;
    _state.videoEl.load();
  }

  // ============================================================
  // VIDEO EVENT BINDING
  // ============================================================

  function _bindVideoEvents() {
    if (!_state.videoEl) return;

    _state.videoEl.addEventListener('play', () => {
      _state.isPlaying = true;
      _renderLoop();
    });

    _state.videoEl.addEventListener('pause', () => {
      _state.isPlaying = false;
      if (_state.animFrameId) {
        cancelAnimationFrame(_state.animFrameId);
        _state.animFrameId = null;
      }
    });

    _state.videoEl.addEventListener('seeked', () => {
      _syncFrameToVideo();
      _renderCurrentFrame();
    });

    _state.videoEl.addEventListener('ended', () => {
      _state.isPlaying = false;
    });

    _state.videoEl.addEventListener('loadedmetadata', () => {
      _resizeCanvas();
    });

    // Handle window resize
    window.addEventListener('resize', _resizeCanvas);
  }

  // ============================================================
  // RENDER LOOP
  // ============================================================

  function _renderLoop() {
    if (!_state.isPlaying) return;

    _syncFrameToVideo();
    _renderCurrentFrame();

    _state.animFrameId = requestAnimationFrame(_renderLoop);
  }

  /**
   * Sync the current skeleton frame to the video's current time.
   */
  function _syncFrameToVideo() {
    if (!_state.videoEl || !_state.skeletonData) return;

    const videoDuration = _state.videoEl.duration;
    const currentTime = _state.videoEl.currentTime;

    if (videoDuration <= 0) return;

    const normalizedTime = currentTime / videoDuration;
    const dataFrames = _state.skeletonData.frames.filter(f => f.hasData);
    const frameIdx = Math.round(normalizedTime * (dataFrames.length - 1));
    _state.currentFrameIdx = Math.max(0, Math.min(dataFrames.length - 1, frameIdx));

    // Fire callback
    if (_state.onFrameUpdate) {
      _state.onFrameUpdate({
        frameIndex: _state.currentFrameIdx,
        totalFrames: dataFrames.length,
        normalizedTime,
        currentTime,
        videoDuration,
      });
    }
  }

  /**
   * Render the current skeleton frame on the canvas.
   */
  function _renderCurrentFrame() {
    if (!_state.ctx || !_state.skeletonData || !_state.showSkeleton) return;

    const frame = SkeletonData.getDataFrame(
      _state.skeletonData.frames,
      _state.currentFrameIdx
    );

    if (!frame || !frame.landmarks) {
      _clearCanvas();
      return;
    }

    _clearCanvas();
    _drawSkeleton(frame.landmarks);

    if (_state.showAngles) {
      _drawAngleLabels(frame.landmarks);
    }
  }

  // ============================================================
  // CANVAS RENDERING
  // ============================================================

  function _resizeCanvas() {
    if (!_state.canvasEl || !_state.videoEl) return;

    const container = _state.canvasEl.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    _state.canvasEl.width = rect.width;
    _state.canvasEl.height = rect.height;

    // Re-render after resize
    if (_state.skeletonData) {
      _renderCurrentFrame();
    }
  }

  function _clearCanvas() {
    if (!_state.ctx || !_state.canvasEl) return;
    _state.ctx.clearRect(0, 0, _state.canvasEl.width, _state.canvasEl.height);
  }

  /**
   * Draw the full skeleton on the canvas.
   * @param {Array} landmarks - 33 landmark positions (x, y normalized 0-1)
   */
  function _drawSkeleton(landmarks) {
    const ctx = _state.ctx;
    const w = _state.canvasEl.width;
    const h = _state.canvasEl.height;

    // Draw connections (bones)
    SkeletonData.CONNECTIONS.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];

      if (start.visibility < 0.3 || end.visibility < 0.3) return;

      const color = _getConnectionColor(startIdx, endIdx);

      ctx.beginPath();
      ctx.moveTo(start.x * w, start.y * h);
      ctx.lineTo(end.x * w, end.y * h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.globalAlpha = Math.min(start.visibility, end.visibility);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // Draw joints
    landmarks.forEach((lm, idx) => {
      if (lm.visibility < 0.3) return;

      const x = lm.x * w;
      const y = lm.y * h;
      const radius = _isKeyJoint(idx) ? 6 : 4;

      // Glow effect for key joints
      if (_isKeyJoint(idx)) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = _getJointGlowColor(idx);
        ctx.globalAlpha = 0.4 * lm.visibility;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Joint circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = _getJointColor(idx);
      ctx.globalAlpha = lm.visibility;
      ctx.fill();

      // Border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  }

  /**
   * Draw angle labels near key joints.
   */
  function _drawAngleLabels(landmarks) {
    const ctx = _state.ctx;
    const w = _state.canvasEl.width;
    const h = _state.canvasEl.height;
    const angles = SkeletonData.computeJointAngles(landmarks);

    if (!angles) return;

    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'center';

    const labels = [
      { angle: angles.leftKnee, lm: landmarks[SkeletonData.LANDMARKS.LEFT_KNEE], label: 'L Knee', color: COLORS.leftSide },
      { angle: angles.rightKnee, lm: landmarks[SkeletonData.LANDMARKS.RIGHT_KNEE], label: 'R Knee', color: COLORS.rightSide },
      { angle: angles.leftHip, lm: landmarks[SkeletonData.LANDMARKS.LEFT_HIP], label: 'L Hip', color: COLORS.leftSide },
      { angle: angles.rightHip, lm: landmarks[SkeletonData.LANDMARKS.RIGHT_HIP], label: 'R Hip', color: COLORS.rightSide },
    ];

    labels.forEach(({ angle, lm, label, color }) => {
      if (!lm || lm.visibility < 0.5) return;

      const x = lm.x * w;
      const y = lm.y * h;

      // Background pill
      const text = Math.round(angle) + '°';
      const metrics = ctx.measureText(text);
      const textW = metrics.width + 12;
      const textH = 18;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      _roundRect(ctx, x + 10, y - textH / 2 - 1, textW, textH, 4);
      ctx.fill();

      ctx.fillStyle = color;
      ctx.fillText(text, x + 10 + textW / 2, y + 4);
    });
  }

  function _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  // ============================================================
  // COLOR HELPERS
  // ============================================================

  function _getConnectionColor(startIdx, endIdx) {
    const leftJoints = SkeletonData.BODY_PARTS.leftArm.concat(SkeletonData.BODY_PARTS.leftLeg);
    const rightJoints = SkeletonData.BODY_PARTS.rightArm.concat(SkeletonData.BODY_PARTS.rightLeg);

    if (leftJoints.includes(startIdx) && leftJoints.includes(endIdx)) return COLORS.leftSide;
    if (rightJoints.includes(startIdx) && rightJoints.includes(endIdx)) return COLORS.rightSide;
    if (SkeletonData.BODY_PARTS.torso.includes(startIdx) && SkeletonData.BODY_PARTS.torso.includes(endIdx)) return COLORS.torso;
    if (SkeletonData.BODY_PARTS.face.includes(startIdx) || SkeletonData.BODY_PARTS.face.includes(endIdx)) return COLORS.face;
    return COLORS.bone;
  }

  function _getJointColor(idx) {
    const leftJoints = SkeletonData.BODY_PARTS.leftArm.concat(SkeletonData.BODY_PARTS.leftLeg);
    const rightJoints = SkeletonData.BODY_PARTS.rightArm.concat(SkeletonData.BODY_PARTS.rightLeg);

    if (leftJoints.includes(idx)) return COLORS.leftSide;
    if (rightJoints.includes(idx)) return COLORS.rightSide;
    if (SkeletonData.BODY_PARTS.face.includes(idx)) return COLORS.face;
    return COLORS.joint;
  }

  function _getJointGlowColor(idx) {
    const leftJoints = SkeletonData.BODY_PARTS.leftArm.concat(SkeletonData.BODY_PARTS.leftLeg);
    const rightJoints = SkeletonData.BODY_PARTS.rightArm.concat(SkeletonData.BODY_PARTS.rightLeg);

    if (leftJoints.includes(idx)) return 'rgba(0, 229, 255, 0.4)';
    if (rightJoints.includes(idx)) return 'rgba(255, 64, 129, 0.4)';
    return 'rgba(255, 255, 255, 0.3)';
  }

  function _isKeyJoint(idx) {
    const keyJoints = [
      SkeletonData.LANDMARKS.LEFT_SHOULDER, SkeletonData.LANDMARKS.RIGHT_SHOULDER,
      SkeletonData.LANDMARKS.LEFT_ELBOW, SkeletonData.LANDMARKS.RIGHT_ELBOW,
      SkeletonData.LANDMARKS.LEFT_WRIST, SkeletonData.LANDMARKS.RIGHT_WRIST,
      SkeletonData.LANDMARKS.LEFT_HIP, SkeletonData.LANDMARKS.RIGHT_HIP,
      SkeletonData.LANDMARKS.LEFT_KNEE, SkeletonData.LANDMARKS.RIGHT_KNEE,
      SkeletonData.LANDMARKS.LEFT_ANKLE, SkeletonData.LANDMARKS.RIGHT_ANKLE,
      SkeletonData.LANDMARKS.NOSE,
    ];
    return keyJoints.includes(idx);
  }

  // ============================================================
  // PUBLIC CONTROLS
  // ============================================================

  function play() {
    if (_state.videoEl) {
      const playPromise = _state.videoEl.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Playback error:", error);
          if (error.name === 'NotSupportedError') {
            alert("Error: Your browser does not support playing this video format (e.g. AVI). Please use an MP4 file instead.");
          }
        });
      }
    }
  }

  function pause() {
    if (_state.videoEl) _state.videoEl.pause();
  }

  function togglePlayPause() {
    if (_state.videoEl) {
      if (_state.videoEl.paused) {
        play();
      } else {
        pause();
      }
    }
  }

  function seek(normalizedTime) {
    if (_state.videoEl && _state.videoEl.duration) {
      _state.videoEl.currentTime = normalizedTime * _state.videoEl.duration;
    }
  }

  function setPlaybackSpeed(speed) {
    _state.playbackSpeed = speed;
    if (_state.videoEl) _state.videoEl.playbackRate = speed;
  }

  function setShowSkeleton(show) {
    _state.showSkeleton = show;
    if (!show) _clearCanvas();
    else _renderCurrentFrame();
  }

  function setShowAngles(show) {
    _state.showAngles = show;
    _renderCurrentFrame();
  }

  function stepForward() {
    if (!_state.videoEl || !_state.skeletonData) return;
    const dataFrames = _state.skeletonData.frames.filter(f => f.hasData);
    const step = _state.videoEl.duration / dataFrames.length;
    _state.videoEl.currentTime = Math.min(
      _state.videoEl.duration,
      _state.videoEl.currentTime + step
    );
  }

  function stepBackward() {
    if (!_state.videoEl || !_state.skeletonData) return;
    const dataFrames = _state.skeletonData.frames.filter(f => f.hasData);
    const step = _state.videoEl.duration / dataFrames.length;
    _state.videoEl.currentTime = Math.max(0, _state.videoEl.currentTime - step);
  }

  function getCurrentAngles() {
    if (!_state.skeletonData) return null;
    const frame = SkeletonData.getDataFrame(
      _state.skeletonData.frames,
      _state.currentFrameIdx
    );
    if (!frame || !frame.landmarks) return null;
    return SkeletonData.computeJointAngles(frame.landmarks);
  }

  function getCurrentGaitPhase() {
    if (!_state.skeletonData) return null;
    const frame = SkeletonData.getDataFrame(
      _state.skeletonData.frames,
      _state.currentFrameIdx
    );
    if (!frame || !frame.landmarks) return null;
    return SkeletonData.getGaitPhase(frame.landmarks);
  }

  function getState() {
    return {
      isPlaying: _state.isPlaying,
      currentFrameIdx: _state.currentFrameIdx,
      totalDataFrames: _state.totalDataFrames,
      playbackSpeed: _state.playbackSpeed,
      showSkeleton: _state.showSkeleton,
      showAngles: _state.showAngles,
      angleSeries: _state.angleSeries,
      gaitEvents: _state.gaitEvents,
      videoEl: _state.videoEl,
    };
  }

  function destroy() {
    if (_state.animFrameId) {
      cancelAnimationFrame(_state.animFrameId);
    }
    if (_state.videoEl && _state.videoEl.src) {
      URL.revokeObjectURL(_state.videoEl.src);
    }
    _state.skeletonData = null;
    _state.angleSeries = null;
    _state.gaitEvents = null;
  }

  // Public API
  return {
    init,
    loadSkeletonData,
    loadVideoFile,
    loadVideoUrl,
    play,
    pause,
    togglePlayPause,
    seek,
    setPlaybackSpeed,
    setShowSkeleton,
    setShowAngles,
    stepForward,
    stepBackward,
    getCurrentAngles,
    getCurrentGaitPhase,
    getState,
    destroy,
  };
})();
