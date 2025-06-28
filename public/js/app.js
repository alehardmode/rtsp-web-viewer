class RTSPWebViewer {
  constructor() {
    this.activeStreams = new Map();
    this.currentStreamId = null;
    this.hlsPlayer = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.autoLoadCameras = null;

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateConnectionStatus();
    this.loadActiveStreams();
    this.loadAutoLoadCameras();
    this.logMessage("Sistema iniciado correctamente", "info");
  }

  bindEvents() {
    // Control buttons
    document
      .getElementById("start-stream")
      .addEventListener("click", () => this.startStream());
    document
      .getElementById("stop-stream")
      .addEventListener("click", () => this.stopCurrentStream());
    document
      .getElementById("refresh-streams")
      .addEventListener("click", () => this.loadActiveStreams());
    document
      .getElementById("clear-logs")
      .addEventListener("click", () => this.clearLogs());

    // Auto-load camera controls
    document
      .getElementById("start-all-cameras")
      .addEventListener("click", () => this.startAllCameras());
    document
      .getElementById("stop-all-cameras")
      .addEventListener("click", () => this.stopAllCameras());

    // Enter key support for inputs
    document.getElementById("rtsp-url").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.startStream();
    });
    document.getElementById("stream-id").addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.startStream();
    });

    // Modal events
    const modal = document.getElementById("stream-modal");
    const closeBtn = modal.querySelector(".close");
    closeBtn.addEventListener("click", () => this.closeModal());
    window.addEventListener("click", (e) => {
      if (e.target === modal) this.closeModal();
    });

    // Auto-refresh streams every 30 seconds
    setInterval(() => this.loadActiveStreams(), 30000);
  }

  async startStream() {
    const rtspUrl = document.getElementById("rtsp-url").value.trim();
    const streamId = document.getElementById("stream-id").value.trim();

    if (!rtspUrl || !streamId) {
      this.showToast("Por favor, completa todos los campos", "error");
      return;
    }

    if (!this.isValidRTSPUrl(rtspUrl)) {
      this.showToast("URL RTSP inválida", "error");
      return;
    }

    const startBtn = document.getElementById("start-stream");
    const originalText = startBtn.innerHTML;
    startBtn.innerHTML = '<span class="loading"></span> Iniciando...';
    startBtn.disabled = true;

    try {
      const response = await fetch("/api/stream/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rtspUrl, streamId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast(`Stream ${streamId} iniciado correctamente`, "success");
        this.logMessage(`Stream ${streamId} iniciado: ${rtspUrl}`, "success");

        // Wait a moment for the stream to be ready, then load it
        setTimeout(() => {
          this.loadActiveStreams();
          this.playStream(streamId, data.hlsUrl);
        }, 2000);

        // Clear form
        document.getElementById("stream-id").value = "";
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error starting stream:", error);
      this.showToast(`Error al iniciar stream: ${error.message}`, "error");
      this.logMessage(
        `Error al iniciar stream ${streamId}: ${error.message}`,
        "error",
      );
    } finally {
      startBtn.innerHTML = originalText;
      startBtn.disabled = false;
    }
  }

  async stopStream(streamId) {
    if (!streamId) {
      this.showToast("ID de stream requerido", "error");
      return;
    }

    try {
      const response = await fetch("/api/stream/stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ streamId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast(`Stream ${streamId} detenido`, "success");
        this.logMessage(`Stream ${streamId} detenido`, "success");

        // If this was the current stream, stop playback
        if (this.currentStreamId === streamId) {
          this.stopCurrentPlayback();
        }

        this.loadActiveStreams();
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error stopping stream:", error);
      this.showToast(`Error al detener stream: ${error.message}`, "error");
      this.logMessage(
        `Error al detener stream ${streamId}: ${error.message}`,
        "error",
      );
    }
  }

  async stopCurrentStream() {
    if (!this.currentStreamId) {
      this.showToast("No hay stream activo para detener", "warning");
      return;
    }

    await this.stopStream(this.currentStreamId);
  }

  async loadActiveStreams() {
    try {
      const response = await fetch("/api/streams");
      const data = await response.json();

      if (response.ok) {
        this.activeStreams.clear();
        data.streams.forEach((stream) => {
          this.activeStreams.set(stream.id, stream);
        });

        this.renderStreams();
        this.updateStreamCount();
        this.updateConnectionStatus(true);
      } else {
        throw new Error("Error al cargar streams");
      }
    } catch (error) {
      console.error("Error loading streams:", error);
      this.updateConnectionStatus(false);
      this.logMessage(`Error al cargar streams: ${error.message}`, "error");
    }
  }

  async loadAutoLoadCameras() {
    try {
      const response = await fetch("/api/cameras/auto-load");
      const data = await response.json();

      if (response.ok) {
        this.autoLoadCameras = data;
        this.renderAutoLoadStatus();
      }
    } catch (error) {
      console.error("Error loading auto-load cameras:", error);
    }
  }

  renderAutoLoadStatus() {
    const statusContainer = document.getElementById("auto-load-status");
    if (!statusContainer || !this.autoLoadCameras) return;

    const { autoLoadEnabled, configuredCameras, cameras, activeStreams } =
      this.autoLoadCameras;

    let statusHtml = `
            <div class="auto-load-info">
                <h3>🎬 Cámaras Auto-configuradas</h3>
                <div class="auto-load-stats">
                    <span>Estado: ${autoLoadEnabled ? "✅ Habilitado" : "❌ Deshabilitado"}</span>
                    <span>Configuradas: ${configuredCameras}</span>
                    <span>Activas: ${activeStreams}</span>
                </div>
            </div>
        `;

    if (cameras.length > 0) {
      statusHtml += '<div class="auto-cameras-list">';
      cameras.forEach((camera) => {
        statusHtml += `
                    <div class="auto-camera-item ${camera.active ? "active" : "inactive"}">
                        <span class="camera-status">${camera.active ? "🟢" : "🔴"}</span>
                        <span class="camera-name">${camera.name}</span>
                        <span class="camera-id">(${camera.id})</span>
                    </div>
                `;
      });
      statusHtml += "</div>";

      statusHtml += `
                <div class="auto-load-controls">
                    <button id="start-all-cameras" class="btn btn-primary btn-small">
                        🚀 Iniciar Todas
                    </button>
                    <button id="stop-all-cameras" class="btn btn-danger btn-small">
                        🛑 Detener Todas
                    </button>
                </div>
            `;
    }

    statusContainer.innerHTML = statusHtml;

    // Re-bind events after rendering
    const startAllBtn = document.getElementById("start-all-cameras");
    const stopAllBtn = document.getElementById("stop-all-cameras");

    if (startAllBtn) {
      startAllBtn.addEventListener("click", () => this.startAllCameras());
    }
    if (stopAllBtn) {
      stopAllBtn.addEventListener("click", () => this.stopAllCameras());
    }
  }

  async startAllCameras() {
    try {
      this.showToast("Iniciando todas las cámaras...", "info");
      this.logMessage("Iniciando auto-carga de cámaras configuradas", "info");

      const response = await fetch("/api/cameras/start-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast("Cámaras iniciadas exitosamente", "success");
        this.logMessage(
          `Auto-carga completada: ${data.activeStreams} cámaras activas`,
          "success",
        );

        // Refresh both auto-load status and active streams
        setTimeout(() => {
          this.loadAutoLoadCameras();
          this.loadActiveStreams();
        }, 3000);
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error starting all cameras:", error);
      this.showToast(`Error al iniciar cámaras: ${error.message}`, "error");
      this.logMessage(`Error en auto-carga: ${error.message}`, "error");
    }
  }

  async stopAllCameras() {
    try {
      this.showToast("Deteniendo todas las cámaras...", "warning");
      this.logMessage("Deteniendo todas las cámaras", "warning");

      const response = await fetch("/api/cameras/stop-all", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast(`${data.stoppedCount} cámaras detenidas`, "success");
        this.logMessage(`Detenidas ${data.stoppedCount} cámaras`, "success");

        // Stop current playback and refresh
        this.stopCurrentPlayback();
        this.loadAutoLoadCameras();
        this.loadActiveStreams();
      } else {
        throw new Error(data.error || "Error desconocido");
      }
    } catch (error) {
      console.error("Error stopping all cameras:", error);
      this.showToast(`Error al detener cámaras: ${error.message}`, "error");
      this.logMessage(`Error deteniendo cámaras: ${error.message}`, "error");
    }
  }

  renderStreams() {
    const streamsList = document.getElementById("streams-list");

    if (this.activeStreams.size === 0) {
      streamsList.innerHTML = `
                <div class="no-streams">
                    <p>No hay streams activos</p>
                    <small>Configura una URL RTSP arriba para comenzar</small>
                </div>
            `;
      return;
    }

    const streamsHTML = Array.from(this.activeStreams.values())
      .map((stream) => {
        const isActive = this.currentStreamId === stream.id;
        const startTime = new Date(stream.startTime).toLocaleString();

        return `
                <div class="stream-card ${isActive ? "active" : ""}" data-stream-id="${stream.id}">
                    <div class="stream-header">
                        <span class="stream-id">${stream.id}</span>
                        <span class="stream-status active">🟢 Activo</span>
                    </div>
                    <div class="stream-url">${stream.rtspUrl}</div>
                    <div class="stream-meta">
                        <small>Iniciado: ${startTime}</small>
                    </div>
                    <div class="stream-actions">
                        <button class="btn btn-primary btn-small play-btn" onclick="app.playStream('${stream.id}', '${stream.hlsUrl}')">
                            📺 Ver
                        </button>
                        <button class="btn btn-danger btn-small" onclick="app.stopStream('${stream.id}')">
                            🛑 Detener
                        </button>
                        <button class="btn btn-secondary btn-small" onclick="app.showStreamDetails('${stream.id}')">
                            ℹ️ Info
                        </button>
                    </div>
                </div>
            `;
      })
      .join("");

    streamsList.innerHTML = streamsHTML;
  }

  async playStream(streamId, hlsUrl) {
    const video = document.getElementById("video-player");
    const videoStatus = document.getElementById("video-status");

    try {
      // Stop current playback if any
      this.stopCurrentPlayback();

      videoStatus.textContent = "Cargando stream...";
      this.logMessage(`Reproduciendo stream ${streamId}`, "info");

      if (Hls.isSupported()) {
        this.hlsPlayer = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
        });

        this.hlsPlayer.loadSource(hlsUrl);
        this.hlsPlayer.attachMedia(video);

        this.hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
          videoStatus.style.display = "none";
          video.play().catch((e) => {
            console.warn("Autoplay prevented:", e);
            this.showToast("Haz clic en el video para reproducir", "warning");
          });
        });

        this.hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
          console.error("HLS error:", data);
          if (data.fatal) {
            this.handleStreamError(streamId, data);
          }
        });
      } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
        // Safari native HLS support
        video.src = hlsUrl;
        video.addEventListener("loadedmetadata", () => {
          videoStatus.style.display = "none";
        });
        video.addEventListener("error", (e) => {
          this.handleStreamError(streamId, e);
        });
      } else {
        throw new Error("HLS no soportado en este navegador");
      }

      this.currentStreamId = streamId;
      this.renderStreams(); // Re-render to show active state
      this.showToast(`Reproduciendo stream ${streamId}`, "success");
    } catch (error) {
      console.error("Error playing stream:", error);
      this.showToast(`Error al reproducir: ${error.message}`, "error");
      this.logMessage(
        `Error al reproducir stream ${streamId}: ${error.message}`,
        "error",
      );
      videoStatus.textContent = "Error al cargar el stream";
    }
  }

  stopCurrentPlayback() {
    const video = document.getElementById("video-player");
    const videoStatus = document.getElementById("video-status");

    if (this.hlsPlayer) {
      this.hlsPlayer.destroy();
      this.hlsPlayer = null;
    }

    video.src = "";
    video.load();
    videoStatus.style.display = "block";
    videoStatus.textContent = "Selecciona un stream para comenzar";

    this.currentStreamId = null;
    this.renderStreams();
  }

  handleStreamError(streamId, error) {
    console.error(`Stream ${streamId} error:`, error);
    this.logMessage(
      `Error en stream ${streamId}: ${error.type || error.message}`,
      "error",
    );

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      this.showToast(
        `Reintentando conexión (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
        "warning",
      );

      setTimeout(() => {
        const stream = this.activeStreams.get(streamId);
        if (stream) {
          this.playStream(streamId, stream.hlsUrl);
        }
      }, 2000 * this.reconnectAttempts);
    } else {
      this.showToast(
        `Stream ${streamId} falló tras ${this.maxReconnectAttempts} intentos`,
        "error",
      );
      this.stopCurrentPlayback();
      this.reconnectAttempts = 0;
    }
  }

  async showStreamDetails(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    const modal = document.getElementById("stream-modal");
    const detailsDiv = document.getElementById("stream-details");

    const startTime = new Date(stream.startTime);
    const uptime = this.formatUptime(Date.now() - startTime.getTime());

    detailsDiv.innerHTML = `
            <div class="stream-details">
                <p><strong>ID:</strong> ${stream.id}</p>
                <p><strong>URL RTSP:</strong> ${stream.rtspUrl}</p>
                <p><strong>URL HLS:</strong> ${stream.hlsUrl}</p>
                <p><strong>Iniciado:</strong> ${startTime.toLocaleString()}</p>
                <p><strong>Tiempo activo:</strong> ${uptime}</p>
                <p><strong>Estado:</strong> <span style="color: green;">🟢 Activo</span></p>
            </div>
        `;

    modal.style.display = "block";
  }

  closeModal() {
    document.getElementById("stream-modal").style.display = "none";
  }

  updateConnectionStatus(connected = true) {
    const statusElement = document.getElementById("connection-status");
    if (connected) {
      statusElement.textContent = "🟢 Conectado";
      statusElement.style.color = "var(--success-color)";
    } else {
      statusElement.textContent = "🔴 Desconectado";
      statusElement.style.color = "var(--danger-color)";
    }
  }

  updateStreamCount() {
    const countElement = document.getElementById("stream-count");
    countElement.textContent = `Streams activos: ${this.activeStreams.size}`;
  }

  logMessage(message, type = "info") {
    const logsContainer = document.getElementById("logs-container");
    const timestamp = new Date().toLocaleTimeString();

    const logEntry = document.createElement("div");
    logEntry.className = `log-entry ${type}`;
    logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="message">${message}</span>
        `;

    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // Keep only last 100 log entries
    const entries = logsContainer.querySelectorAll(".log-entry");
    if (entries.length > 100) {
      entries[0].remove();
    }
  }

  clearLogs() {
    const logsContainer = document.getElementById("logs-container");
    logsContainer.innerHTML = "";
    this.logMessage("Logs limpiados", "info");
  }

  showToast(message, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      toast.remove();
    }, 5000);

    // Remove on click
    toast.addEventListener("click", () => toast.remove());
  }

  isValidRTSPUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "rtsp:";
    } catch {
      return false;
    }
  }

  formatUptime(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.app = new RTSPWebViewer();
});

// Handle page visibility change to pause/resume streams
document.addEventListener("visibilitychange", () => {
  if (document.hidden && window.app && window.app.hlsPlayer) {
    // Optionally pause when tab is hidden
    const video = document.getElementById("video-player");
    if (video && !video.paused) {
      video.pause();
    }
  }
});

// Handle beforeunload to cleanup streams
window.addEventListener("beforeunload", () => {
  if (window.app && window.app.hlsPlayer) {
    window.app.hlsPlayer.destroy();
  }
});
