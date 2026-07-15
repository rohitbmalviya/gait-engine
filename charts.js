/* ============================================================
   GAIT ANALYSIS — Chart Visualizations (Chart.js)
   ============================================================ */

const GaitCharts = (() => {
  'use strict';

  // Chart instances (for cleanup)
  const _charts = {};

  // Color constants
  const COLORS = {
    cyan: '#00e5ff',
    cyanAlpha: 'rgba(0, 229, 255, 0.15)',
    magenta: '#ff4081',
    magentaAlpha: 'rgba(255, 64, 129, 0.15)',
    green: '#00e676',
    greenAlpha: 'rgba(0, 230, 118, 0.15)',
    amber: '#ffab40',
    amberAlpha: 'rgba(255, 171, 64, 0.15)',
    purple: '#b388ff',
    purpleAlpha: 'rgba(179, 136, 255, 0.15)',
    gridColor: 'rgba(255, 255, 255, 0.04)',
    tickColor: 'rgba(255, 255, 255, 0.3)',
    textColor: '#9fa8c7',
  };

  // Common chart options
  const _baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        align: 'end',
        labels: {
          color: COLORS.textColor,
          font: { family: 'Inter', size: 12, weight: '500' },
          padding: 16,
          usePointStyle: true,
          pointStyleWidth: 10,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(10, 14, 30, 0.95)',
        titleColor: '#e8eaf6',
        bodyColor: '#9fa8c7',
        borderColor: 'rgba(255,255,255,0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12,
        titleFont: { family: 'Inter', size: 13, weight: '600' },
        bodyFont: { family: 'Inter', size: 12 },
        displayColors: true,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { color: COLORS.gridColor, drawBorder: false },
        ticks: { color: COLORS.tickColor, font: { family: 'Inter', size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: COLORS.gridColor, drawBorder: false },
        ticks: { color: COLORS.tickColor, font: { family: 'Inter', size: 11 } },
        border: { display: false },
      },
    },
  };

  /**
   * Destroy a chart by key if it exists.
   */
  function _destroyChart(key) {
    if (_charts[key]) {
      _charts[key].destroy();
      delete _charts[key];
    }
  }

  /**
   * Deep merge helper for chart options.
   */
  function _deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = _deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  }

  // ============================================================
  // CHART 1: Force-Time Line Graph
  // ============================================================

  /**
   * Render the force-time graph.
   * @param {string} canvasId
   * @param {object} rawData - { timestamps, leftForce, rightForce }
   * @param {object} opts - { downsampleFactor }
   */
  function renderForceTimeGraph(canvasId, rawData, opts = {}) {
    _destroyChart('forceTime');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { downsampleFactor = 4 } = opts;

    // Downsample for performance
    const labels = [];
    const leftData = [];
    const rightData = [];

    for (let i = 0; i < rawData.timestamps.length; i += downsampleFactor) {
      labels.push(rawData.timestamps[i].toFixed(2));
      leftData.push(rawData.leftForce[i]);
      rightData.push(rawData.rightForce[i]);
    }

    const config = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Left Foot',
            data: leftData,
            borderColor: COLORS.cyan,
            backgroundColor: COLORS.cyanAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            order: 1,
          },
          {
            label: 'Right Foot',
            data: rightData,
            borderColor: COLORS.magenta,
            backgroundColor: COLORS.magentaAlpha,
            fill: true,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.3,
            order: 2,
          },
        ],
      },
      options: _deepMerge(_baseOptions, {
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => ctx.dataset.label + ': ' + ctx.parsed.y.toFixed(1) + ' N',
              title: (items) => 'Time: ' + items[0].label + ' s',
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Time (s)', color: COLORS.textColor, font: { family: 'Inter', size: 12 } },
            ticks: {
              maxTicksLimit: 15,
              callback: function(value, index) {
                const v = parseFloat(this.getLabelForValue(value));
                return (v % 1 === 0) ? v + 's' : '';
              }
            },
          },
          y: {
            title: { display: true, text: 'Force (N)', color: COLORS.textColor, font: { family: 'Inter', size: 12 } },
            beginAtZero: true,
          },
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
      }),
    };

    _charts['forceTime'] = new Chart(canvas, config);
  }

  // ============================================================
  // CHART 2: Step Parameter Bar Chart
  // ============================================================

  /**
   * Render per-step parameter comparison.
   * @param {string} canvasId
   * @param {object} analysisResults
   * @param {string} parameter - 'peakForce', 'contactTime', 'cadence', 'loadingRate'
   */
  function renderStepParameterChart(canvasId, analysisResults, parameter = 'peakForce') {
    _destroyChart('stepParam');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { leftSteps, rightSteps } = analysisResults;
    const maxSteps = Math.max(leftSteps.length, rightSteps.length);
    const labels = [];
    const leftData = [];
    const rightData = [];

    for (let i = 0; i < maxSteps; i++) {
      labels.push('Step ' + (i + 1));
      leftData.push(leftSteps[i] ? leftSteps[i][parameter] : null);
      rightData.push(rightSteps[i] ? rightSteps[i][parameter] : null);
    }

    const paramLabels = {
      peakForce: 'Peak Force (N)',
      contactTime: 'Contact Time (ms)',
      cadence: 'Cadence (steps/min)',
      loadingRate: 'Loading Rate (N/s)',
      impulse: 'Impulse (N·s)',
    };

    const config = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Left Foot',
            data: leftData,
            backgroundColor: COLORS.cyanAlpha,
            borderColor: COLORS.cyan,
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          },
          {
            label: 'Right Foot',
            data: rightData,
            backgroundColor: COLORS.magentaAlpha,
            borderColor: COLORS.magenta,
            borderWidth: 1,
            borderRadius: 4,
            barPercentage: 0.7,
            categoryPercentage: 0.8,
          },
        ],
      },
      options: _deepMerge(_baseOptions, {
        scales: {
          x: { title: { display: true, text: 'Steps', color: COLORS.textColor, font: { family: 'Inter', size: 12 } } },
          y: {
            title: { display: true, text: paramLabels[parameter] || parameter, color: COLORS.textColor, font: { family: 'Inter', size: 12 } },
            beginAtZero: true,
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed.y;
                return ctx.dataset.label + ': ' + (val !== null ? val.toFixed(1) : 'N/A');
              },
            },
          },
        },
      }),
    };

    _charts['stepParam'] = new Chart(canvas, config);
  }

  // ============================================================
  // CHART 3: Symmetry Radar Chart
  // ============================================================

  /**
   * Render left vs right symmetry radar.
   * @param {string} canvasId
   * @param {object} summary - from analysisResults.summary
   */
  function renderSymmetryRadar(canvasId, summary) {
    _destroyChart('symmetry');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const params = ['peakForce', 'contactTime', 'cadence', 'loadingRate', 'impulse'];
    const paramLabels = ['Peak Force', 'Contact Time', 'Cadence', 'Loading Rate', 'Impulse'];

    // Normalize values to 0–100 scale for radar
    const leftValues = params.map(p => {
      const lv = summary.left[p].mean;
      const rv = summary.right[p].mean;
      const maxVal = Math.max(lv, rv) || 1;
      return (lv / maxVal) * 100;
    });

    const rightValues = params.map(p => {
      const lv = summary.left[p].mean;
      const rv = summary.right[p].mean;
      const maxVal = Math.max(lv, rv) || 1;
      return (rv / maxVal) * 100;
    });

    const config = {
      type: 'radar',
      data: {
        labels: paramLabels,
        datasets: [
          {
            label: 'Left Foot',
            data: leftValues,
            borderColor: COLORS.cyan,
            backgroundColor: COLORS.cyanAlpha,
            borderWidth: 2,
            pointBackgroundColor: COLORS.cyan,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
          {
            label: 'Right Foot',
            data: rightValues,
            borderColor: COLORS.magenta,
            backgroundColor: COLORS.magentaAlpha,
            borderWidth: 2,
            pointBackgroundColor: COLORS.magenta,
            pointRadius: 4,
            pointHoverRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: {
              color: COLORS.textColor,
              font: { family: 'Inter', size: 12, weight: '500' },
              padding: 16,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(10, 14, 30, 0.95)',
            titleColor: '#e8eaf6',
            bodyColor: '#9fa8c7',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 12,
          },
        },
        scales: {
          r: {
            angleLines: { color: 'rgba(255, 255, 255, 0.06)' },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            pointLabels: {
              color: COLORS.textColor,
              font: { family: 'Inter', size: 11, weight: '500' },
            },
            ticks: {
              color: COLORS.tickColor,
              backdropColor: 'transparent',
              font: { size: 10 },
            },
            beginAtZero: true,
            max: 110,
          },
        },
      },
    };

    _charts['symmetry'] = new Chart(canvas, config);
  }

  // ============================================================
  // CHART 4: Gait Cycle Doughnut
  // ============================================================

  /**
   * Render stance vs swing phase doughnut.
   * @param {string} canvasId
   * @param {object} gaitCycle - from analysisResults.gaitCycle
   */
  function renderGaitCycleDoughnut(canvasId, gaitCycle) {
    _destroyChart('gaitCycle');

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const config = {
      type: 'doughnut',
      data: {
        labels: ['Stance Phase', 'Swing Phase'],
        datasets: [{
          data: [
            gaitCycle.avgStancePercent.toFixed(1),
            gaitCycle.avgSwingPercent.toFixed(1),
          ],
          backgroundColor: [COLORS.cyanAlpha, COLORS.magentaAlpha],
          borderColor: [COLORS.cyan, COLORS.magenta],
          borderWidth: 2,
          hoverOffset: 8,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '65%',
        animation: { duration: 800, easing: 'easeOutQuart' },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: COLORS.textColor,
              font: { family: 'Inter', size: 12 },
              padding: 20,
              usePointStyle: true,
            },
          },
          tooltip: {
            backgroundColor: 'rgba(10, 14, 30, 0.95)',
            titleColor: '#e8eaf6',
            bodyColor: '#9fa8c7',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1,
            cornerRadius: 8,
            callbacks: {
              label: (ctx) => ctx.label + ': ' + ctx.parsed + '%',
            },
          },
        },
      },
    };

    _charts['gaitCycle'] = new Chart(canvas, config);
  }

  // ============================================================
  // CHART 5: Mini sparkline for dashboard
  // ============================================================

  /**
   * Render a small sparkline-style chart.
   * @param {string} canvasId
   * @param {number[]} data
   * @param {string} color
   */
  function renderSparkline(canvasId, data, color = COLORS.cyan) {
    const key = 'spark_' + canvasId;
    _destroyChart(key);

    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const alphaColor = color.replace(')', ', 0.15)').replace('rgb(', 'rgba(');

    _charts[key] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: data.map((_, i) => i),
        datasets: [{
          data,
          borderColor: color,
          backgroundColor: alphaColor,
          fill: true,
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { display: false },
          y: { display: false },
        },
        animation: { duration: 600 },
      },
    });
  }

  /**
   * Destroy all chart instances.
   */
  function destroyAll() {
    for (const key of Object.keys(_charts)) {
      if (_charts[key]) {
        _charts[key].destroy();
        delete _charts[key];
      }
    }
  }

  // Public API
  return {
    renderForceTimeGraph,
    renderStepParameterChart,
    renderSymmetryRadar,
    renderGaitCycleDoughnut,
    renderSparkline,
    destroyAll,
    COLORS,
  };
})();
