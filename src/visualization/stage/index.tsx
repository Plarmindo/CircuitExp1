// Export both PixiJS and SVG versions
// SVG version is recommended for production (simpler, more reliable, no GPU issues)

export { MetroStage } from './metro-stage'; // PixiJS version (legacy)
export { MetroStageSVG } from './metro-stage-svg'; // SVG version (recommended)

// Export SVG as default for new usage
export { MetroStageSVG as default } from './metro-stage-svg';
