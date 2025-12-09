# Physics Modes Documentation

## Overview
The Cosmic Particles system includes 6 interactive physics modes that dramatically alter particle behavior. Each mode can be activated via UI buttons or two-hand gestures.

---

## Physics Modes

### ✨ Normal Mode
**Default State**
- **Description**: Standard particle behavior with gesture-based effects only
- **Characteristics**:
  - Particles follow formation shapes (sphere, nova)
  - Respond to hand gestures (expansion, swirl, wiggle)
  - No external physics forces applied
  - Smooth, predictable movement
- **Use Case**: Best for controlled, artistic visualizations and demonstrations

---

### 🌍 Gravity Mode
**Realistic Falling Physics**
- **Description**: Particles experience downward gravitational pull with ground collision
- **Visual Effects**:
  - Particles fall naturally toward the bottom of the screen
  - Bounce when hitting the floor at Y=-25
  - Slight turbulence creates organic falling motion
  - Horizontal velocity dampens on bounce (90% reduction)
- **Physics Values**:
  - Gravity: 0.25 units/frame² (downward)
  - Floor: Y = -25
  - Bounce: 80% energy retention
  - Friction: 99.5% velocity retention
  - Turbulence: 3% random jitter
- **Expected Behavior**:
  - Particles cascade downward in waves
  - Accumulate at the bottom with bouncing
  - Create waterfall/rain-like effects
  - Can be disrupted by hand gestures
- **Activation**: Click 🌍 button or show ✌️ peace sign with both hands

---

### 🧲 Magnetic Mode
**Hand Attraction Forces**
- **Description**: Particles are magnetically attracted to hand positions
- **Visual Effects**:
  - Particles stream toward your hands
  - Stronger pull when hands are closer
  - Creates swirling vortex patterns around palms
  - Particles cluster around fingertips
- **Physics Values**:
  - Magnetic Strength: 5.0 (very strong)
  - Range: 50 units (large attraction zone)
  - Falloff: Exponential (power 1.5)
  - Tracks: Palm centers + all 5 fingertips per hand
- **Expected Behavior**:
  - Particles form comet-like trails toward hands
  - Dense clusters form near hand positions
  - Move hands to "paint" with particle streams
  - Multiple hands create competing attraction zones
- **Hand Tracking**:
  - Palm center (average of wrist + middle finger base)
  - Thumb tip (landmark 4)
  - Index tip (landmark 8)
  - Middle tip (landmark 12)
  - Ring tip (landmark 16)
  - Pinky tip (landmark 20)
- **Activation**: Click 🧲 button or show 3 fingers with both hands

---

### 💧 Fluid Mode
**Liquid Dynamics Simulation**
- **Description**: Particles behave like water with surface tension and viscosity
- **Visual Effects**:
  - Smooth, flowing liquid-like motion
  - Particles stick together (cohesion)
  - Accumulates at bottom like water pooling
  - Creates wave-like patterns
  - Slight hand attraction creates currents
- **Physics Values**:
  - Gravity: 0.08 (gentle pull)
  - Viscosity: 92% (thick fluid resistance)
  - Surface Tension: 0.3 (strong particle bonding)
  - Friction: 95% per frame
  - Bounce: 40% on floor
  - Turbulence: 10% (creates flow patterns)
- **Expected Behavior**:
  - Particles flow together in blob-like formations
  - Creates tendrils and streams
  - Settles into pools at the bottom
  - Hand movements create ripples and waves
  - Nearby particles attract each other (within 5 units)
- **Surface Tension**:
  - Sampled every 10th particle for performance
  - Checks 50 neighbors forward/backward
  - Creates cohesive liquid droplet effect
- **Activation**: Click 💧 button or show 4 fingers with both hands

---

### ⚛️ Quantum Mode
**Unpredictable Quantum Physics**
- **Description**: Particles exhibit quantum behaviors - teleportation, entanglement, phase shifts
- **Visual Effects**:
  - Random particle teleportation (quantum tunneling)
  - Sudden direction changes (phase shifts)
  - Particle pairs mirror positions (entanglement)
  - Chaotic, glitchy appearance
  - Medium hand attraction
  - High turbulence creates uncertainty
- **Physics Values**:
  - Quantum Jump Chance: 0.2% per particle per frame
  - Jump Radius: 15 units (teleport distance)
  - Phase Shift: 8% chance per frame (random rotation)
  - Entanglement: 2% chance per frame (pair linking)
  - Turbulence: 30% (high chaos)
  - Magnetic Strength: 2.0 (moderate hand pull)
- **Expected Behavior**:
  - Particles blink/teleport to random positions
  - Sudden velocity direction changes
  - Some particles mirror each other's movement
  - Creates digital/glitch art aesthetic
  - Unpredictable but mesmerizing patterns
- **Quantum Effects**:
  - **Tunneling**: Instant position jump within sphere
  - **Phase Shift**: Velocity rotated by random axis/angle
  - **Entanglement**: Particle pairs move toward midpoint between them
- **Activation**: Click ⚛️ button or show open palms (5 fingers) with both hands

---

### 🎈 Anti-Gravity Mode
**Upward Floating Physics**
- **Description**: Inverted gravity - particles float upward like helium balloons
- **Visual Effects**:
  - Particles rise toward the top
  - Bounce off ceiling at Y=+25
  - Gentle, dreamy floating motion
  - Creates ascending streams
  - Slight turbulence for organic movement
