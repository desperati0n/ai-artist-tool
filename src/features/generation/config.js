

const PLUGIN_ID = 'nai-batch-plugin-root';

const STYLE_ID = 'nai-batch-plugin-style';

const GENERATED_JPEG_QUALITY = 0.94;

const RESULT_RENDER_BATCH_SIZE = 10;

const MODEL_OPTIONS = [
    ['nai-diffusion-5-full', 'NAI Diffusion V5 · Full'],
    ['nai-diffusion-5-curated', 'NAI Diffusion V5 · Curated'],
    ['nai-diffusion-4-5-full', 'NAI Diffusion V4.5 · Full'],
    ['nai-diffusion-4-5-curated', 'NAI Diffusion V4.5 · Curated'],
    ['nai-diffusion-4-full', 'NAI Diffusion V4 · Full'],
    ['nai-diffusion-4-curated', 'NAI Diffusion V4 · Curated'],
    ['nai-diffusion-3', 'NAI Diffusion Anime V3'],
    ['nai-diffusion-furry-3', 'NAI Diffusion Furry V3']
  ];

const DEFAULTS = {
    model: 'nai-diffusion-5-full',
    positive: '{artist},masterpiece, best quality, amazing quality, very aesthetic, absurdres, cinematic illustration,1 girl, beach, solo, hand up, kneeling, barefoot, peace sign, bikini,',
    negative: 'lowres, bad anatomy, bad hands, text, error, blurry, worst quality, low quality, jpeg artifacts, signature, watermark, username',
    width: 832,
    height: 1216,
    steps: 28,
    scale: 5,
    sampler: 'k_euler_ancestral',
    quality: true
  };

export {PLUGIN_ID,STYLE_ID,GENERATED_JPEG_QUALITY,RESULT_RENDER_BATCH_SIZE,MODEL_OPTIONS,DEFAULTS};
