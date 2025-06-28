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
  const maxStreams = process.env.MAX_CONCURRENT_STREAMS || 5;
  if (activeStreams.size >= maxStreams) {
    return res
      .status(429)
      .json({ error: "Maximum concurrent streams limit reached" });
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

    // FFmpeg command with minimal, widely compatible parameters
    const ffmpegArgs = [
      "-i",
      sanitizedUrl,
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_list_size",
      "10",
      "-hls_flags",
      "delete_segments",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-g",
      "30",
      "-sc_threshold",
      "0",
      "-avoid_negative_ts",
      "make_zero",
      "-loglevel",
      "error",
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
        `FFmpeg process closed with code ${code} for stream ${streamId}`,
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
          `HLS check [${streamId}]: ${files.length} files, m3u8 size: ${stats.size}`,
        );
      } else {
        console.log(`HLS check [${streamId}]: No m3u8 file found yet`);
      }
    }, 10000); // Check every 10 seconds

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
});

module.exports = app;
