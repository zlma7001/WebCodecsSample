
/*
 *  Copyright (c) 2021.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

function createVideoDecoder(codec, output_cb, err_cb) {
  try {
    const video_decoder_init = {
      output: output_cb,
      error: err_cb,
    };

    let video_decoder = new VideoDecoder(video_decoder_init);

    const params = {
      codec: codec,
    };
    console.log(params);

    video_decoder.configure(params);
    return video_decoder;
  } catch (e) {
    console.log(e);
  }
}

function createVideoEncoder(codec, width, height, bitrate, framerate, numTemporalLayers, acceleration, output_cb, err_cb) {
  const video_encoder_init = {
    output: output_cb,
    error: err_cb,
  };

  let video_encoder = new VideoEncoder(video_encoder_init);

  const params = {
    codec: codec,
    profile: codec,
    width: width,
    height: height,
    bitrate: bitrate,
    framerate: framerate,
    acceleration: acceleration,
  };
  if (numTemporalLayers > 1)
    params.scalabilityMode = "L1T" + numTemporalLayers;

  console.log(params);

  video_encoder.configure(params);
  console.log(video_encoder);
  return video_encoder;
}

async function drawFrameToCanvas(canvas, video_frame) {
  canvas.width = video_frame.displayWidth;
  canvas.height = video_frame.displayHeight;
  let context = canvas.getContext("2d");

  createImageBitmap(video_frame).then((toImageBitmap) => {
    context.drawImage(toImageBitmap, 0, 0);
  });
}

async function createVideoFrameFromUserMedia(usermedia, timestamp) {
  let imageBitmap = await createImageBitmap(usermedia);

  let video_frame_init = {
    timestamp: timestamp,
    duration: undefined,
  }

  return new VideoFrame(imageBitmap, video_frame_init);
}