- **Physics Values**:
  - Gravity: -0.18 (upward force)
  - Ceiling: Y = +25
  - Bounce: 70% energy retention
  - Friction: 99.4%
  - Viscosity: 98% (smooth resistance)
  - Turbulence: 5% (subtle drift)
- **Expected Behavior**:
  - Particles float upward like bubbles
  - Accumulate at the top with bouncing
  - Create ascending column effects
  - Gentle, relaxing motion
  - Can be pulled down by gestures
- **Activation**: Click 🎈 button (no gesture mapping yet)

---

## Gesture Controls for Physics Modes

### Two-Hand Gesture Mapping
Activate physics modes by showing the same number of fingers on both hands:

| Gesture | Left Hand | Right Hand | Mode Activated |
|---------|-----------|------------|----------------|
| ✌️✌️ | 2 fingers | 2 fingers | 🌍 Gravity |
| 🤟🤟 | 3 fingers | 3 fingers | 🧲 Magnetic |
| 🖖🖖 | 4 fingers | 4 fingers | 💧 Fluid |
| 🖐️🖐️ | 5 fingers | 5 fingers | ⚛️ Quantum |

**Gesture Requirements**:
- Both hands must be visible
- Same finger count on each hand
- Hold for 0.5 seconds to activate
- 2-second cooldown between switches
- Works with any finger combinations (counts extended fingers)

---

## Technical Implementation

### Physics Loop
```javascript
1. Read particle target positions (aTarget attribute)
2. Apply acceleration forces:
   - Gravity (constant downward/upward)
   - Magnetic (toward hand positions)
   - Turbulence (random noise)
3. Update velocities with acceleration
4. Apply damping:
   - Viscosity (fluid resistance)
   - Friction (velocity decay)
5. Update positions with velocity
6. Handle collisions:
   - Floor bounce (gravity)
   - Ceiling bounce (anti-gravity)
7. Apply special effects:
   - Surface tension (fluid cohesion)
   - Quantum jump (teleportation)
   - Phase shift (direction change)
   - Entanglement (pair linking)
8. Write back to target positions
9. Mark geometry for update
```

### Performance Optimizations
- **Delta Time Capping**: Physics timestep capped at 0.1s to prevent explosions
- **Surface Tension Sampling**: Only every 10th particle checks neighbors
- **Neighbor Limitation**: Max 50 neighbors checked (±50 particles)
- **Quantum Effects**: Probabilistic, affects ~0.2-8% of particles per frame
- **Attribute Updates**: Only `aTarget` updated, shader handles final positioning

### Coordinate System
- **World Space**: -30 to +30 X, -25 to +25 Y, -25 to +25 Z
- **Hand Coordinates**: Normalized 0-1 from MediaPipe
- **Conversion Formula**:
  ```javascript
  worldX = (handX - 0.5) * 60
  worldY = (0.5 - handY) * 45
  worldZ = (handZ || 0) * 40 - 20
  ```

---

## Combining Physics with Gestures

Physics modes work **alongside** gesture controls:
- **Expansion**: Physics + open/close hand scaling
- **Swirl**: Physics + rotating particle formation
- **Wiggle**: Physics + fingertip movement intensity
- **Explosion**: Physics + hand distance effects
- **Pinch**: Physics + attraction to pinch point
- **Wind**: Physics + directional hand movement

**Best Combinations**:
- 🌍 Gravity + Expansion: Particles fall while expanding/contracting
- 🧲 Magnetic + Swirl: Creates spiral galaxy effects
- 💧 Fluid + Wiggle: Turbulent water simulation
- ⚛️ Quantum + Pulse: Glitchy pulsing patterns
- 🎈 Anti-Gravity + Wind: Ascending streams with direction

---

## Troubleshooting

### Physics Not Visible
1. Check physics mode indicator shows active mode (top-left)
2. Ensure not in Normal mode (✨)
3. Wait 1-2 seconds for effects to accumulate
4. Try with gestures disabled for pure physics

### Magnetic Mode Not Attracting
1. Ensure hands are visible to camera
2. Check hand tracking canvas (should show landmarks)
3. Move hands slowly for better tracking
3. Keep hands within 50 units of particles

### Particles Disappearing
1. Gravity/Anti-Gravity: Particles may accumulate off-screen
2. Switch back to Normal mode to reset
3. Adjust formation shape (Sphere vs Nova)

### Performance Issues
1. Reduce particle count (check CONFIG.particles.count)
2. Surface tension in Fluid mode is CPU-intensive
3. Quantum mode with high entanglement may slow down
4. Close other browser tabs for better GPU performance

---

## Future Enhancements

**Potential Additions**:
- 🌪️ Vortex Mode: Spiral tornado physics
- 🔥 Combustion Mode: Fire/explosion dynamics
- ❄️ Freeze Mode: Time-stop and ice crystallization
- 🌊 Wave Mode: Sine wave propagation
- ⚡ Electric Mode: Lightning arc connections
- 🕳️ Black Hole Mode: Extreme gravitational singularity

**Gesture Mapping Available**:
- 1 finger (both hands): Reserved
- 6+ fingers: Not possible with human hands

---

## Credits

Physics system designed for artistic visualization and interactive exploration of particle dynamics. Optimized for real-time performance with up to 40,000 particles.

**Version**: 2.0.0  
**Last Updated**: December 3, 2025
