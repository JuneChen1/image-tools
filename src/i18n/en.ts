import type { Messages } from './zh'

export const en: Messages = {
  htmlLang: 'en',
  siteTitle: 'Image Toolbox',
  tagline: 'Everything runs in your browser. Your images are never uploaded to any server.',
  langSwitchLabel: 'Language',
  listSep: ', ',
  tabs: { split: 'Split', compress: 'Compress', convert: 'Convert' },
  common: {
    download: 'Download',
    downloadAll: 'Download all (ZIP)',
    clearAll: 'Clear all',
    outputFormat: 'Output format',
    quality: 'Quality',
  },
  dropzone: {
    hint: 'Drop images here, or click to choose files (JPEG, PNG, WebP, AVIF supported)',
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
    numbering: (count) => `Numbered 1–${count} from left to right. Upload them in this order.`,
  },
  batch: {
    compressDropLabel: 'Choose images to compress (multiple allowed)',
    convertDropLabel: 'Choose images to convert (multiple allowed)',
    settingsTitle: 'Settings',
    keepFormat: 'Keep original format',
    maxEdgeLabel: 'Max longest edge',
    unlimited: 'No limit',
    backgroundLabel: 'Fill transparent areas',
    compressPngNote:
      'PNG is lossless, so the quality slider has no effect on it. To shrink files a lot, output WebP or JPEG, or limit the longest edge.',
    convertJpegNote: 'JPEG has no transparency. Transparent areas are filled with the color above.',
    resultsTitle: 'Results',
    processing: 'Processing…',
    total: (before, after) => `Total ${before} → ${after}`,
    saved: (percent) => `saved ${percent}%`,
    grew: (percent) => `grew ${percent}%`,
  },
}
