# Cosmic Particles - Hand Gesture Visualization

An interactive 3D particle visualization system controlled by hand gestures using webcam input. Built with Three.js and MediaPipe Hand Landmarker.

## Features

- **40,000 particles** (adaptive based on device capability)
- **Real-time hand gesture recognition** with MediaPipe
- **6 unique particle formations**: Sphere, Heart, Saturn, Nebula, Entity, Nova
- **Interactive gestures**:
  - ✊ Fist - Freeze particles
  - 👌 Pinch - Attract particles to pinch point
  - ✌️ Peace - Pulsing effect
  - 🖐️ Open hand (5 fingers) - Expansion/Wind effects
  - 🖐️ Swipe left/right - Change formations
  - ☝️ One finger - Collapse particles
- **Advanced visual effects**: Bloom, particle trails, color gradients
- **Responsive design**: Optimized for desktop and mobile

## Performance Optimizations

### Adaptive Particle System
- **Desktop (8+ cores)**: 40,000 particles
- **Mid-range**: 25,000 particles
- **Mobile/Low-end**: 15,000 particles

### Throttled Hand Detection
- Hand detection runs at **20 FPS** (independent of render loop at 60 FPS)
- Reduces CPU usage by ~66% compared to 60 FPS detection

### Optimized Video Processing
- Camera resolution: **320x240** (reduced from 640x480)
- Lower bandwidth and processing overhead

### Memory Management
- Automatic cleanup of video streams on page unload
- Proper disposal of Three.js resources (geometries, materials, textures)

### Mobile Optimizations
- Gesture log hidden on mobile devices
- Reduced UI element sizes
- Simplified layout for small screens

## Technical Stack

- **Three.js** - 3D rendering and particle system
- **MediaPipe Hand Landmarker** - Real-time hand tracking
- **WebGL Shaders** - Custom vertex/fragment shaders with simplex noise
- **Post-processing**: Unreal Bloom Pass for glow effects

## File Structure

```
hands/
├── index.html      # Main HTML structure and styles
├── app.js          # Application logic (modular)
└── README.md       # This file
```

## Configuration

All configurable parameters are centralized in the `CONFIG` object in [app.js](app.js):

```javascript
const CONFIG = {
    particles: {
        count: 15000-40000 (adaptive),
        backgroundCount: 200,
        defaultSize: 5.0
    },
    rendering: {
        pixelRatio: max 2,
        antialias: false,
        powerPreference: "high-performance"
    },
    handDetection: {
        fps: 20,
        numHands: 2
    },
    gestures: {
        swipeThreshold: 0.15,
        swipeCooldown: 1000,
        swipeVelocityMin: 0.15
    },
    physics: {
        smoothingFactor: 0.1,
        gestureSmoothingFactor: 0.15
    }
}
```

## Usage

1. Open `index.html` in a modern web browser
2. Grant camera permissions when prompted
3. Position your hand(s) in view of the webcam
4. Perform gestures to control the particles

### Gesture Guide

| Gesture | Effect |
|---------|--------|
| ✊ Fist | Freeze all particle movement |
| 👌 Pinch (thumb + index) | Attract particles to pinch point |
| ✌️ Peace sign | Pulsing/breathing effect |
| 🖐️ 5 fingers open | Expansion + wind direction |
| 🖐️➡️ Swipe right | Next formation |
| 🖐️⬅️ Swipe left | Previous formation |
| ☝️ 1 finger up | Collapse to center |
| 🤚 2-4 fingers | Directional wind force |

### UI Controls

- **Glow Intensity Slider**: Adjust bloom strength (0-4)
- **Particle Size Slider**: Adjust base particle size (1-10)
- **Shape Buttons**: Directly select particle formation

## Browser Compatibility

- Chrome/Edge 90+ (recommended)
- Firefox 88+
- Safari 14.1+

Requires:
- WebGL2 support
- MediaDevices API (getUserMedia)
- ES6 modules

## Performance Tips

1. **Close other browser tabs** to free up GPU resources
2. **Use Chrome/Edge** for best performance (better WebGL optimization)
3. **Good lighting** helps hand detection accuracy
4. **Position hands 1-2 feet from camera** for optimal tracking

## License

MIT License - Free to use and modify

## Credits

Built with:
- [Three.js](https://threejs.org/)
- [MediaPipe](https://developers.google.com/mediapipe)
- Simplex noise implementation by Stefan Gustavson
