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
    this.fog = new THREE.FogExp2(0x050510, 0.035);
    this.scene.fog = this.fog;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.updateCameraPosition();

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 1.5;
    container.appendChild(this.renderer.domElement);

    // 2. Post Processing
    const renderScene = new RenderPass(this.scene, this.camera);
    
    // Res, Strength, Radius, Threshold
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      config.bloomStrength,
      0.5,
      0.05 // Lower threshold to ensure glow
    );

    const outputPass = new OutputPass();

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(renderScene);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(outputPass);

    // 3. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
    this.scene.add(ambientLight);
    
    const light1 = new THREE.PointLight(0xcc00ff, 1.0, 100);
    light1.position.set(-20, 30, 30);
    this.scene.add(light1);
    
    const light2 = new THREE.PointLight(0x00ffff, 1.0, 100);
    light2.position.set(20, 10, 30);
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

  private initStars() {
    const geometry = new THREE.BufferGeometry();
    const count = 4000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 120;
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
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });

    this.starSystem = new THREE.Points(geometry, material);
    this.scene.add(this.starSystem);
  }

  private createStaticEnvironment() {
    // Grid Lines (Retro floor)
    this.gridHelper = new THREE.GridHelper(200, 100, 0xff00ff, 0x110022);
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
    this.boardFrame = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xaa44cc, transparent: true, opacity: 0.5 }));
    
    // Position visual center. 
    // Logic coords: (0,0) is bottom left. 
    // Visual coords center: (cols/2, rows/2)
    this.boardFrame.position.set(gridCols/2, gridRows/2, 0);
    this.gridGroup.add(this.boardFrame);
    
    // Center grid group in world
    // We position the group such that the visual center of the board (gridRows/2)
    // always ends up at this.BOARD_CENTER_Y (10).
    // Equation: GroupY + LocalCenterY = WorldCenterY
    // GroupY + (gridRows/2) = 10
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

    const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
    // Create ample pool
    const poolSize = (this.config.gridRows * this.config.gridCols) + 20; 
    
    for (let i = 0; i < poolSize; i++) {
      const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0x000000,
        emissiveIntensity: 3.0, // High intensity for bloom
        roughness: this.config.blockRoughness,
        metalness: this.config.blockMetalness,
        transparent: true,
        opacity: this.config.opacity
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
    this.fog.density = 0.02 * (1 - newConfig.environmentDimming * 0.8);

    // Update Materials
    this.cubes.forEach(cube => {
      const mat = cube.material as THREE.MeshStandardMaterial;
      mat.opacity = newConfig.opacity;
      mat.roughness = newConfig.blockRoughness;
      mat.metalness = newConfig.blockMetalness;
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
    // High saturation and lightness for glow
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
    // Returns a multiplier for brightness (0.0 to ~2.0) and optionally shifts hue
    const getFlowFactor = (x: number, y: number, time: number): number => {
      if (visualStyle === 'none') return 1.0;

      // Normalize coords to center
      const nx = (x - gridCols / 2) / (gridCols / 2);
      const ny = (y - gridRows / 2) / (gridRows / 2);
      const t = time * flowSpeed;

      if (visualStyle === 'wave') {
         // Diagonal sine wave
         return 1.2 + 0.5 * Math.sin(nx * 3 + ny * 3 - t);
      } 
      
      if (visualStyle === 'plasma') {
        // Multi-sine plasma
        const v = Math.sin(nx * 4 + t) + Math.sin(ny * 4 + t) + Math.sin((nx + ny) * 5 + t);
        return 1.2 + 0.4 * v; 
      }

      if (visualStyle === 'heart') {
        // Pulsing Heart Shape Math
        // Heart eq: (x^2 + y^2 - 1)^3 - x^2*y^3 = 0
        // We pulse the coordinate system to make it beat
        const beat = 1.0 + 0.15 * Math.sin(t * 3) + 0.05 * Math.sin(t * 6); // complex beat
        const hx = nx * 1.5 * beat;
        const hy = (ny + 0.2) * 1.5 * beat; // Offset y slightly up
        
        const a = hx * hx + hy * hy - 1;
        const result = a * a * a - hx * hx * hy * hy * hy;
        
        // Inside heart if result <= 0
        if (result <= 0) {
           return 2.5; // Super bright inside heart
        } else {
           return 0.3; // Dim outside
        }
      }

      return 1.0;
    };

    const updateMesh = (mesh: THREE.Mesh, x: number, y: number, colorOffset: number) => {
       const mat = mesh.material as THREE.MeshStandardMaterial;
       const baseColor = this.getNeonColor(colorOffset);
       
       const flow = getFlowFactor(x, y, time);
       
       // Apply flow to emissive intensity/color
       // We boost color brightness and emissive based on flow
       mat.color.copy(baseColor).multiplyScalar(flow);
       mat.emissive.copy(baseColor).multiplyScalar(flow);
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