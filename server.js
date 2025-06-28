const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { spawn } = require("child_process");
const fs = require("fs");
const { URL } = require("url");

// FFmpeg feature detection cache
let ffmpegFeatures = null;

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        mediaSrc: ["'self'", "blob:"],
        connectSrc: ["'self'", "ws:", "wss:"],
      },
    },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 API requests per minute
  message: "Too many API requests from this IP, please try again later.",
});

app.use(limiter);
app.use("/api/", apiLimiter);

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Custom middleware for HLS files with proper headers
app.use("/streams", (req, res, next) => {
  if (req.path.endsWith(".m3u8")) {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  } else if (req.path.endsWith(".ts")) {
    res.setHeader("Content-Type", "video/mp2t");
    res.setHeader("Cache-Control", "public, max-age=31536000");
  }
  next();
});

app.use(express.static("public"));

// Store active streams
const activeStreams = new Map();

// Resource monitoring for multiple cameras
let systemResources = {
  cpuUsage: 0,
  memoryUsage: 0,
  activeProcesses: 0,
  lastCheck: Date.now(),
};

// Auto-load cameras configuration
const autoLoadCameras = process.env.AUTO_LOAD_CAMERAS === "true";
const autoStartDelay = parseInt(process.env.AUTO_START_DELAY) || 3000;

