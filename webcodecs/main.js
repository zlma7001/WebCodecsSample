/*
 *  Copyright (c) 2021.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');

startButton.disabled = false;
stopButton.disabled = true;

startButton.addEventListener('click', start);
stopButton.addEventListener('click', stop);

const userMedia = document.getElementById('userMedia');
const playbackCanvas = document.getElementById("playbackCanvas");

function getEncoderVideoCodec() {
  const videoCodecSelect = document.querySelector('#videoCodec');
  const option = videoCodecSelect.options[videoCodecSelect.selectedIndex];
  return option.value;
}

function getEncoderFramerate() {
  const videoFrameRateSelect = document.querySelector('#videoFrameRate');
  const option = videoFrameRateSelect.options[videoFrameRateSelect.selectedIndex];
  return option.value;
}

function getSelectedVideoBitrate() {
  const bitrate = document.querySelector('#videoBitrate');
  return bitrate.value;
}

function getSelectedNumTemporalLayers() {
  const numTemporalLayersSelect = document.querySelector('#numTemporalLayers');
  const option = numTemporalLayersSelect.options[numTemporalLayersSelect.selectedIndex];
  return option.value;
}

function getSelectedVideoResolution() {
  const videoFrameRateSelect = document.querySelector('#videoResolution');
  const option = videoFrameRateSelect.options[videoFrameRateSelect.selectedIndex];
  return option.value;
}

function getVideoEncoderAcceleration() {
  const videoEncoderAccelerationSelect = document.querySelector('#acceleration');
  const option = videoEncoderAccelerationSelect.options[videoEncoderAccelerationSelect.selectedIndex];
  return option.value;
}

function getFrameSource() {
  const frameSourceSelect = document.querySelector('#frameSource');
  const option = frameSourceSelect.options[frameSourceSelect.selectedIndex];
  return option.value;
}

function getUserMediaConstraints() {
  let resolution = getSelectedVideoResolution().split('x');
  let width = resolution[0];
  let height = resolution[1];

  let frameRate = getEncoderFramerate();

  const constraints = {};
  constraints.audio = false;
  constraints.video = {};

  constraints.video.width = {};
  constraints.video.width.min = width;

  constraints.video.width = constraints.video.width || {};
  constraints.video.width.max = width;

  constraints.video.height = {};
  constraints.video.height.min = height;

  constraints.video.height = constraints.video.height || {};
  constraints.video.height.max = height;

  constraints.video.frameRate = {};
  constraints.video.frameRate.min = frameRate;

  constraints.video.frameRate = constraints.video.frameRate || {};
  constraints.video.frameRate.max = frameRate;

  return constraints;
}

async function startUserMedia() {
  if (userMedia.srcObject) {
    userMedia.srcObject.getTracks().forEach(track => track.stop());
    userMedia.srcObject = undefined;
  }

  const stream = await navigator.mediaDevices.getUserMedia(getUserMediaConstraints());
  userMedia.srcObject = stream;

  let mediaStreamTracks = stream.getVideoTracks();
  console.log(mediaStreamTracks);

  return (mediaStreamTracks[0]);
}

// webcodecs
let stopped;

let videoEncoder;
let videoDecoder;

let timer;

function decoded_frame_available(video_frame) {
  console.log(video_frame);
  // TODO(zlma): can we draw video frame to <video> directly, maybe use MSTG?
  drawFrameToCanvas(playbackCanvas, video_frame);
  video_frame.close();
}

function decoder_error_callback(e) {
  console.log(e.message);
}

function encoded_frame_availale(encoded_chunk, metadata) {
  console.log(encoded_chunk);
  console.log('encoded chunk metadata temporal layer index ', metadata.temporalLayerId);

  if (videoDecoder == undefined) {
    videoDecoder = createVideoDecoder(getEncoderVideoCodec(), decoded_frame_available, decoder_error_callback);
  }

  if (videoDecoder.decodeQueueSize >= 15) {
    console.log('Stopped, too many queued frames ', videoDecoder.decodeQueueSize);
    stopped = true;
    return;
  }

  videoDecoder.decode(encoded_chunk);
  console.log(videoDecoder);
}

function encoder_error_callback(e) {
  console.log(e.message);
}

async function start() {
  try {
    startUserMedia()
      .then((video_track) => {
        const resolution = getSelectedVideoResolution().split('x');
        const width = resolution[0];
        const height = resolution[1];

        const codec = getEncoderVideoCodec();
        const acceleration = getVideoEncoderAcceleration();
        const bitrate = getSelectedVideoBitrate();
        const framerate = getEncoderFramerate();
        const numTemporalLayers = getSelectedNumTemporalLayers();

        videoEncoder = createVideoEncoder(codec, width, height, bitrate, framerate,
          numTemporalLayers, acceleration, encoded_frame_availale, encoder_error_callback);

        let encodedFrames = 0;
        let onVideoFrameAvailable = function (video_frame) {
          console.log(video_frame);

          videoEncoder.encode(video_frame, { keyFrame: (encodedFrames++ % 30 == 0) });
          video_frame.close();
        };

        let frameSource = getFrameSource();
        console.log(`frame source is ${frameSource}`);

        if (frameSource == 'camera') {
          const processor = new MediaStreamTrackProcessor({track: video_track});
          const reader = processor.readable.getReader();
          reader.read().then(function processFrame({done, value}) {
            if (done) return;
            onVideoFrameAvailable(value);
            reader.read().then(processFrame);
          });
        } else { // camera->canvas->encoder...
            timer = setInterval(async function () {
              // Make sure the user media has video before we create |video_frame| from the user media.
              if (userMedia.videoWidth > 0) {
                let video_frame = await createVideoFrameFromUserMedia(userMedia, 1000 * Date.now());
                onVideoFrameAvailable(video_frame);
              }
          }, 1000.0 / framerate);
        }
      });

    stopped = false;

    startButton.disabled = true;
    stopButton.disabled = false;
  } catch (e) {
    alert('start error!');
  }
}

async function stop() {
  console.log("stop");
  stopped = true;

  // stop getUserMedia
  userMedia.srcObject.getVideoTracks()[0].stop();
  userMedia.srcObject = null;

  if (timer)
    clearInterval(timer);
  
  await videoEncoder.flush();
  videoEncoder.reset();
  videoEncoder = undefined;

  await videoDecoder.flush();
  videoDecoder.reset();
  videoDecoder = undefined;

  // clear the video data on canvas when we exit
  playbackCanvas.height = playbackCanvas.height;

  playbackCanvas.srcObject = null;

  startButton.disabled = false;
  stopButton.disabled = true;
}
