
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass';
import { GameConfig, SHAPES } from '../types';
import { TetrisGame } from './TetrisAI';

export class SceneManager {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;
  private fog: THREE.FogExp2;
  
  private game: TetrisGame;
  private config: GameConfig;

  // Visual Assets
  private cubes: THREE.Mesh[] = [];
  private gridGroup: THREE.Group;
  private starSystem: THREE.Points;
  private gridHelper: THREE.GridHelper;
  private boardFrame: THREE.LineSegments;
  private envTexture: THREE.Texture;

  // Animation State
  private lastTime = 0;
  private moveTimer = 0;
  private currentMove: { x: number, rotation: number, dropY: number } | null = null;
  private isProcessingMove = false;
  private moveStepIndex = 0; // 0: rotate, 1: move X, 2: drop

  // Constants
  private readonly BOARD_CENTER_Y = 10;

  constructor(container: HTMLElement, config: GameConfig) {
    this.container = container;
    this.config = config;
    this.game = new TetrisGame(config.gridRows, config.gridCols, config.minLinesToClear);
    this.game.enableLineClear = config.enableLineClear;

    // 1. Setup Three.js
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x050510, config.fogDensity);
    this.scene.fog = this.fog;

    // GENERATE ENVIRONMENT MAP (Crucial for Metal/Glass look)
    this.envTexture = this.generateEnvironment();
    this.scene.environment = this.envTexture;
    // We don't set background to texture to keep deep black space feel, but environment is set for reflections.

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; // Better for bright lights
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    // 2. Post Processing
    const renderScene = new RenderPass(this.scene, this.camera);
    
