/* ============================================================
   VIDEO CHARTS — Real-time Joint Angle Charts
   Updates as video plays, showing angle timelines with playhead.
   ============================================================ */

const VideoCharts = (() => {
  'use strict';

  const _charts = {};

  const COLORS = {
    cyan: '#00e5ff',
    cyanAlpha: 'rgba(0, 229, 255, 0.12)',
    magenta: '#ff4081',
    magentaAlpha: 'rgba(255, 64, 129, 0.12)',
    green: '#00e676',
    greenAlpha: 'rgba(0, 230, 118, 0.12)',
    purple: '#b388ff',
    purpleAlpha: 'rgba(179, 136, 255, 0.12)',
    amber: '#ffab40',
    amberAlpha: 'rgba(255, 171, 64, 0.12)',
    playhead: '#ffffff',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    tickColor: 'rgba(255, 255, 255, 0.3)',
    textColor: '#9fa8c7',
  };

  // Playhead plugin for Chart.js
  const playheadPlugin = {
    id: 'playheadLine',
    afterDraw(chart) {
      const playheadIdx = chart.config._playheadIdx;
      if (playheadIdx == null || playheadIdx < 0) return;

      const labels = chart.data.labels;
      if (!labels || playheadIdx >= labels.length) return;

      const xScale = chart.scales.x;
      const yScale = chart.scales.y;
      const x = xScale.getPixelForValue(labels[playheadIdx]);
      const ctx = chart.ctx;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x, yScale.top);
      ctx.lineTo(x, yScale.bottom);
      ctx.lineWidth = 2;
      ctx.strokeStyle = COLORS.playhead;
      ctx.globalAlpha = 0.8;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.restore();

      // Draw playhead dot
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, yScale.top - 4, 5, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.playhead;
      ctx.fill();
      ctx.restore();
    },
  };

  // Register the plugin globally
  if (typeof Chart !== 'undefined') {
    Chart.register(playheadPlugin);
  }

  function _destroyChart(key) {
    if (_charts[key]) {
      _charts[key].destroy();
      delete _charts[key];
    }
  }

  // ============================================================
  // KNEE ANGLE CHART
  // ============================================================

  /**
   * Render the knee flexion angle timeline.
   * @param {string} canvasId
   * @param {object} angleSeries - from SkeletonData.computeAllAngles()
   */
  function renderKneeAngleChart(canvasId, angleSeries) {
    _destroyChart('kneeAngle');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = angleSeries.frameIndices.map(i => i);

    const config = {
      type: 'line',
      _playheadIdx: -1,
      data: {
        labels,
        datasets: [
          {
            label: 'Left Knee',
            data: angleSeries.leftKnee,
            borderColor: COLORS.cyan,
            backgroundColor: COLORS.cyanAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: 'Right Knee',
            data: angleSeries.rightKnee,
            borderColor: COLORS.magenta,
            backgroundColor: COLORS.magentaAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: _getChartOptions('Knee Flexion Angle (°)', 'Frame'),
    };

    _charts['kneeAngle'] = new Chart(canvas, config);
  }

  // ============================================================
  // HIP ANGLE CHART
  // ============================================================

  function renderHipAngleChart(canvasId, angleSeries) {
    _destroyChart('hipAngle');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = angleSeries.frameIndices.map(i => i);

    const config = {
      type: 'line',
      _playheadIdx: -1,
      data: {
        labels,
        datasets: [
          {
            label: 'Left Hip',
            data: angleSeries.leftHip,
            borderColor: COLORS.cyan,
            backgroundColor: COLORS.cyanAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: 'Right Hip',
            data: angleSeries.rightHip,
            borderColor: COLORS.magenta,
            backgroundColor: COLORS.magentaAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: _getChartOptions('Hip Flexion Angle (°)', 'Frame'),
    };

    _charts['hipAngle'] = new Chart(canvas, config);
  }

  // ============================================================
  // ANKLE ANGLE CHART
  // ============================================================

  function renderAnkleAngleChart(canvasId, angleSeries) {
    _destroyChart('ankleAngle');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = angleSeries.frameIndices.map(i => i);

    const config = {
      type: 'line',
      _playheadIdx: -1,
      data: {
        labels,
        datasets: [
          {
            label: 'Left Ankle',
            data: angleSeries.leftAnkle,
            borderColor: COLORS.cyan,
            backgroundColor: COLORS.cyanAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
          {
            label: 'Right Ankle',
            data: angleSeries.rightAnkle,
            borderColor: COLORS.magenta,
            backgroundColor: COLORS.magentaAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: _getChartOptions('Ankle Angle (°)', 'Frame'),
    };

    _charts['ankleAngle'] = new Chart(canvas, config);
  }

  // ============================================================
  // TRUNK LEAN CHART
  // ============================================================

  function renderTrunkLeanChart(canvasId, angleSeries) {
    _destroyChart('trunkLean');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const labels = angleSeries.frameIndices.map(i => i);

    const config = {
      type: 'line',
      _playheadIdx: -1,
      data: {
        labels,
        datasets: [
          {
            label: 'Trunk Lean',
            data: angleSeries.trunkLean,
            borderColor: COLORS.purple,
            backgroundColor: COLORS.purpleAlpha,
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
          },
        ],
      },
      options: _getChartOptions('Trunk Lean Angle (°)', 'Frame'),
    };

    _charts['trunkLean'] = new Chart(canvas, config);
  }

  // ============================================================
  // UPDATE PLAYHEAD
  // ============================================================

  /**
   * Move all playheads to the given frame index and update data for progressive plotting.
   * @param {number} frameIdx - Current data frame index
   */
  function updatePlayhead(frameIdx) {
    Object.keys(_charts).forEach(key => {
      const chart = _charts[key];
      if (chart && chart.config.type === 'line') {
        chart.config._playheadIdx = frameIdx;
        
        // Progressive plotting: only show data up to current frame
        chart.data.datasets.forEach(ds => {
          if (!ds._originalData) {
            ds._originalData = [...ds.data];
          }
          // Set values past the current frame to null so they aren't drawn
          for (let i = 0; i < ds.data.length; i++) {
            ds.data[i] = i <= frameIdx ? ds._originalData[i] : null;
          }
        });
        
        chart.update('none'); // no animation for performance
      } else if (chart) {
        chart.update('none');
      }
    });
  }

  // ============================================================
  // ANGLE SUMMARY GAUGE
  // ============================================================

  /**
   * Render a summary doughnut gauge for a single angle.
   * @param {string} canvasId
   * @param {number} angle - Current angle value
   * @param {number} maxAngle - Maximum expected angle
   * @param {string} color - Color string
   */
  function renderAngleGauge(canvasId, angle, maxAngle = 180, color = COLORS.cyan) {
    const key = 'gauge_' + canvasId;
    _destroyChart(key);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const normalizedAngle = Math.min(angle / maxAngle * 100, 100);
    const remaining = 100 - normalizedAngle;

    _charts[key] = new Chart(canvas, {
      type: 'doughnut',
      data: {
        datasets: [{
          data: [normalizedAngle, remaining],
          backgroundColor: [color, 'rgba(255,255,255,0.04)'],
          borderWidth: 0,
          hoverOffset: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '80%',
        rotation: -90,
        circumference: 180,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
        },
        animation: { duration: 200 },
      },
    });
  }

  // ============================================================
  // COMMON OPTIONS
  // ============================================================

  function _getChartOptions(yLabel, xLabel) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          align: 'end',
          labels: {
            color: COLORS.textColor,
            font: { family: 'Inter', size: 11, weight: '500' },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8,
          },
        },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 30, 0.95)',
          titleColor: '#e8eaf6',
          bodyColor: '#9fa8c7',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          cornerRadius: 8,
          padding: 10,
          titleFont: { family: 'Inter', size: 12, weight: '600' },
          bodyFont: { family: 'Inter', size: 11 },
          callbacks: {
            label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + '°',
          },
        },
      },
      scales: {
        x: {
          display: true,
          grid: { color: COLORS.gridColor, drawBorder: false },
          ticks: {
            color: COLORS.tickColor,
            font: { family: 'Inter', size: 10 },
            maxTicksLimit: 10,
            callback: function(val) {
              return '';
            },
          },
          border: { display: false },
          title: {
            display: true,
            text: xLabel,
            color: COLORS.textColor,
            font: { family: 'Inter', size: 11 },
          },
        },
        y: {
          grid: { color: COLORS.gridColor, drawBorder: false },
          ticks: {
            color: COLORS.tickColor,
            font: { family: 'Inter', size: 10 },
          },
          border: { display: false },
          title: {
            display: true,
            text: yLabel,
            color: COLORS.textColor,
            font: { family: 'Inter', size: 11 },
          },
        },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
    };
  }

  function destroyAll() {
    Object.keys(_charts).forEach(key => {
      if (_charts[key]) {
        _charts[key].destroy();
        delete _charts[key];
      }
    });
  }

  // Public API
  return {
    renderKneeAngleChart,
    renderHipAngleChart,
    renderAnkleAngleChart,
    renderTrunkLeanChart,
    updatePlayhead,
    renderAngleGauge,
    destroyAll,
    COLORS,
  };
})();
