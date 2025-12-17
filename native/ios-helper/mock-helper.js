#!/usr/bin/env node
/**
 * Mock iOS helper for testing the video pipeline
 * Uses FFmpeg to generate valid H.264 frames
 */

const { spawn } = require('child_process');

const MESSAGE_TYPE = {
  DEVICE_LIST: 0x01,
  DEVICE_INFO: 0x02,
  VIDEO_CONFIG: 0x03,
  VIDEO_FRAME: 0x04,
  ERROR: 0x05,
  STATUS: 0x06,
};

const WIDTH = 640;
const HEIGHT = 480;
const FPS = 30;

function writeMessage(type, payload) {
  const header = Buffer.alloc(5);
  header.writeUInt8(type, 0);
  header.writeUInt32BE(payload.length, 1);
  process.stdout.write(header);
  process.stdout.write(payload);
}

function writeStatus(message) {
  writeMessage(MESSAGE_TYPE.STATUS, Buffer.from(message, 'utf8'));
}

function writeError(message) {
  writeMessage(MESSAGE_TYPE.ERROR, Buffer.from(message, 'utf8'));
}

function writeDeviceInfo(udid) {
  const info = JSON.stringify({
    udid: udid,
    name: 'Mock iPhone',
    model: 'iPhone Mock',
  });
  writeMessage(MESSAGE_TYPE.DEVICE_INFO, Buffer.from(info, 'utf8'));
}

/**
 * Parse H.264 Annex B stream to find NAL units
 * Returns array of { type, data, isKeyFrame }
 */
function parseNALUnits(buffer) {
  const nalUnits = [];
  let i = 0;

  while (i < buffer.length - 4) {
    // Look for start code (0x00 0x00 0x00 0x01 or 0x00 0x00 0x01)
    let startCodeLen = 0;
    if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 0 && buffer[i + 3] === 1) {
      startCodeLen = 4;
    } else if (buffer[i] === 0 && buffer[i + 1] === 0 && buffer[i + 2] === 1) {
      startCodeLen = 3;
    } else {
      i++;
      continue;
    }

    // Find next start code
    let nextStart = buffer.length;
    for (let j = i + startCodeLen; j < buffer.length - 3; j++) {
      if (
        (buffer[j] === 0 && buffer[j + 1] === 0 && buffer[j + 2] === 0 && buffer[j + 3] === 1) ||
        (buffer[j] === 0 && buffer[j + 1] === 0 && buffer[j + 2] === 1)
      ) {
        nextStart = j;
        break;
      }
    }

    const nalData = buffer.subarray(i, nextStart);
    const nalHeader = buffer[i + startCodeLen];
    const nalType = nalHeader & 0x1f;

    nalUnits.push({
      type: nalType,
      data: nalData,
      isKeyFrame: nalType === 5, // IDR
      isSPS: nalType === 7,
      isPPS: nalType === 8,
    });

    i = nextStart;
  }

  return nalUnits;
}

function handleList() {
  writeStatus('Scanning for iOS devices...');

  const devices = [{ udid: 'MOCK-DEVICE-001', name: 'Mock iPhone', model: 'iPhone Mock' }];

  writeMessage(MESSAGE_TYPE.DEVICE_LIST, Buffer.from(JSON.stringify(devices), 'utf8'));
  process.exit(0);
}

function handleStream(udid) {
  writeStatus('Starting mock iOS screen capture...');
  writeDeviceInfo(udid);

  // Check if FFmpeg is available
  const checkFfmpeg = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'pipe', 'pipe'] });

  checkFfmpeg.on('error', () => {
    writeError('FFmpeg not found. Please install FFmpeg for mock video output.');
    process.exit(1);
  });

  checkFfmpeg.on('close', (code) => {
    if (code !== 0) {
      writeError('FFmpeg not available');
      process.exit(1);
    }
    startFfmpegStream();
  });
}