    // Res, Strength, Radius, Threshold
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      config.bloomStrength,
      0.5,
      0.02 // Very low threshold to make everything glow
    );

    const outputPass = new OutputPass();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(outputPass);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
    this.scene.add(ambientLight);
    
    // Key lights for shaping
    const light1 = new THREE.PointLight(0xaa00ff, 2.0, 100);
    light1.position.set(-20, 20, 20);
    this.scene.add(light1);
    
    const light2 = new THREE.PointLight(0x00aaff, 2.0, 100);
    light2.position.set(20, 5, 20);
    this.scene.add(light2);

    // 4. Objects
    this.gridGroup = new THREE.Group();
    this.scene.add(this.gridGroup);

    this.createStaticEnvironment();
    this.rebuildBoardFrame();
    this.initCubesPool();
    this.initStars();

    // Resize handler
    window.addEventListener('resize', this.onResize);
  }

  // Creates a procedural cyberpunk gradient for reflections
  private generateEnvironment(): THREE.Texture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const grad = ctx.createLinearGradient(0, 0, 0, 512);
        grad.addColorStop(0, '#1a0033'); // Deep purple top
        grad.addColorStop(0.5, '#6600cc'); // Bright neon mid
        grad.addColorStop(1, '#000000'); // Black bottom
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 512, 512);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.mapping = THREE.EquirectangularReflectionMapping;
    return texture;
  }

  private initStars() {
    const geometry = new THREE.BufferGeometry();
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 120 + Math.random() * 50;
      const theta = 2 * Math.PI * Math.random();
      const phi = Math.acos(2 * Math.random() - 1);
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);

      positions[i*3] = x;
      positions[i*3+1] = y;
      positions[i*3+2] = z;

      // Synthwave colors for stars: Deep Blue, Magenta, White
      const choice = Math.random();
      const col = new THREE.Color();
      if (choice > 0.8) col.setHex(0xffffff);
      else if (choice > 0.5) col.setHex(0xff00ff);
      else col.setHex(0x00ffff);
      
      colors[i*3] = col.r;
      colors[i*3+1] = col.g;
      colors[i*3+2] = col.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.starSystem = new THREE.Points(geometry, material);
    this.scene.add(this.starSystem);
  }

  private createStaticEnvironment() {
    // Grid Lines (Retro floor)
    this.gridHelper = new THREE.GridHelper(300, 100, 0xff00ff, 0x0a001a);
    // Lower the floor to avoid clipping with tall boards (max rows ~40 -> bottom at -10)
    this.gridHelper.position.y = -15; 
    this.gridHelper.position.z = -10;
    this.scene.add(this.gridHelper);
  }

  private rebuildBoardFrame() {
    if (this.boardFrame) {
      this.gridGroup.remove(this.boardFrame);
      this.boardFrame.geometry.dispose();
    }
    const { gridRows, gridCols } = this.config;
    // Frame for the Tetris board
    const frameGeo = new THREE.BoxGeometry(gridCols, gridRows, 1);
    const edges = new THREE.EdgesGeometry(frameGeo);
    this.boardFrame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xaa44cc, transparent: true, opacity: 0.3 }));
    
    // Position visual center. 
    // Logic coords: (0,0) is bottom left. 
    // Visual coords center: (cols/2, rows/2)
    this.boardFrame.position.set(gridCols/2, gridRows/2, 0);
    this.gridGroup.add(this.boardFrame);
    
    // Center grid group in world
    // We position the group such that the visual center of the board (gridRows/2)
    // always ends up at this.BOARD_CENTER_Y (10).
    // Equation: GroupY + (gridRows/2) = 10
    // GroupY = 10 - gridRows/2
    this.gridGroup.position.x = -gridCols / 2;
    this.gridGroup.position.y = this.BOARD_CENTER_Y - gridRows / 2;
  }

  private initCubesPool() {
    // Clear old cubes
    this.cubes.forEach(c => {
      this.gridGroup.remove(c);
      c.geometry.dispose();
      (c.material as THREE.Material).dispose();
    });
    this.cubes = [];

    // Slightly bevelled cube for better specular hits
    const geometry = new THREE.BoxGeometry(0.96, 0.96, 0.96); 
    
    // Create ample pool
    const poolSize = (this.config.gridRows * this.config.gridCols) + 20; 
    
    for (let i = 0; i < poolSize; i++) {
      // Use MeshPhysicalMaterial for Glass/Translucency effects
      const material = new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        emissive: 0x000000,
        emissiveIntensity: 1.0,
        roughness: this.config.blockRoughness,
        metalness: this.config.blockMetalness,
        transmission: this.config.blockTransmission, // Glass effect
        thickness: this.config.blockThickness, // Volume
        transparent: true,
        opacity: this.config.opacity,
        ior: 1.5, // Glass index of refraction
        clearcoat: 1.0,
        clearcoatRoughness: 0.1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      this.gridGroup.add(mesh);
      this.cubes.push(mesh);
    }
  }

  private onResize = () => {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  };

  public updateConfig(newConfig: GameConfig) {
    const oldConfig = this.config;
    this.config = newConfig;
    this.game.enableLineClear = newConfig.enableLineClear;

    // Update Post Processing
    this.bloomPass.strength = newConfig.bloomStrength;
    
    // Update Fog
    this.fog.density = newConfig.fogDensity;

    // Update Materials
    this.cubes.forEach(cube => {
      const mat = cube.material as THREE.MeshPhysicalMaterial;
      mat.opacity = newConfig.opacity;
      mat.roughness = newConfig.blockRoughness;
      mat.metalness = newConfig.blockMetalness;
      mat.transmission = newConfig.blockTransmission;
      mat.thickness = newConfig.blockThickness;
    });
    
    // Update Grid Helper Visibility
    this.gridHelper.visible = newConfig.gridVisible;

    // Check if Grid Dimensions Changed
    if (oldConfig.gridRows !== newConfig.gridRows || oldConfig.gridCols !== newConfig.gridCols) {
      this.game.reset(newConfig.gridRows, newConfig.gridCols, newConfig.minLinesToClear);
      this.rebuildBoardFrame();
      this.initCubesPool();
      this.currentMove = null;
      this.isProcessingMove = false;
    }
    
    // If minLines changed, just update game
    if (oldConfig.minLinesToClear !== newConfig.minLinesToClear) {
      this.game.minLinesToClear = newConfig.minLinesToClear;
    }
  }

  private getNeonColor(hueOffset: number): THREE.Color {
    const baseHue = 0.6 + (this.config.temperature * 0.4); 
    const finalHue = (baseHue + hueOffset) % 1.0;
    // High saturation, mid lightness for base color (emissive will handle brightness)
    return new THREE.Color().setHSL(finalHue, 1.0, 0.5);
  }

  private updateCameraPosition(time: number = 0) {
    const { cameraMode, cameraX, cameraY, cameraZ, rotationSpeed, gridRows } = this.config;

    // We look at the stable center of the board
    const targetY = this.BOARD_CENTER_Y;

    if (cameraMode === 'manual') {
      this.camera.position.set(cameraX, cameraY, cameraZ);
      this.camera.lookAt(0, targetY, 0);
    } else {
      // Orbit
      const angle = time * 0.0001 * rotationSpeed;
      // We scale distance so the whole board fits, but the target remains the center
      const dist = Math.max(gridRows * 1.5, 35);
      
      this.camera.position.x = Math.sin(angle) * dist;
      this.camera.position.z = Math.cos(angle) * dist;
      // Slight Bobbing relative to center
      this.camera.position.y = targetY + Math.sin(angle * 0.5) * 5;
      
      this.camera.lookAt(0, targetY, 0);
    }
  }

  public render = () => {
    const time = performance.now();
    const dt = (time - this.lastTime) / 1000;
    this.lastTime = time;

    this.updateCameraPosition(time);

    // Star animation
    if (this.starSystem) {
      this.starSystem.rotation.y += 0.0005;
      this.starSystem.rotation.x += 0.0001;
    }

    // --- GAME LOOP LOGIC ---
    const tickInterval = 60 / Math.max(this.config.bpm, 10);
    
    if (this.game.gameOver) {
      // Fancy reset?
      this.game.reset();
      this.currentMove = null;
      this.isProcessingMove = false;
    }

    this.moveTimer += dt;
    if (this.moveTimer > tickInterval && !this.isProcessingMove) {
      // AI Turn
      if (this.game.currentPiece) {
        this.currentMove = this.game.getBestMove();
        this.isProcessingMove = true;
        this.moveStepIndex = 0;
        this.moveTimer = 0;
      }
    } else if (this.isProcessingMove && this.moveTimer > (tickInterval * 0.15)) {
      this.performAIInterpStep();
      this.moveTimer = 0;
    }

    this.syncVisuals(time / 1000); // Pass seconds to visual sync
    this.composer.render();
    requestAnimationFrame(this.render);
  };

  private performAIInterpStep() {
    if (!this.currentMove || !this.game.currentPiece) {
      this.isProcessingMove = false;
      return;
    }

    // Step 1: Rotate
    if (this.moveStepIndex === 0) {
      const targetRot = this.currentMove.rotation;
      for(let i=0; i<targetRot; i++) {
        this.game.currentPiece.shape = this.game.rotateShape(this.game.currentPiece.shape);
      }
      this.moveStepIndex++;
    } 
    // Step 2: Move X
    else if (this.moveStepIndex === 1) {
      if (this.game.currentPiece.x < this.currentMove.x) this.game.currentPiece.x++;
      else if (this.game.currentPiece.x > this.currentMove.x) this.game.currentPiece.x--;
      else this.moveStepIndex++;
    }
    // Step 3: Drop
    else if (this.moveStepIndex === 2) {
       // Step by step falling
       if (!this.game.checkCollision(this.game.currentPiece.shape, this.game.currentPiece.x, this.game.currentPiece.y + 1)) {
         this.game.currentPiece.y++;
       } else {
         // Lock
         this.game.lockPiece();
         this.isProcessingMove = false;
         this.currentMove = null;
       }
    }
  }

  private syncVisuals(time: number) {
    // Hide all cubes first
    this.cubes.forEach(c => c.visible = false);
    let cubeIdx = 0;

    const { gridRows, gridCols, visualStyle, flowSpeed } = this.config;

    // Helper: Apply visual FX pattern
    // Returns a factor to multiply emissive by
    const getFlowFactor = (x: number, y: number, time: number): number => {
      // Normalize coords
      const nx = (x - gridCols / 2) / (gridCols / 2);
      const ny = (y - gridRows / 2) / (gridRows / 2); // -1 to 1 roughly
      const t = time * flowSpeed;

      switch (visualStyle) {
        case 'none': return 1.0;
        
        case 'wave':
          // Diagonal sine wave
          return 1.2 + 0.8 * Math.sin(nx * 3 + ny * 3 - t);

        case 'plasma':
          // Multi-sine plasma
          const v = Math.sin(nx * 4 + t) + Math.sin(ny * 4 + t) + Math.sin((nx + ny) * 5 + t);
          return 1.2 + 0.6 * v; 

        case 'heart': {
          // Pulsing Heart Shape Math
          const beat = 1.0 + 0.2 * Math.sin(t * 5) + 0.1 * Math.sin(t * 10); // rapid beat
          const hx = nx * 1.5 * beat;
          const hy = (ny + 0.3) * 1.5 * beat;
          const a = hx * hx + hy * hy - 1;
          const result = a * a * a - hx * hx * hy * hy * hy;
          return result <= 0 ? 4.0 : 0.1;
        }

        case 'matrix': {
          // Digital Rain: Falls from top to bottom
          // Use column index to generate a pseudo-random offset
          // x is integer column index 0..cols
          const colSeed = Math.sin(x * 123.456) * 1000;
          const speed = flowSpeed * 4.0;
          // Calculate a dropping "head" position
          // y goes from 0 (bottom) to gridRows (top)
          const gridHeight = gridRows;
          // We want it falling, so phase goes negative or we subtract
          const phase = (t * speed + colSeed) % (gridHeight * 1.5);
          // Head Y position (world space)
          const headY = gridHeight - phase + (gridHeight * 0.25);
          
          const dist = headY - y;
          // Trail length = 8
          if (dist > 0 && dist < 8) {
             return 2.5 * (1 - (dist / 8)); // Bright head, fading tail
          }
          return 0.05; // Dim background
        }

        case 'fire': {
           // Hot at bottom (y=0), Cold at top
           // Add noise turbulence
           const turbulence = Math.sin(x * 2.0 + t * 2.0) + Math.sin(y * 0.5 - t * 5.0);
           const heightFactor = 1.0 - (y / gridRows); // 1.0 at bottom, 0 at top
           const intensity = heightFactor * heightFactor * 3.0 + (turbulence * 0.5);
           return Math.max(0.1, intensity);
        }

        case 'scanline': {
           // Horizontal bar moving up and down
           const period = 4.0 / flowSpeed;
           const normTime = (time % period) / period; // 0 to 1
           const scanY = normTime * gridRows; // 0 to top
           // Make it bounce? or loop? Loop is fine.
           // Bouncing:
           // const bounce = Math.sin(time * flowSpeed) * 0.5 + 0.5; 
           // const scanY = bounce * gridRows;
           
           const dist = Math.abs(y - scanY);
           if (dist < 1.5) {
             return 3.0 * (1 - dist/1.5);
           }
           return 0.1;
        }

        case 'sparkle': {
           // Random flashing
           // We use a noise function based on discrete time buckets
           // Bucket size implies duration of sparkle
           const bucket = Math.floor(time * 5.0 * flowSpeed); // Change 5x per second * speed
           // Pseudo random hash
           const hash = Math.sin(x * 12.9898 + y * 78.233 + bucket * 43758.5453);
           // If hash > threshold, light up
           // Math.sin range -1 to 1. 
           if (hash > 0.8) return 3.0;
           return 0.2;
        }

        default: return 1.0;
      }
    };

    const updateMesh = (mesh: THREE.Mesh, x: number, y: number, colorOffset: number) => {
       const mat = mesh.material as THREE.MeshPhysicalMaterial;
       const baseColor = this.getNeonColor(colorOffset);
       
       const flow = getFlowFactor(x, y, time);
       
       // Update Color
       // For physical material, we keep color somewhat dark to allow specular highlights to pop
       // We drive the "Glow" via emissive
       
       mat.color.copy(baseColor).multiplyScalar(0.5); // Darker diffuse for glass look
       
       // Emissive is where the neon logic lives
       // If flow > 1, it gets brighter. If flow < 1, it dims.
       mat.emissive.copy(baseColor).multiplyScalar(flow * 1.5);
    };

    // 1. Render Static Grid
    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < this.config.gridCols; c++) {
        const cell = this.game.grid[r][c];
        if (cell) {
          if (cubeIdx >= this.cubes.length) break;
          const mesh = this.cubes[cubeIdx++];
          
          // Visual Y is inverted relative to logical row
          const visY = (gridRows - 1 - r);
          mesh.position.set(c + 0.5, visY + 0.5, 0);
          
          const shapeDef = SHAPES[cell] || SHAPES['I'];
          mesh.visible = true;
          updateMesh(mesh, c, visY, shapeDef.colorOffset);
        }
      }
    }

    // 2. Render Active Piece
    if (this.game.currentPiece) {
      const { shape, x, y, colorOffset } = this.game.currentPiece;
      
      for (let r = 0; r < shape.length; r++) {
        for (let c = 0; c < shape[r].length; c++) {
          if (shape[r][c]) {
             if (cubeIdx >= this.cubes.length) break;
             const mesh = this.cubes[cubeIdx++];
             
             const gridX = x + c;
             const gridY = y + r;
             
             if (gridY >= 0 && gridY < gridRows) {
               const visY = (gridRows - 1 - gridY);
               mesh.position.set(gridX + 0.5, visY + 0.5, 0);
               mesh.visible = true;
               updateMesh(mesh, gridX, visY, colorOffset);
             }
          }
        }
      }
    }
  }

  public dispose() {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