// Serve static files
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Debug endpoint to check HLS files
app.get("/api/debug/stream/:streamId", (req, res) => {
  const { streamId } = req.params;
  const hlsDir = path.join(__dirname, "public", "streams", streamId);

  if (!fs.existsSync(hlsDir)) {
    return res.status(404).json({ error: "Stream directory not found" });
  }

  try {
    const files = fs.readdirSync(hlsDir);
    const fileDetails = files.map((file) => {
      const filePath = path.join(hlsDir, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        size: stats.size,
        modified: stats.mtime,
      };
    });

    res.json({
      streamId,
      directory: hlsDir,
      files: fileDetails,
      totalFiles: files.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// System monitoring endpoint for multiple cameras
app.get("/api/system/status", (req, res) => {
  const used = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    system: {
      uptime: Math.floor(uptime),
      memory: {
        used: Math.round((used.heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((used.heapTotal / 1024 / 1024) * 100) / 100,
      },
      cpu: process.cpuUsage(),
    },
    streams: {
      active: activeStreams.size,
      maximum: process.env.MAX_CONCURRENT_STREAMS || 10,
      list: Array.from(activeStreams.keys()),
    },
    resources: systemResources,
  });
});

// Input validation functions
function validateRtspUrl(url) {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== "rtsp:") {
      return { valid: false, error: "Only RTSP protocol is allowed" };
    }

    // Basic hostname validation
    const hostname = urlObj.hostname;
    if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") {
      return { valid: false, error: "Localhost URLs are not allowed" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Invalid URL format" };
  }
}

function validateStreamId(id) {
  // Allow only alphanumeric characters, hyphens, and underscores
  const regex = /^[a-zA-Z0-9_-]+$/;
  if (!regex.test(id) || id.length > 50) {
    return {
      valid: false,
      error: "Stream ID must be alphanumeric (max 50 chars)",
    };
  }
  return { valid: true };
}

function sanitizeInput(input) {
  if (typeof input !== "string") return "";
  // Remove potentially dangerous characters
  return input.replace(/[;&|`$(){}[\]\\]/g, "");
}

// Use minimal safe FFmpeg parameters for maximum compatibility
function getBasicFFmpegFeatures() {
  if (ffmpegFeatures !== null) {
    return ffmpegFeatures;
  }

  // Set conservative defaults that work across most FFmpeg versions
  ffmpegFeatures = {
    supportsReconnect: false,
    supportsRtspTransport: true,
    supportsSync: false,
    supportsMaxDelay: false,
    supportsErrDetect: false,
    version: "6.1.1-compatible",
  };

  console.log("Using conservative FFmpeg parameters:", ffmpegFeatures);
  return ffmpegFeatures;
}

// Monitor system resources for multiple cameras
function monitorResources() {
  const used = process.memoryUsage();
  systemResources = {
    cpuUsage: process.cpuUsage(),
    memoryUsage: Math.round((used.heapUsed / 1024 / 1024) * 100) / 100,
    activeProcesses: activeStreams.size,
    lastCheck: Date.now(),
  };

  if (systemResources.activeProcesses > 1) {
    console.log(
      `System resources: ${systemResources.memoryUsage}MB memory, ${systemResources.activeProcesses} active streams`,
    );
  }
}

// Check resources every 30 seconds
setInterval(monitorResources, 30000);

// Auto-load cameras function
async function autoLoadConfiguredCameras() {
  if (!autoLoadCameras) {
    console.log("Auto-load cameras disabled");
    return;
  }

  console.log("🎬 Auto-loading configured cameras...");

  const cameras = [];

  // Load up to 4 cameras from environment
  for (let i = 1; i <= 4; i++) {
    const url = process.env[`CAMERA_${i}_URL`];
    const name = process.env[`CAMERA_${i}_NAME`];
    const id = process.env[`CAMERA_${i}_ID`];

    if (url && id) {
      cameras.push({ url, name: name || `Camera ${i}`, id });
    }
  }

  if (cameras.length === 0) {
    console.log("No cameras configured in environment variables");
    return;
  }

  console.log(`Found ${cameras.length} cameras to auto-load:`);
  cameras.forEach((cam, index) => {
    console.log(`  ${index + 1}. ${cam.name} (${cam.id})`);
  });

  // Start cameras with delay between each
  for (let i = 0; i < cameras.length; i++) {
    const camera = cameras[i];

    if (i > 0) {
      console.log(`Waiting ${autoStartDelay}ms before starting next camera...`);
      await new Promise((resolve) => setTimeout(resolve, autoStartDelay));
    }

    try {
      console.log(`🎥 Starting ${camera.name}...`);
      await startCameraStream(camera.url, camera.id);
      console.log(`✅ ${camera.name} started successfully`);
    } catch (error) {
      console.error(`❌ Failed to start ${camera.name}:`, error.message);
    }
  }

  console.log(`🎬 Auto-load complete. ${activeStreams.size} cameras running.`);
}

// Internal function to start a camera stream
async function startCameraStream(rtspUrl, streamId) {
  // Validate inputs
  const urlValidation = validateRtspUrl(rtspUrl);
  if (!urlValidation.valid) {
    throw new Error(urlValidation.error);
  }

  const idValidation = validateStreamId(streamId);
  if (!idValidation.valid) {
    throw new Error(idValidation.error);
  }

  // Check if stream already exists
  if (activeStreams.has(streamId)) {
    throw new Error(`Stream ${streamId} already active`);
  }

  // Check maximum concurrent streams
  const maxStreams = process.env.MAX_CONCURRENT_STREAMS || 10;
  if (activeStreams.size >= maxStreams) {
    throw new Error("Maximum concurrent streams limit reached");
  }

  // Add delay for multiple cameras
  if (activeStreams.size > 0) {
    const delay = process.env.MULTI_CAMERA_DELAY || 2000;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  // Create HLS output directory
  const hlsDir = path.join(__dirname, "public", "streams", streamId);
  if (!fs.existsSync(hlsDir)) {
    fs.mkdirSync(hlsDir, { recursive: true });
  }

  // Sanitize the RTSP URL
  const sanitizedUrl = sanitizeInput(rtspUrl);

  // Use FFmpeg configuration optimized for multiple cameras
  const features = getBasicFFmpegFeatures();

  const ffmpegArgs = [
    "-fflags",
    "+genpts+discardcorrupt",
    "-err_detect",
    "ignore_err",
    "-rtsp_transport",
    "tcp",
    "-timeout",
    "30000000",
    "-user_agent",
    "UniFiVideo",
    "-thread_queue_size",
    "1024",
    "-analyzeduration",
    "1000000",
    "-probesize",
    "1000000",
    "-i",
    sanitizedUrl,
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    "-f",
    "hls",
    "-hls_time",
    "3",
    "-hls_list_size",
    "8",
    "-hls_flags",
    "delete_segments+independent_segments",
    "-preset",
    "faster",
    "-tune",
    "zerolatency",
    "-profile:v",
    "main",
    "-level",
    "3.1",
    "-g",
    "30",
    "-sc_threshold",
    "0",
    "-b:v",
    activeStreams.size > 0 ? "1200k" : "1500k",
    "-maxrate",
    activeStreams.size > 0 ? "1600k" : "2000k",
    "-bufsize",
    activeStreams.size > 0 ? "3200k" : "4000k",
    "-b:a",
    activeStreams.size > 0 ? "96k" : "128k",
    "-avoid_negative_ts",
    "make_zero",
    "-movflags",
    "+faststart",
    "-loglevel",
    "warning",
    path.join(hlsDir, "stream.m3u8"),
  ];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: process.env.PATH },
    });

    ffmpeg.stdout.on("data", (data) => {
      // Silent for auto-load
    });

    ffmpeg.stderr.on("data", (data) => {
      const message = data.toString();
      // Only log errors for auto-load
      if (message.includes("error") || message.includes("failed")) {
        console.log(`FFmpeg [${streamId}]: ${message.slice(0, 100)}`);
      }
    });

    ffmpeg.on("close", (code) => {
      console.log(`FFmpeg process closed with code ${code} for ${streamId}`);
      activeStreams.delete(streamId);

      // Clean up HLS files
      setTimeout(() => {
        if (fs.existsSync(hlsDir)) {
          try {
            fs.rmSync(hlsDir, { recursive: true, force: true });
          } catch (err) {
            console.error(`Error cleaning up HLS files for ${streamId}:`, err);
          }
        }
      }, 5000);
    });

    ffmpeg.on("error", (err) => {
      console.error(`FFmpeg error for ${streamId}:`, err);
      activeStreams.delete(streamId);
      reject(err);
    });

    // Set timeout
    const timeout = setTimeout(() => {
      ffmpeg.kill("SIGTERM");
      activeStreams.delete(streamId);
      reject(new Error("FFmpeg timeout"));
    }, 300000);

    // Check HLS file generation
    const checkInterval = setInterval(() => {
      const m3u8Path = path.join(hlsDir, "stream.m3u8");
      if (fs.existsSync(m3u8Path)) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        resolve();
      }
    }, 5000);

    // Store stream info
    activeStreams.set(streamId, {
      rtspUrl: sanitizedUrl,
      ffmpegProcess: ffmpeg,
      startTime: new Date(),
      hlsPath: `/streams/${streamId}/stream.m3u8`,
      timeout: timeout,
      checkInterval: checkInterval,
    });

    // Resolve after 10 seconds if process is still running
    setTimeout(() => {
      if (activeStreams.has(streamId)) {
        clearInterval(checkInterval);
        clearTimeout(timeout);
        resolve();
      }
    }, 10000);
  });
}

// API endpoint to manage auto-loaded cameras
app.get("/api/cameras/auto-load", (req, res) => {
  const cameras = [];

  for (let i = 1; i <= 4; i++) {
    const url = process.env[`CAMERA_${i}_URL`];
    const name = process.env[`CAMERA_${i}_NAME`];
    const id = process.env[`CAMERA_${i}_ID`];

    if (url && id) {
      cameras.push({
        index: i,
        name: name || `Camera ${i}`,
        id,
        url: url.replace(/:[^:@]*@/, ":***@"), // Hide password
        active: activeStreams.has(id),
      });
    }
  }

  res.json({
    autoLoadEnabled: autoLoadCameras,
    configuredCameras: cameras.length,
    cameras,
    activeStreams: activeStreams.size,
  });
});

// API endpoint to start all configured cameras
app.post("/api/cameras/start-all", async (req, res) => {
  try {
    await autoLoadConfiguredCameras();
    res.json({
      success: true,
      message: "Auto-load cameras initiated",
      activeStreams: activeStreams.size,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API endpoint to stop all cameras
app.post("/api/cameras/stop-all", (req, res) => {
  try {
    let stopped = 0;
    for (const [streamId, stream] of activeStreams) {
      try {
        if (stream.timeout) {
          clearTimeout(stream.timeout);
        }
        if (stream.checkInterval) {
          clearInterval(stream.checkInterval);
        }
        stream.ffmpegProcess.kill("SIGTERM");
        stopped++;
      } catch (error) {
        console.error(`Error stopping stream ${streamId}:`, error);
      }
    }

    activeStreams.clear();

    res.json({
      success: true,
      message: `Stopped ${stopped} cameras`,
      stoppedCount: stopped,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// API endpoint to start RTSP stream
app.post("/api/stream/start", async (req, res) => {
  const { rtspUrl, streamId } = req.body;

  if (!rtspUrl || !streamId) {
    return res
      .status(400)
      .json({ error: "RTSP URL and Stream ID are required" });
  }

  // Validate inputs
  const urlValidation = validateRtspUrl(rtspUrl);
  if (!urlValidation.valid) {
    return res.status(400).json({ error: urlValidation.error });
  }

  const idValidation = validateStreamId(streamId);
  if (!idValidation.valid) {
    return res.status(400).json({ error: idValidation.error });
  }

  // Check if stream already exists
  if (activeStreams.has(streamId)) {
    return res.status(400).json({ error: "Stream already active" });
  }

  // Check maximum concurrent streams
  const maxStreams = process.env.MAX_CONCURRENT_STREAMS || 10;
  if (activeStreams.size >= maxStreams) {
    return res
      .status(429)
      .json({ error: "Maximum concurrent streams limit reached" });
  }

  // Add delay between multiple camera starts to prevent resource conflicts
  if (activeStreams.size > 0) {
    const delay = process.env.MULTI_CAMERA_DELAY || 2000;
    console.log(`Multiple cameras detected, adding ${delay}ms delay...`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  try {
    // Create HLS output directory
    const hlsDir = path.join(__dirname, "public", "streams", streamId);
    if (!fs.existsSync(hlsDir)) {
      fs.mkdirSync(hlsDir, { recursive: true });
    }

    // Sanitize the RTSP URL to prevent command injection
    const sanitizedUrl = sanitizeInput(rtspUrl);

    // Use basic FFmpeg configuration for compatibility
    const features = getBasicFFmpegFeatures();

    // FFmpeg command optimized for Ubiquiti UniFi cameras
    const ffmpegArgs = [
      "-fflags",
      "+genpts+discardcorrupt",
      "-err_detect",
      "ignore_err",
      "-rtsp_transport",
      "tcp",
      "-timeout",
      "30000000",
      "-user_agent",
      "UniFiVideo",
      "-thread_queue_size",
      "1024",
      "-analyzeduration",
      "1000000",
      "-probesize",
      "1000000",
      "-i",
      sanitizedUrl,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-f",
      "hls",
      "-hls_time",
      "3",
      "-hls_list_size",
      "8",
      "-hls_flags",
      "delete_segments+independent_segments",
      "-preset",
      "faster",
      "-tune",
      "zerolatency",
      "-profile:v",
      "main",
      "-level",
      "3.1",
      "-g",
      "30",
      "-sc_threshold",
      "0",
      "-b:v",
      activeStreams.size > 1 ? "1200k" : "1500k",
      "-maxrate",
      activeStreams.size > 1 ? "1600k" : "2000k",
      "-bufsize",
      activeStreams.size > 1 ? "3200k" : "4000k",
      "-b:a",
      activeStreams.size > 1 ? "96k" : "128k",
      "-avoid_negative_ts",
      "make_zero",
      "-movflags",
      "+faststart",
      "-loglevel",
      "warning",
      path.join(hlsDir, "stream.m3u8"),
    ];

    const ffmpeg = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, PATH: process.env.PATH },
    });

    ffmpeg.stdout.on("data", (data) => {
      console.log(
        `FFmpeg stdout [${streamId}]: ${data.toString().slice(0, 200)}`,
      );
    });

    ffmpeg.stderr.on("data", (data) => {
      const message = data.toString();
      console.log(`FFmpeg stderr [${streamId}]: ${message.slice(0, 200)}`);
    });

    ffmpeg.on("close", (code) => {
      console.log(
        `FFmpeg process closed with code ${code} for stream ${streamId} (${activeStreams.size} streams remaining)`,
      );

      // Log final state of HLS directory
      const hlsDir = path.join(__dirname, "public", "streams", streamId);
      if (fs.existsSync(hlsDir)) {
        const files = fs.readdirSync(hlsDir);
        console.log(`HLS files generated for ${streamId}:`, files);
      } else {
        console.log(`No HLS directory found for ${streamId}`);
      }

      activeStreams.delete(streamId);

      // Clean up HLS files on close
      setTimeout(() => {
        if (fs.existsSync(hlsDir)) {
          try {
            fs.rmSync(hlsDir, { recursive: true, force: true });
            console.log(`Cleaned up HLS files for ${streamId}`);
          } catch (err) {
            console.error(`Error cleaning up HLS files for ${streamId}:`, err);
          }
        }
      }, 5000);
    });

    ffmpeg.on("error", (err) => {
      console.error(`FFmpeg error for stream ${streamId}:`, err);
      activeStreams.delete(streamId);
    });

    // Check HLS file generation periodically
    const checkInterval = setInterval(() => {
      const hlsDir = path.join(__dirname, "public", "streams", streamId);
      const m3u8Path = path.join(hlsDir, "stream.m3u8");

      if (fs.existsSync(m3u8Path)) {
        const stats = fs.statSync(m3u8Path);
        const files = fs.readdirSync(hlsDir);
        console.log(
          `HLS check [${streamId}]: ${files.length} files, m3u8 size: ${stats.size}, active streams: ${activeStreams.size}`,
        );
      } else {
        console.log(
          `HLS check [${streamId}]: No m3u8 file found yet, active streams: ${activeStreams.size}`,
        );
      }
    }, 15000); // Check every 15 seconds for multiple streams

    // Set timeout to prevent hanging processes
    const timeout = setTimeout(() => {
      console.log(`Timeout reached for stream ${streamId}, killing process`);
      clearInterval(checkInterval);
      ffmpeg.kill("SIGTERM");
      activeStreams.delete(streamId);
    }, 300000); // 5 minutes timeout

    // Store stream info
    activeStreams.set(streamId, {
      rtspUrl: sanitizedUrl,
      ffmpegProcess: ffmpeg,
      startTime: new Date(),
      hlsPath: `/streams/${streamId}/stream.m3u8`,
      timeout: timeout,
      checkInterval: checkInterval,
    });

    res.json({
      success: true,
      streamId,
      hlsUrl: `/streams/${streamId}/stream.m3u8`,
      message: "Stream started successfully",
    });
  } catch (error) {
    console.error("Error starting stream:", error);
    res.status(500).json({ error: "Failed to start stream" });
  }
});

// API endpoint to stop RTSP stream
app.post("/api/stream/stop", (req, res) => {
  const { streamId } = req.body;

  if (!streamId) {
    return res.status(400).json({ error: "Stream ID is required" });
  }

  // Validate stream ID
  const idValidation = validateStreamId(streamId);
  if (!idValidation.valid) {
    return res.status(400).json({ error: idValidation.error });
  }

  const stream = activeStreams.get(streamId);
  if (!stream) {
    return res.status(404).json({ error: "Stream not found" });
  }

  try {
    // Clear timeout and interval if exists
    if (stream.timeout) {
      clearTimeout(stream.timeout);
    }
    if (stream.checkInterval) {
      clearInterval(stream.checkInterval);
    }

    // Kill FFmpeg process
    stream.ffmpegProcess.kill("SIGTERM");

    // Force kill after 5 seconds if still running
    setTimeout(() => {
      try {
        stream.ffmpegProcess.kill("SIGKILL");
      } catch (err) {
        // Process might already be dead
      }
    }, 5000);

    activeStreams.delete(streamId);

    // Clean up HLS files
    const hlsDir = path.join(__dirname, "public", "streams", streamId);
    if (fs.existsSync(hlsDir)) {
      try {
        fs.rmSync(hlsDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`Error cleaning up HLS files for ${streamId}:`, err);
      }
    }

    res.json({ success: true, message: "Stream stopped successfully" });
  } catch (error) {
    console.error("Error stopping stream:", error);
    res.status(500).json({ error: "Failed to stop stream" });
  }
});

// API endpoint to list active streams
app.get("/api/streams", (req, res) => {
  const streams = Array.from(activeStreams.entries()).map(([id, stream]) => ({
    id,
    rtspUrl: stream.rtspUrl,
    startTime: stream.startTime,
    hlsUrl: stream.hlsPath,
  }));

  res.json({ streams });
});

// API endpoint to get stream status
app.get("/api/stream/:streamId/status", (req, res) => {
  const { streamId } = req.params;
  const stream = activeStreams.get(streamId);

  if (!stream) {
    return res.status(404).json({ error: "Stream not found" });
  }

  res.json({
    id: streamId,
    rtspUrl: stream.rtspUrl,
    startTime: stream.startTime,
    hlsUrl: stream.hlsPath,
    active: true,
  });
});

// Create streams directory if it doesn't exist
const streamsDir = path.join(__dirname, "public", "streams");
if (!fs.existsSync(streamsDir)) {
  fs.mkdirSync(streamsDir, { recursive: true });
}

// Cleanup function for graceful shutdown
const cleanup = () => {
  console.log("Cleaning up active streams...");
  for (const [streamId, stream] of activeStreams) {
    try {
      // Clear timeouts and intervals
      if (stream.timeout) {
        clearTimeout(stream.timeout);
      }
      if (stream.checkInterval) {
        clearInterval(stream.checkInterval);
      }

      // Kill processes
      stream.ffmpegProcess.kill("SIGTERM");

      // Force kill after 2 seconds
      setTimeout(() => {
        try {
          stream.ffmpegProcess.kill("SIGKILL");
        } catch (err) {
          // Process might already be dead
        }
      }, 2000);

      // Clean up files
      const hlsDir = path.join(__dirname, "public", "streams", streamId);
      if (fs.existsSync(hlsDir)) {
        try {
          fs.rmSync(hlsDir, { recursive: true, force: true });
        } catch (err) {
          console.error(`Error cleaning up files for ${streamId}:`, err);
        }
      }
    } catch (error) {
      console.error(`Error cleaning up stream ${streamId}:`, error);
    }
  }
  activeStreams.clear();
};

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// Handle 404 errors
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Handle graceful shutdown
process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`RTSP Web Viewer server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);

  // Auto-load cameras after server starts
  if (autoLoadCameras) {
    setTimeout(() => {
      autoLoadConfiguredCameras().catch((error) => {
        console.error("Auto-load cameras failed:", error);
      });
    }, 2000); // Wait 2 seconds after server start
  }
});

module.exports = app;
