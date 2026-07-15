/* ============================================================
   GAIT ANALYSIS DASHBOARD — Core Application Logic
   SPA navigation, event handling, state management
   ============================================================ */

const App = (() => {
  'use strict';

  // --- Bundled demo recording (folder "1") ---
  const DEMO_VIDEO_URL = '1/video_frames_20260423_094132.mp4';
  const DEMO_CSV_URL = '1/skeleton_data_20260423_094132.csv';

  // --- Application State ---
  let _state = {
    currentView: 'dashboard',
    rawData: null,
    analysisResults: null,
    settings: { ...GaitEngine.DEFAULT_SETTINGS },
    dataLoaded: false,
    // Video analysis state
    videoFile: null,
    csvFile: null,
    skeletonData: null,
    videoAnalysisReady: false,
  };

  // --- DOM References ---
  const _refs = {};

  // ============================================================
  // INITIALIZATION
  // ============================================================

  function init() {
    _cacheRefs();
    _bindNavigation();
    _bindFileUpload();
    _bindSettings();
    _bindActions();
    _bindVideoAnalysis();
    _loadSavedSettings();
    _navigateTo('dashboard');
  }

  function _cacheRefs() {
    _refs.sidebar = document.getElementById('sidebar');
    _refs.sidebarOverlay = document.getElementById('sidebar-overlay');
    _refs.mobileToggle = document.getElementById('mobile-menu-toggle');
    _refs.viewPanels = document.querySelectorAll('.view-panel');
    _refs.navItems = document.querySelectorAll('.nav-item[data-view]');
    _refs.headerTitle = document.getElementById('header-title');
    _refs.headerBreadcrumb = document.getElementById('header-breadcrumb');

    // File upload
    _refs.uploadZone = document.getElementById('upload-zone');
    _refs.fileInput = document.getElementById('file-input');

    // Settings inputs
    _refs.forceThreshold = document.getElementById('setting-force-threshold');
    _refs.forceThresholdValue = document.getElementById('force-threshold-value');
    _refs.minStepDuration = document.getElementById('setting-min-step-duration');
    _refs.minStepDurationValue = document.getElementById('min-step-duration-value');
    _refs.maxStepDuration = document.getElementById('setting-max-step-duration');
    _refs.maxStepDurationValue = document.getElementById('max-step-duration-value');
    _refs.asymmetryThreshold = document.getElementById('setting-asymmetry-threshold');
    _refs.asymmetryThresholdValue = document.getElementById('asymmetry-threshold-value');

    // Param chart selector
    _refs.paramSelector = document.getElementById('param-chart-selector');

    // Toast
    _refs.toast = document.getElementById('toast');
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  function _bindNavigation() {
    _refs.navItems.forEach(item => {
      item.addEventListener('click', () => {
        const view = item.getAttribute('data-view');
        _navigateTo(view);
      });
    });

    // Mobile menu
    if (_refs.mobileToggle) {
      _refs.mobileToggle.addEventListener('click', _toggleSidebar);
    }
    if (_refs.sidebarOverlay) {
      _refs.sidebarOverlay.addEventListener('click', _closeSidebar);
    }
  }

  function _navigateTo(view) {
    _state.currentView = view;

    // Update nav active state
    _refs.navItems.forEach(item => {
      if (item.getAttribute('data-view') === view) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Show/hide panels
    _refs.viewPanels.forEach(panel => {
      if (panel.getAttribute('data-view') === view) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Update header
    const viewTitles = {
      dashboard: { title: 'Dashboard', breadcrumb: 'Overview & key metrics' },
      import: { title: 'Data Import', breadcrumb: 'Upload CSV or generate demo data' },
      video: { title: 'Video Analysis', breadcrumb: 'Skeleton tracking & joint angles' },
      forcegraph: { title: 'Force-Time Graph', breadcrumb: 'Ground reaction force visualization' },
      parameters: { title: 'Gait Parameters', breadcrumb: 'Step-by-step analysis results' },
      settings: { title: 'Settings', breadcrumb: 'Analysis configuration' },
    };

    const info = viewTitles[view] || { title: 'Dashboard', breadcrumb: '' };
    if (_refs.headerTitle) _refs.headerTitle.textContent = info.title;
    if (_refs.headerBreadcrumb) _refs.headerBreadcrumb.textContent = info.breadcrumb;

    // Render view-specific content
    if (_state.dataLoaded) {
      _renderView(view);
    }

    _closeSidebar();
  }

  function _toggleSidebar() {
    if (_refs.sidebar) _refs.sidebar.classList.toggle('open');
    if (_refs.sidebarOverlay) _refs.sidebarOverlay.classList.toggle('show');
  }

  function _closeSidebar() {
    if (_refs.sidebar) _refs.sidebar.classList.remove('open');
    if (_refs.sidebarOverlay) _refs.sidebarOverlay.classList.remove('show');
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  function _bindFileUpload() {
    // Drag & drop zone
    if (_refs.uploadZone) {
      _refs.uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        _refs.uploadZone.classList.add('drag-over');
      });
      _refs.uploadZone.addEventListener('dragleave', () => {
        _refs.uploadZone.classList.remove('drag-over');
      });
      _refs.uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        _refs.uploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          _handleFileUpload(e.dataTransfer.files[0]);
        }
      });
    }

    // File input
    if (_refs.fileInput) {
      _refs.fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          _handleFileUpload(e.target.files[0]);
        }
      });
    }

    // Demo data button
    const demoBtn = document.getElementById('btn-load-demo');
    if (demoBtn) {
      demoBtn.addEventListener('click', _loadDemoData);
    }

    // Dashboard demo button
    const dashDemoBtn = document.getElementById('btn-dashboard-demo');
    if (dashDemoBtn) {
      dashDemoBtn.addEventListener('click', _loadDemoData);
    }
  }

  function _loadDemoData() {
    _showToast('Loading demo data...', 'info');

    fetch(DEMO_CSV_URL)
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(csvText => {
        const result = GaitData.parseCSV(csvText);
        if (result.error) throw new Error(result.error);
        _processData(result.data);
        _showToast('Demo data loaded! ' + _state.analysisResults.totalSteps + ' steps detected.', 'success');
      })
      .catch(() => {
        // Fallback if the demo CSV is unreachable (e.g. opened via file://)
        const rawData = GaitData.generateDemoData();
        _processData(rawData);
        _showToast('Demo CSV not reachable — using synthetic data. Serve the app over HTTP to load folder "1".', 'info');
      });
  }

  function _handleFileUpload(file) {
    // Validate
    const validation = GaitData.validateFile(file);
    if (!validation.valid) {
      _showToast(validation.error, 'error');
      return;
    }

    _showToast('Reading file...', 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = GaitData.parseCSV(e.target.result);
      if (result.error) {
        _showToast(result.error, 'error');
        return;
      }
      _processData(result.data);
      _showToast('File loaded! ' + _state.analysisResults.totalSteps + ' steps detected.', 'success');
    };
    reader.onerror = () => {
      _showToast('Error reading file.', 'error');
    };
    reader.readAsText(file);
  }

  function _processData(rawData) {
    _state.rawData = rawData;
    _state.analysisResults = GaitEngine.analyze(rawData, _state.settings);
    _state.dataLoaded = true;

    // Update all views
    _renderAllViews();

    // Navigate to dashboard if on import page
    if (_state.currentView === 'import') {
      _navigateTo('dashboard');
    }
  }

  // ============================================================
  // VIEW RENDERING
  // ============================================================

  function _renderAllViews() {
    _renderDashboard();
    _renderForceGraph();
    _renderParameters();
    _renderImportStatus();
  }

  function _renderView(view) {
    switch (view) {
      case 'dashboard': _renderDashboard(); break;
      case 'forcegraph': _renderForceGraph(); break;
      case 'parameters': _renderParameters(); break;
    }
  }

  // --- Dashboard ---
  function _renderDashboard() {
    if (!_state.dataLoaded || !_state.analysisResults) {
      _showEmptyDashboard();
      return;
    }

    const r = _state.analysisResults;
    const s = r.summary;

    // Hide empty state, show data
    const emptyState = document.getElementById('dashboard-empty');
    const dataState = document.getElementById('dashboard-data');
    if (emptyState) emptyState.style.display = 'none';
    if (dataState) dataState.style.display = 'block';

    // Update metric cards
    _setMetricValue('metric-total-steps', r.totalSteps);
    _setMetricValue('metric-avg-cadence', s.overall.avgCadence.toFixed(1));
    _setMetricValue('metric-avg-peak-force', s.overall.avgPeakForce.toFixed(0) + ' N');
    _setMetricValue('metric-duration', r.duration.toFixed(1) + ' s');
    _setMetricValue('metric-symmetry', _overallSymmetry(s.symmetry).toFixed(1) + '%');

    // Render dashboard charts
    // Gait cycle doughnut
    GaitCharts.renderGaitCycleDoughnut('chart-gait-cycle', r.gaitCycle);

    // Symmetry radar
    GaitCharts.renderSymmetryRadar('chart-symmetry-radar', s);

    // Mini force sparkline
    const sparkData = r.rawData ? [] : [];
    if (_state.rawData) {
      const step = Math.max(1, Math.floor(_state.rawData.leftForce.length / 60));
      for (let i = 0; i < _state.rawData.leftForce.length; i += step) {
        sparkData.push(_state.rawData.leftForce[i]);
      }
    }

    // Render comparison table
    _renderDashboardComparison(s);

    // Render gait cycle bar
    _renderGaitCycleBar(r.gaitCycle);

    // Render alerts
    _renderAlerts(s.alerts);
  }

  function _showEmptyDashboard() {
    const emptyState = document.getElementById('dashboard-empty');
    const dataState = document.getElementById('dashboard-data');
    if (emptyState) emptyState.style.display = 'block';
    if (dataState) dataState.style.display = 'none';
  }

  function _setMetricValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function _overallSymmetry(sym) {
    const values = Object.values(sym);
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  function _renderDashboardComparison(summary) {
    const container = document.getElementById('dashboard-comparison');
    if (!container) return;

    container.replaceChildren(); // Safe DOM clearing

    const params = [
      { key: 'peakForce', label: 'Peak Force (N)', unit: '' },
      { key: 'contactTime', label: 'Contact Time (ms)', unit: '' },
      { key: 'cadence', label: 'Cadence (steps/min)', unit: '' },
      { key: 'loadingRate', label: 'Loading Rate (N/s)', unit: '' },
      { key: 'impulse', label: 'Impulse (N·s)', unit: '' },
    ];

    params.forEach(p => {
      const lv = summary.left[p.key].mean;
      const rv = summary.right[p.key].mean;
      const sym = summary.symmetry[p.key];
      const severity = sym > 20 ? 'alert' : sym > 10 ? 'warn' : 'ok';

      const row = document.createElement('div');
      row.classList.add('comparison-row');

      const paramEl = document.createElement('div');
      paramEl.classList.add('comparison-param');
      paramEl.textContent = p.label;

      const valuesEl = document.createElement('div');
      valuesEl.classList.add('comparison-values');

      const leftVal = document.createElement('div');
      leftVal.classList.add('comparison-value', 'left');
      leftVal.textContent = lv.toFixed(1);

      const rightVal = document.createElement('div');
      rightVal.classList.add('comparison-value', 'right');
      rightVal.textContent = rv.toFixed(1);

      valuesEl.appendChild(leftVal);
      valuesEl.appendChild(rightVal);

      const diffEl = document.createElement('div');
      diffEl.classList.add('comparison-diff', severity);
      diffEl.textContent = sym.toFixed(1) + '%';

      row.appendChild(paramEl);
      row.appendChild(valuesEl);
      row.appendChild(diffEl);
      container.appendChild(row);
    });
  }

  function _renderGaitCycleBar(gaitCycle) {
    const container = document.getElementById('gait-cycle-bar');
    if (!container) return;

    container.replaceChildren();

    const stancePhase = document.createElement('div');
    stancePhase.classList.add('gait-phase', 'stance');
    stancePhase.style.flex = gaitCycle.avgStancePercent.toString();
    stancePhase.textContent = 'Stance ' + gaitCycle.avgStancePercent.toFixed(0) + '%';

    const swingPhase = document.createElement('div');
    swingPhase.classList.add('gait-phase', 'swing');
    swingPhase.style.flex = gaitCycle.avgSwingPercent.toString();
    swingPhase.textContent = 'Swing ' + gaitCycle.avgSwingPercent.toFixed(0) + '%';

    container.appendChild(stancePhase);
    container.appendChild(swingPhase);
  }

  function _renderAlerts(alerts) {
    const container = document.getElementById('alerts-container');
    if (!container) return;

    container.replaceChildren();

    if (alerts.length === 0) {
      const noAlerts = document.createElement('div');
      noAlerts.classList.add('badge', 'badge-green');
      noAlerts.textContent = '✓ No asymmetry alerts';
      container.appendChild(noAlerts);
      return;
    }

    alerts.forEach(alert => {
      const badge = document.createElement('div');
      badge.classList.add('badge', alert.severity === 'alert' ? 'badge-magenta' : 'badge-amber');
      badge.textContent = '⚠ ' + alert.param + ': ' + alert.value.toFixed(1) + '% asymmetry';
      badge.style.marginRight = '8px';
      badge.style.marginBottom = '6px';
      container.appendChild(badge);
    });
  }

  // --- Force Graph ---
  function _renderForceGraph() {
    if (!_state.dataLoaded || !_state.rawData) return;
    GaitCharts.renderForceTimeGraph('chart-force-time', _state.rawData);
  }

  // --- Parameters ---
  function _renderParameters() {
    if (!_state.dataLoaded || !_state.analysisResults) return;

    const r = _state.analysisResults;

    // Render the step parameter chart
    const selectedParam = _refs.paramSelector ? _refs.paramSelector.value : 'peakForce';
    GaitCharts.renderStepParameterChart('chart-step-params', r, selectedParam);

    // Render step table
    _renderStepTable(r.steps);

    // Render left/right summary boxes
    _renderFootSummary('left-foot-summary', r.summary.left, 'Left Foot');
    _renderFootSummary('right-foot-summary', r.summary.right, 'Right Foot');
  }

  function _renderStepTable(steps) {
    const tbody = document.getElementById('step-table-body');
    if (!tbody) return;

    tbody.replaceChildren();

    steps.forEach(step => {
      const row = document.createElement('tr');

      const cells = [
        { text: step.stepNumber.toString(), cls: '' },
        { text: step.foot, cls: step.foot === 'Left' ? 'foot-left' : 'foot-right' },
        { text: step.peakForce.toFixed(1), cls: '' },
        { text: step.contactTime.toFixed(0), cls: '' },
        { text: step.stepDuration.toFixed(0), cls: '' },
        { text: step.cadence.toFixed(1), cls: '' },
        { text: step.loadingRate.toFixed(0), cls: '' },
        { text: step.impulse.toFixed(1), cls: '' },
      ];

      cells.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell.text;
        if (cell.cls) td.classList.add(cell.cls);
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });
  }

  function _renderFootSummary(containerId, footStats, title) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.replaceChildren();

    const params = [
      { key: 'peakForce', label: 'Peak Force', unit: 'N' },
      { key: 'contactTime', label: 'Contact Time', unit: 'ms' },
      { key: 'cadence', label: 'Cadence', unit: 'spm' },
      { key: 'loadingRate', label: 'Loading Rate', unit: 'N/s' },
      { key: 'impulse', label: 'Impulse', unit: 'N·s' },
    ];

    params.forEach(p => {
      const stat = footStats[p.key];
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.04);font-size:13px;';

      const label = document.createElement('span');
      label.textContent = p.label;
      label.style.color = 'var(--text-secondary)';

      const value = document.createElement('span');
      value.style.fontWeight = '600';
      value.textContent = stat.mean.toFixed(1) + ' ± ' + stat.std.toFixed(1) + ' ' + p.unit;

      row.appendChild(label);
      row.appendChild(value);
      container.appendChild(row);
    });
  }

  // --- Import View ---
  function _renderImportStatus() {
    const statusEl = document.getElementById('import-status');
    if (!statusEl) return;

    if (!_state.dataLoaded) {
      statusEl.style.display = 'none';
      return;
    }

    statusEl.style.display = 'block';
    statusEl.replaceChildren();

    const meta = _state.rawData.metadata;
    const r = _state.analysisResults;

    const items = [
      { label: 'Source', value: meta.source },
      { label: 'Date', value: meta.date },
      { label: 'Duration', value: r.duration.toFixed(1) + ' seconds' },
      { label: 'Sample Rate', value: r.sampleRate + ' Hz' },
      { label: 'Total Steps', value: r.totalSteps.toString() },
      { label: 'Left Steps', value: r.summary.overall.leftSteps.toString() },
      { label: 'Right Steps', value: r.summary.overall.rightSteps.toString() },
    ];

    items.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-subtle);font-size:13px;';

      const label = document.createElement('span');
      label.style.color = 'var(--text-muted)';
      label.textContent = item.label;

      const value = document.createElement('span');
      value.style.fontWeight = '600';
      value.textContent = item.value;

      row.appendChild(label);
      row.appendChild(value);
      statusEl.appendChild(row);
    });
  }

  // ============================================================
  // SETTINGS
  // ============================================================

  function _bindSettings() {
    // Range inputs with live value display
    _bindRangeInput(_refs.forceThreshold, _refs.forceThresholdValue, 'forceThreshold', ' N');
    _bindRangeInput(_refs.minStepDuration, _refs.minStepDurationValue, 'minStepDuration', ' ms');
    _bindRangeInput(_refs.maxStepDuration, _refs.maxStepDurationValue, 'maxStepDuration', ' ms');
    _bindRangeInput(_refs.asymmetryThreshold, _refs.asymmetryThresholdValue, 'asymmetryThreshold', '%');

    // Apply settings button
    const applyBtn = document.getElementById('btn-apply-settings');
    if (applyBtn) {
      applyBtn.addEventListener('click', _applySettings);
    }

    // Reset settings button
    const resetBtn = document.getElementById('btn-reset-settings');
    if (resetBtn) {
      resetBtn.addEventListener('click', _resetSettings);
    }
  }

  function _bindRangeInput(inputEl, displayEl, settingKey, suffix) {
    if (!inputEl || !displayEl) return;

    inputEl.addEventListener('input', () => {
      const val = parseFloat(inputEl.value);
      displayEl.textContent = val + suffix;
      _state.settings[settingKey] = val;
    });
  }

  function _applySettings() {
    if (!_state.dataLoaded) {
      _showToast('No data loaded. Import data first.', 'error');
      return;
    }

    // Re-analyze with new settings
    _state.analysisResults = GaitEngine.analyze(_state.rawData, _state.settings);
    _renderAllViews();
    _saveSettings();
    _showToast('Settings applied! Analysis updated.', 'success');
  }

  function _resetSettings() {
    _state.settings = { ...GaitEngine.DEFAULT_SETTINGS };
    _updateSettingsUI();
    if (_state.dataLoaded) {
      _state.analysisResults = GaitEngine.analyze(_state.rawData, _state.settings);
      _renderAllViews();
    }
    _saveSettings();
    _showToast('Settings reset to defaults.', 'info');
  }

  function _updateSettingsUI() {
    const s = _state.settings;
    if (_refs.forceThreshold) {
      _refs.forceThreshold.value = s.forceThreshold;
      if (_refs.forceThresholdValue) _refs.forceThresholdValue.textContent = s.forceThreshold + ' N';
    }
    if (_refs.minStepDuration) {
      _refs.minStepDuration.value = s.minStepDuration;
      if (_refs.minStepDurationValue) _refs.minStepDurationValue.textContent = s.minStepDuration + ' ms';
    }
    if (_refs.maxStepDuration) {
      _refs.maxStepDuration.value = s.maxStepDuration;
      if (_refs.maxStepDurationValue) _refs.maxStepDurationValue.textContent = s.maxStepDuration + ' ms';
    }
    if (_refs.asymmetryThreshold) {
      _refs.asymmetryThreshold.value = s.asymmetryAlertThreshold;
      if (_refs.asymmetryThresholdValue) _refs.asymmetryThresholdValue.textContent = s.asymmetryAlertThreshold + '%';
    }
  }

  // Non-sensitive settings persistence (UI preferences only)
  function _saveSettings() {
    try {
      localStorage.setItem('gait_ui_settings', JSON.stringify(_state.settings));
    } catch (e) {
      // Silently fail if localStorage unavailable
    }
  }

  function _loadSavedSettings() {
    try {
      const saved = localStorage.getItem('gait_ui_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Only load known keys to prevent prototype pollution
        const validKeys = Object.keys(GaitEngine.DEFAULT_SETTINGS);
        validKeys.forEach(key => {
          if (typeof parsed[key] === 'number' && isFinite(parsed[key])) {
            // Ignore minStanceDuration since we updated the engine default and want to force it
            if (key !== 'minStanceDuration') {
              _state.settings[key] = parsed[key];
            }
          }
        });
      }
    } catch (e) {
      // Silently fail
    }
    _state.settings.minStanceDuration = GaitEngine.DEFAULT_SETTINGS.minStanceDuration;
    _updateSettingsUI();
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  function _bindActions() {
    // Export CSV button
    const exportBtn = document.getElementById('btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', _exportCSV);
    }

    // Param chart selector
    if (_refs.paramSelector) {
      _refs.paramSelector.addEventListener('change', () => {
        if (_state.dataLoaded) _renderParameters();
      });
    }
  }

  // ============================================================
  // VIDEO ANALYSIS
  // ============================================================

  function _bindVideoAnalysis() {
    // Video file upload
    const videoUploadZone = document.getElementById('video-upload-zone');
    const videoFileInput = document.getElementById('video-file-input');
    const csvUploadZone = document.getElementById('csv-upload-zone');
    const csvFileInput = document.getElementById('csv-file-input');
    const startBtn = document.getElementById('btn-start-analysis');

    if (videoUploadZone) {
      videoUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        videoUploadZone.classList.add('drag-over');
      });
      videoUploadZone.addEventListener('dragleave', () => {
        videoUploadZone.classList.remove('drag-over');
      });
      videoUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoUploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          _handleVideoFile(e.dataTransfer.files[0]);
        }
      });
    }

    if (videoFileInput) {
      videoFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          _handleVideoFile(e.target.files[0]);
        }
      });
    }

    if (csvUploadZone) {
      csvUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        csvUploadZone.classList.add('drag-over');
      });
      csvUploadZone.addEventListener('dragleave', () => {
        csvUploadZone.classList.remove('drag-over');
      });
      csvUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        csvUploadZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length > 0) {
          _handleSkeletonCSV(e.dataTransfer.files[0]);
        }
      });
    }

    if (csvFileInput) {
      csvFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          _handleSkeletonCSV(e.target.files[0]);
        }
      });
    }

    if (startBtn) {
      startBtn.addEventListener('click', _startVideoAnalysis);
    }

    // Demo data button
    const videoDemoBtn = document.getElementById('btn-video-demo');
    if (videoDemoBtn) {
      videoDemoBtn.addEventListener('click', _loadVideoDemoData);
    }

    // Reload button
    const reloadBtn = document.getElementById('btn-reload-video');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', _resetVideoAnalysis);
    }
  }

  function _setStatusIndicator(id, text, ready) {
    const indicator = document.getElementById(id);
    if (!indicator) return;
    indicator.replaceChildren();
    const icon = document.createElement('span');
    icon.className = 'status-icon ' + (ready ? 'ready' : 'pending');
    icon.textContent = ready ? '●' : '○';
    const textEl = document.createElement('span');
    textEl.textContent = text;
    indicator.appendChild(icon);
    indicator.appendChild(textEl);
  }

  async function _loadVideoDemoData() {
    _showToast('Loading demo video & skeleton data...', 'info');

    try {
      const [videoRes, csvRes] = await Promise.all([
        fetch(DEMO_VIDEO_URL),
        fetch(DEMO_CSV_URL),
      ]);
      if (!videoRes.ok || !csvRes.ok) {
        throw new Error('Demo files not found');
      }

      const videoBlob = await videoRes.blob();
      const csvText = await csvRes.text();

      const parsed = SkeletonData.parseCSV(csvText);
      if (parsed.error) {
        _showToast('CSV Error: ' + parsed.error, 'error');
        return;
      }

      const videoName = DEMO_VIDEO_URL.split('/').pop();
      _state.videoFile = new File([videoBlob], videoName, { type: 'video/mp4' });
      _state.skeletonData = parsed;
      _state.csvFile = null;

      _setStatusIndicator('video-status-indicator', 'Video: ' + videoName, true);
      _setStatusIndicator('csv-status-indicator', 'CSV: ' + parsed.dataFrames + ' frames loaded', true);
      _checkVideoAnalysisReady();

      _startVideoAnalysis();
    } catch (e) {
      _showToast('Could not load demo files. Serve the app over HTTP (e.g. "python3 -m http.server") so folder "1" is reachable.', 'error');
    }
  }

  function _handleVideoFile(file) {
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/avi'];
    const ext = file.name.toLowerCase().split('.').pop();
    const validExts = ['mp4', 'webm', 'mov', 'avi'];

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      _showToast('Invalid video format. Supported: MP4, WebM, MOV, AVI', 'error');
      return;
    }

    _state.videoFile = file;
    
    if (ext === 'avi') {
      _showToast('Warning: Browsers cannot play AVI files. Please upload the converted MP4 file instead.', 'error');
    } else {
      _showToast('Video loaded: ' + file.name, 'success');
    }

    // Update status indicator
    const indicator = document.getElementById('video-status-indicator');
    if (indicator) {
      indicator.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'status-icon ready';
      icon.textContent = '●';
      const text = document.createElement('span');
      text.textContent = 'Video: ' + file.name;
      indicator.appendChild(icon);
      indicator.appendChild(text);
    }

    _checkVideoAnalysisReady();
  }

  function _handleSkeletonCSV(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      _showToast('Please upload a CSV file.', 'error');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      _showToast('CSV file too large. Maximum 50MB.', 'error');
      return;
    }

    _showToast('Reading skeleton CSV...', 'info');

    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = SkeletonData.parseCSV(e.target.result);
      if (parsed.error) {
        _showToast('CSV Error: ' + parsed.error, 'error');
        return;
      }

      _state.skeletonData = parsed;
      _state.csvFile = file;
      _showToast('Skeleton data loaded! ' + parsed.dataFrames + ' frames with landmarks.', 'success');

      // Update status indicator
      const indicator = document.getElementById('csv-status-indicator');
      if (indicator) {
        indicator.replaceChildren();
        const icon = document.createElement('span');
        icon.className = 'status-icon ready';
        icon.textContent = '●';
        const text = document.createElement('span');
        text.textContent = 'CSV: ' + parsed.dataFrames + ' frames loaded';
        indicator.appendChild(icon);
        indicator.appendChild(text);
      }

      _checkVideoAnalysisReady();
    };
    reader.onerror = () => {
      _showToast('Error reading CSV file.', 'error');
    };
    reader.readAsText(file);
  }

  function _checkVideoAnalysisReady() {
    const ready = !!_state.videoFile && !!_state.skeletonData;
    _state.videoAnalysisReady = ready;

    const startBtn = document.getElementById('btn-start-analysis');
    if (startBtn) {
      startBtn.disabled = !ready;
    }
  }

  function _startVideoAnalysis() {
    if (!_state.videoFile || !_state.skeletonData) {
      _showToast('Please load both video and CSV files.', 'error');
      return;
    }

    // Hide empty state, show active state
    const emptyState = document.getElementById('video-empty-state');
    const activeState = document.getElementById('video-active-state');
    if (emptyState) emptyState.style.display = 'none';
    if (activeState) activeState.style.display = 'block';

    // Initialize video player
    VideoPlayer.init({
      videoEl: document.getElementById('video-player'),
      canvasEl: document.getElementById('skeleton-canvas'),
      onFrameUpdate: _onVideoFrameUpdate,
    });

    // Load data
    VideoPlayer.loadVideoFile(_state.videoFile);
    VideoPlayer.loadSkeletonData(_state.skeletonData);

    // Set total frames display
    const frameTotalEl = document.getElementById('video-frame-total');
    if (frameTotalEl) {
      frameTotalEl.textContent = _state.skeletonData.dataFrames;
    }

    // Render angle charts
    const angleSeries = VideoPlayer.getState().angleSeries;
    if (angleSeries) {
      VideoCharts.renderKneeAngleChart('chart-knee-angle', angleSeries);
      VideoCharts.renderHipAngleChart('chart-hip-angle', angleSeries);
      VideoCharts.renderAnkleAngleChart('chart-ankle-angle', angleSeries);
      VideoCharts.renderTrunkLeanChart('chart-trunk-lean', angleSeries);
      
      // Initialize charts empty, they will fill as video plays
      VideoCharts.updatePlayhead(-1);
    }

    // Bind video controls
    _bindVideoControls();

    _showToast('Video analysis started! Use controls to play.', 'success');
  }

  function _bindVideoControls() {
    const playPauseBtn = document.getElementById('btn-play-pause');
    const stepBackBtn = document.getElementById('btn-step-back');
    const stepFwdBtn = document.getElementById('btn-step-fwd');
    const progressSlider = document.getElementById('video-progress');
    const speedSelect = document.getElementById('video-speed');
    const toggleSkeleton = document.getElementById('toggle-skeleton');
    const toggleAngles = document.getElementById('toggle-angles');
    const videoEl = document.getElementById('video-player');

    if (playPauseBtn) {
      playPauseBtn.addEventListener('click', () => {
        VideoPlayer.togglePlayPause();
      });
    }

    if (stepBackBtn) {
      stepBackBtn.addEventListener('click', () => {
        VideoPlayer.stepBackward();
      });
    }

    if (stepFwdBtn) {
      stepFwdBtn.addEventListener('click', () => {
        VideoPlayer.stepForward();
      });
    }

    if (progressSlider) {
      progressSlider.addEventListener('input', () => {
        const val = parseFloat(progressSlider.value) / 1000;
        VideoPlayer.seek(val);
      });
    }

    if (speedSelect) {
      speedSelect.addEventListener('change', () => {
        VideoPlayer.setPlaybackSpeed(parseFloat(speedSelect.value));
      });
    }

    if (toggleSkeleton) {
      toggleSkeleton.addEventListener('change', () => {
        VideoPlayer.setShowSkeleton(toggleSkeleton.checked);
      });
    }

    if (toggleAngles) {
      toggleAngles.addEventListener('change', () => {
        VideoPlayer.setShowAngles(toggleAngles.checked);
      });
    }

    // Video time update for progress bar
    if (videoEl) {
      videoEl.addEventListener('timeupdate', () => {
        if (!videoEl.duration) return;
        const progress = (videoEl.currentTime / videoEl.duration) * 1000;
        if (progressSlider) progressSlider.value = progress;

        const fill = document.getElementById('video-progress-fill');
        if (fill) fill.style.width = (progress / 10) + '%';

        // Update time display
        const currentTimeEl = document.getElementById('video-current-time');
        const totalTimeEl = document.getElementById('video-total-time');
        if (currentTimeEl) currentTimeEl.textContent = _formatTime(videoEl.currentTime);
        if (totalTimeEl) totalTimeEl.textContent = _formatTime(videoEl.duration);
      });

      videoEl.addEventListener('play', () => {
        const btn = document.getElementById('btn-play-pause');
        if (btn) btn.textContent = '⏸';
      });

      videoEl.addEventListener('pause', () => {
        const btn = document.getElementById('btn-play-pause');
        if (btn) btn.textContent = '▶';
      });
    }

    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      if (_state.currentView !== 'video') return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          VideoPlayer.togglePlayPause();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          VideoPlayer.stepBackward();
          break;
        case 'ArrowRight':
          e.preventDefault();
          VideoPlayer.stepForward();
          break;
      }
    });
  }

  function _onVideoFrameUpdate(info) {
    // Update frame counter
    const frameCurrentEl = document.getElementById('video-frame-current');
    if (frameCurrentEl) frameCurrentEl.textContent = info.frameIndex + 1;

    // Update real-time angle metrics
    const angles = VideoPlayer.getCurrentAngles();
    if (angles) {
      _setMetricValue('metric-left-knee', Math.round(angles.leftKnee) + '°');
      _setMetricValue('metric-right-knee', Math.round(angles.rightKnee) + '°');
      _setMetricValue('metric-left-hip', Math.round(angles.leftHip) + '°');
      _setMetricValue('metric-right-hip', Math.round(angles.rightHip) + '°');
      _setMetricValue('metric-trunk-lean', angles.trunkLean.toFixed(1) + '°');
    }

    // Update gait phase
    const phase = VideoPlayer.getCurrentGaitPhase();
    if (phase) {
      const leftPhaseEl = document.getElementById('phase-left-value');
      const rightPhaseEl = document.getElementById('phase-right-value');
      const leftIndicator = document.getElementById('gait-phase-left');
      const rightIndicator = document.getElementById('gait-phase-right');

      if (leftPhaseEl) leftPhaseEl.textContent = phase.left;
      if (rightPhaseEl) rightPhaseEl.textContent = phase.right;

      if (leftIndicator) {
        leftIndicator.classList.remove('stance', 'swing');
        leftIndicator.classList.add(phase.left);
      }
      if (rightIndicator) {
        rightIndicator.classList.remove('stance', 'swing');
        rightIndicator.classList.add(phase.right);
      }
    }

    // Update chart playheads (throttled - every 3rd frame for performance)
    if (info.frameIndex % 3 === 0) {
      VideoCharts.updatePlayhead(info.frameIndex);
    }
  }

  function _resetVideoAnalysis() {
    VideoPlayer.destroy();
    VideoCharts.destroyAll();

    _state.videoFile = null;
    _state.csvFile = null;
    _state.skeletonData = null;
    _state.videoAnalysisReady = false;

    // Show empty state, hide active state
    const emptyState = document.getElementById('video-empty-state');
    const activeState = document.getElementById('video-active-state');
    if (emptyState) emptyState.style.display = 'block';
    if (activeState) activeState.style.display = 'none';

    // Reset status indicators
    const videoIndicator = document.getElementById('video-status-indicator');
    if (videoIndicator) {
      videoIndicator.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'status-icon pending';
      icon.textContent = '○';
      const text = document.createElement('span');
      text.textContent = 'Video file: Not loaded';
      videoIndicator.appendChild(icon);
      videoIndicator.appendChild(text);
    }

    const csvIndicator = document.getElementById('csv-status-indicator');
    if (csvIndicator) {
      csvIndicator.replaceChildren();
      const icon = document.createElement('span');
      icon.className = 'status-icon pending';
      icon.textContent = '○';
      const text = document.createElement('span');
      text.textContent = 'Skeleton CSV: Not loaded';
      csvIndicator.appendChild(icon);
      csvIndicator.appendChild(text);
    }

    const startBtn = document.getElementById('btn-start-analysis');
    if (startBtn) startBtn.disabled = true;

    _showToast('Video analysis reset.', 'info');
  }

  function _formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return mins + ':' + secs.toString().padStart(2, '0');
  }

  function _exportCSV() {
    if (!_state.analysisResults) {
      _showToast('No data to export. Load data first.', 'error');
      return;
    }

    const csv = GaitData.exportToCSV(_state.analysisResults);
    const filename = 'gait_analysis_' + new Date().toISOString().split('T')[0] + '.csv';
    GaitData.downloadFile(csv, filename, 'text/csv;charset=utf-8;');
    _showToast('Analysis exported as ' + filename, 'success');
  }

  // ============================================================
  // TOAST NOTIFICATIONS
  // ============================================================

  let _toastTimeout = null;

  function _showToast(message, type) {
    if (!_refs.toast) return;

    if (_toastTimeout) clearTimeout(_toastTimeout);

    // Clear previous classes
    _refs.toast.classList.remove('show', 'success', 'error', 'info');

    // Set content safely
    _refs.toast.replaceChildren();
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    const iconSpan = document.createElement('span');
    iconSpan.textContent = icons[type] || 'ℹ';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;

    _refs.toast.appendChild(iconSpan);
    _refs.toast.appendChild(msgSpan);
    _refs.toast.classList.add(type);

    // Trigger reflow then show
    void _refs.toast.offsetWidth;
    _refs.toast.classList.add('show');

    _toastTimeout = setTimeout(() => {
      _refs.toast.classList.remove('show');
    }, 3500);
  }

  // --- Public API ---
  return { init };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', App.init);