function startFfmpegStream() {
  writeStatus(`Generating ${WIDTH}x${HEIGHT} test pattern...`);

  // FFmpeg command to generate test pattern with H.264 output
  // - testsrc2: generates a test pattern with moving elements
  // - Output raw H.264 Annex B stream to stdout
  const ffmpeg = spawn(
    'ffmpeg',
    [
      '-f',
      'lavfi',
      '-i',
      `testsrc2=size=${WIDTH}x${HEIGHT}:rate=${FPS}`,
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-tune',
      'zerolatency',
      '-profile:v',
      'baseline',
      '-level',
      '3.1',
      '-g',
      String(FPS * 2), // Keyframe every 2 seconds
      '-keyint_min',
      String(FPS),
      '-sc_threshold',
      '0',
      '-b:v',
      '1M',
      '-maxrate',
      '1M',
      '-bufsize',
      '2M',
      '-f',
      'h264', // Raw H.264 Annex B output
      '-', // Output to stdout
    ],
    {
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  let buffer = Buffer.alloc(0);
  let sentConfig = false;
  let spsData = null;
  let ppsData = null;
  let frameCount = 0;
  const startTime = Date.now();

  ffmpeg.stdout.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    // Parse NAL units from buffer
    const nalUnits = parseNALUnits(buffer);

    if (nalUnits.length === 0) {
      return;
    }

    // Keep only unparsed data in buffer
    const lastNal = nalUnits[nalUnits.length - 1];
    const lastNalEnd = buffer.indexOf(lastNal.data) + lastNal.data.length;
    buffer = buffer.subarray(lastNalEnd);

    for (const nal of nalUnits) {
      // Collect SPS/PPS for config
      if (nal.isSPS) {
        spsData = nal.data;
      }
      if (nal.isPPS) {
        ppsData = nal.data;
      }

      // Send VIDEO_CONFIG once we have SPS and PPS
      if (!sentConfig && spsData && ppsData) {
        const configPayload = Buffer.alloc(8 + spsData.length + ppsData.length);
        configPayload.writeUInt32BE(WIDTH, 0);
        configPayload.writeUInt32BE(HEIGHT, 4);
        spsData.copy(configPayload, 8);
        ppsData.copy(configPayload, 8 + spsData.length);
        writeMessage(MESSAGE_TYPE.VIDEO_CONFIG, configPayload);
        writeStatus(`Streaming at ${WIDTH}x${HEIGHT}`);
        sentConfig = true;
      }

      // Send video frames (skip SPS/PPS as separate frames, they're in config)
      if (sentConfig && !nal.isSPS && !nal.isPPS) {
        const pts = (Date.now() - startTime) * 1000; // microseconds
        const flags = nal.isKeyFrame ? 0x01 : 0x00;

        const payload = Buffer.alloc(9 + nal.data.length);
        payload.writeUInt8(flags, 0);
        payload.writeUInt32BE(Math.floor(pts / 0x100000000), 1);
        payload.writeUInt32BE(pts >>> 0, 5);
        nal.data.copy(payload, 9);

        writeMessage(MESSAGE_TYPE.VIDEO_FRAME, payload);
        frameCount++;

        // Log progress periodically
        if (frameCount % 30 === 0) {
          process.stderr.write(`[mock-helper] Sent ${frameCount} frames\n`);
        }
      }
    }
  });

  ffmpeg.stderr.on('data', (data) => {
    // FFmpeg logs to stderr, only show errors
    const msg = data.toString();
    if (msg.includes('Error') || msg.includes('error')) {
      process.stderr.write(`[ffmpeg] ${msg}`);
    }
  });

  ffmpeg.on('error', (err) => {
    writeError(`FFmpeg error: ${err.message}`);
    process.exit(1);
  });

  ffmpeg.on('close', (code) => {
    if (code !== 0) {
      writeError(`FFmpeg exited with code ${code}`);
    }
    process.exit(code || 0);
  });

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    ffmpeg.kill('SIGTERM');
  });

  process.on('SIGINT', () => {
    ffmpeg.kill('SIGINT');
  });
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'list') {
  handleList();
} else if (command === 'stream' && args[1]) {
  handleStream(args[1]);
} else {
  process.stderr.write('Usage: mock-helper.js <list|stream <UDID>>\n');
  process.exit(1);
}
