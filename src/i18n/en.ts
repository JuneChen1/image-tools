import type { Messages } from './zh'

export const en: Messages = {
  htmlLang: 'en',
  siteTitle: 'Image Toolbox',
  langSwitchLabel: 'Language',
  listSep: ', ',
  tabs: { split: 'Split', compress: 'Compress', convert: 'Convert' },
  common: {
    download: 'Download',
    downloadAll: 'Download all (ZIP)',
    share: 'Share / Save to Photos',
    shareFailed: 'Could not open the share sheet. Please use Download instead.',
    clearAll: 'Clear all',
    outputFormat: 'Output format',
    quality: 'Quality',
    processing: 'Processing…',
    avifSlowNote: 'AVIF encoding is slow. Large images can take several seconds or more.',
  },
  dropzone: {
    hint: 'Drop images here, or click to choose files (JPEG, PNG, WebP, AVIF, HEIC supported)',
    singleOnly: 'Only one image can be processed at a time. Please choose just one.',
    limit: (max, skipped) =>
      `Up to ${max} images at a time. Skipped ${skipped} ${skipped === 1 ? 'image' : 'images'}.`,
    tooBig: (count, mb, names) =>
      `Skipped ${count} oversized ${count === 1 ? 'file' : 'files'} (limit ${mb} MB per file): ${names}`,
    rejected: (count, names) =>
      `Skipped ${count} unsupported ${count === 1 ? 'file' : 'files'}: ${names}`,
  },
  errors: {
    generic: 'Something went wrong',
    canvasTooLarge: 'This image is too large for the browser to process',
    encodeFailed: 'The browser could not export the image',
    formatUnsupported: (format) => `This browser cannot export ${format}`,
    readFailed: 'Could not read this image. Please check the file format.',
    tooNarrow: (count) => `The image is too narrow to split into ${count} parts`,
    tooLarge: (megapixels) =>
      `This image has too many pixels (limit ${megapixels} megapixels). Skipped.`,
  },
  split: {
    dropLabel: 'Choose an image to split',
    previewTitle: 'Split preview',
    originalAlt: 'Original image',
    settingsTitle: 'Split settings',
    countLabel: 'Number of parts',
    countOption: (count) => `${count} parts`,
    pngRecommended: ' (lossless, recommended)',
    resultTitle: 'Result',
    numbering: (count) => `Numbered 1–${count} from left to right. To post them to X as one large image, upload them in this order.`,
  },
  batch: {
    compressDropLabel: (max) => `Choose images to compress (up to ${max})`,
    convertDropLabel: (max) => `Choose images to convert (up to ${max})`,
    settingsTitle: 'Settings',
    keepFormat: 'Keep original format',
    maxEdgeLabel: 'Max longest edge',
    unlimited: 'No limit',
    backgroundLabel: 'Background color',
    compressPngNote:
      'PNG is lossless, so the quality slider has no effect on it. To shrink files a lot, output WebP or JPEG, or limit the longest edge.',
    convertJpegNote:
      'JPEG does not support transparent backgrounds. If the image has cut-out (transparent) areas, they will be filled with this color (regular photos are not affected).',
    resultsTitle: 'Results',
    total: (before, after) => `Total ${before} → ${after}`,
    saved: (percent) => `saved ${percent}%`,
    grew: (percent) => `grew ${percent}%`,
  },
}
