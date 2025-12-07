
import { GridMatrix, SHAPES } from '../types';

interface Move {
  rotation: number;
  x: number;
  score: number;
}

export class TetrisGame {
  public grid: GridMatrix;
  public rows: number;
  public cols: number;
  public minLinesToClear: number;
  public enableLineClear: boolean = true;
  
  public currentPiece: { type: string; shape: number[][]; x: number; y: number; colorOffset: number } | null = null;
  public gameOver: boolean = false;
  
  private bag: string[] = [];

  constructor(rows: number, cols: number, minLinesToClear: number = 1) {
    this.rows = rows;
    this.cols = cols;
    this.minLinesToClear = minLinesToClear;
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.fillBag();
    this.spawnPiece();
  }

  private fillBag() {
    const pieces = Object.keys(SHAPES);
    this.bag = [...pieces, ...pieces].sort(() => Math.random() - 0.5);
  }

  private getNextPieceType(): string {
    if (this.bag.length === 0) this.fillBag();
    return this.bag.pop()!;
  }

  public spawnPiece() {
    const type = this.getNextPieceType();
    const def = SHAPES[type];
    
    // Center the piece
    const startX = Math.floor((this.cols - def.shape[0].length) / 2);
    const startY = 0;

    // Check collision BEFORE creating the piece to detect immediate Game Over
    if (this.checkCollision(def.shape, startX, startY)) {
      this.gameOver = true;
      return; // Do not actually spawn if blocked
    }

    this.currentPiece = {
      type,
      shape: def.shape,
      x: startX,
      y: startY,
      colorOffset: def.colorOffset
    };
  }

  public reset(rows?: number, cols?: number, minLinesToClear?: number) {
    if (rows) this.rows = rows;
    if (cols) this.cols = cols;
    if (minLinesToClear) this.minLinesToClear = minLinesToClear;
    
    this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(null));
    this.gameOver = false;
    this.fillBag();
    this.spawnPiece();
  }

  public rotateShape(shape: number[][]): number[][] {
    const rows = shape.length;
    const cols = shape[0].length;
    const newShape: number[][] = [];
    for (let col = 0; col < cols; col++) {
      const newRow: number[] = [];
      for (let row = rows - 1; row >= 0; row--) {
        newRow.push(shape[row][col]);
      }
      newShape.push(newRow);
    }
    return newShape;
  }

  public checkCollision(shape: number[][], x: number, y: number): boolean {
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          const newX = x + c;
          const newY = y + r;
          if (newX < 0 || newX >= this.cols || newY >= this.rows) return true;
          // Check occupied grid cells
          if (newY >= 0 && this.grid[newY][newX]) return true;
        }
      }
    }
    return false;
  }

  // Lock piece and clear lines
  public lockPiece() {
    if (!this.currentPiece) return;
    const { shape, x, y, type } = this.currentPiece;
    
    // Write to grid
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
          if (y + r >= 0 && y + r < this.rows) {
            this.grid[y + r][x + c] = type;
          }
        }
      }
    }

    if (this.enableLineClear) {
      this.processLineClears();
    }
    
    this.spawnPiece();
  }

  private processLineClears() {
     // Identify full lines
    const fullRowIndices: number[] = [];
    for (let r = 0; r < this.rows; r++) {
      if (this.grid[r].every(cell => cell !== null)) {
        fullRowIndices.push(r);
      }
    }

    // Only clear if we meet the threshold
    if (fullRowIndices.length >= this.minLinesToClear) {
      // Create new grid excluding full rows
      const newGrid = this.grid.filter((_, idx) => !fullRowIndices.includes(idx));
      // Pad top with nulls
      const linesToAdd = this.rows - newGrid.length;
      for (let i = 0; i < linesToAdd; i++) {
        newGrid.unshift(Array(this.cols).fill(null));
      }
      this.grid = newGrid;
    }
  }

  // --- AI ---

  public getBestMove(): { x: number; rotation: number, dropY: number } {
    if (!this.currentPiece) return { x: 0, rotation: 0, dropY: 0 };

    let bestScore = -Infinity;
    let bestMove = { x: this.currentPiece.x, rotation: 0, dropY: 0 };
    let shape = this.currentPiece.shape;

    // Try all 4 rotations
    for (let r = 0; r < 4; r++) {
      // Try all X positions
      for (let x = -2; x < this.cols + 2; x++) {
        // Find drop Y
        if (!this.checkCollision(shape, x, 0)) {
           let dy = 0;
           // Find lowest valid point
           while (!this.checkCollision(shape, x, dy + 1)) {
             dy++;
           }
           const y = dy;
           
           // Evaluate grid state if we placed it here
           const score = this.evaluateGrid(shape, x, y);
           if (score > bestScore) {
             bestScore = score;
             bestMove = { x, rotation: r, dropY: y };
           }
        }
      }
      shape = this.rotateShape(shape);
    }
    return bestMove;
  }

  private evaluateGrid(shape: number[][], x: number, y: number): number {
    // Clone grid simply
    // Note: We only need to check the grid below the placement roughly
    const testGrid = this.grid.map(row => [...row]);
    
    // Place piece in test grid
    for (let r = 0; r < shape.length; r++) {
      for (let c = 0; c < shape[r].length; c++) {
        if (shape[r][c]) {
           if(y+r < this.rows) testGrid[y + r][x + c] = "TEMP";
        }
      }
    }

    // Heuristics
    let aggregateHeight = 0;
    let completeLines = 0;
    let holes = 0;
    let bumpiness = 0;

    const columnHeights = new Array(this.cols).fill(0);

    // Calculate Column Heights & Holes
    for (let c = 0; c < this.cols; c++) {
      let foundTop = false;
      for (let r = 0; r < this.rows; r++) {
        if (testGrid[r][c] !== null) {
          if (!foundTop) {
            columnHeights[c] = this.rows - r;
            foundTop = true;
          }
        } else if (foundTop) {
          holes++; // Empty space below a block
        }
      }
    }

    aggregateHeight = columnHeights.reduce((a, b) => a + b, 0);

    for (let c = 0; c < this.cols - 1; c++) {
      bumpiness += Math.abs(columnHeights[c] - columnHeights[c + 1]);
    }

    // Count lines
    for (let r = 0; r < this.rows; r++) {
      if (testGrid[r].every(val => val !== null)) completeLines++;
    }

    // Weights
    // If not clearing lines, we still want to pack tightly (low bumpiness, low holes), 
    // but aggregate height is less bad because we WANT to stack. 
    // However, keeping height low typically results in better packing.
    
    const wHeight = this.enableLineClear ? -0.51 : -0.2; 
    const wLines = this.enableLineClear ? 0.76 : 1.5; // Reward creating "full lines" even if they don't clear, for neatness
    const wHoles = -0.6; // Holes are always bad for visual neatness
    const wBump = -0.3;  // Smooth surface looks better
    
    return (wHeight * aggregateHeight) + (wLines * completeLines) + (wHoles * holes) + (wBump * bumpiness);
  }
}
