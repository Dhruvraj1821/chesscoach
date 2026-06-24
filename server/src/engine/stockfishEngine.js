import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_PATH = process.env.STOCKFISH_PATH ||
  path.join(__dirname, "../../engine/stockfish.exe");

const SEARCH_DEPTH = 14;
const COMMAND_TIMEOUT_MS = 30000;

/**
 * Wraps a native Stockfish process via real UCI over stdin/stdout.
 * One instance per worker process — reused across games via reset().
 */
export class StockfishEngine {
  constructor() {
    this.process = null;
    this.buffer = "";
    this._onLine = null;
  }

  async start() {
    this.process = spawn(ENGINE_PATH);

    this.process.stdout.on("data", (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split("\n");
      this.buffer = lines.pop(); // keep incomplete last line in buffer
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && this._onLine) this._onLine(trimmed);
      }
    });

    this.process.on("error", (err) => {
      console.error("Stockfish process error:", err);
    });

    this.process.on("exit", (code) => {
      console.log(`Stockfish process exited with code ${code}`);
    });

    await this._send("uci", (line) => line === "uciok");
    await this._send("isready", (line) => line === "readyok");
  }

  async reset() {
    this.process.stdin.write("ucinewgame\n");
    await this._send("isready", (line) => line === "readyok");
  }

  _send(command, isDone) {
    return new Promise((resolve, reject) => {
      const lines = [];

      const timeout = setTimeout(() => {
        this._onLine = null;
        reject(new Error(`Stockfish command timed out: ${command}`));
      }, COMMAND_TIMEOUT_MS);

      this._onLine = (line) => {
        lines.push(line);
        if (isDone(line)) {
          clearTimeout(timeout);
          this._onLine = null;
          resolve(lines);
        }
      };

      this.process.stdin.write(command + "\n");
    });
  }

  async evaluatePosition(fen) {
    this.process.stdin.write(`position fen ${fen}\n`);

    const lines = await this._send(
      `go depth ${SEARCH_DEPTH}`,
      (line) => line.startsWith("bestmove")
    );

    let evalCp = 0;
    let bestMoveUci = null;

    for (const line of lines) {
      if (line.startsWith("info") && line.includes(" score ")) {
        const cpMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);

        if (mateMatch) {
          const mateIn = parseInt(mateMatch[1]);
          evalCp = mateIn > 0 ? 10000 - mateIn * 10 : -10000 - mateIn * 10;
        } else if (cpMatch) {
          evalCp = parseInt(cpMatch[1]);
        }
      }

      if (line.startsWith("bestmove")) {
        bestMoveUci = line.split(" ")[1];
      }
    }

    return { evalCp, bestMoveUci };
  }

  quit() {
    if (this.process) {
      this.process.stdin.write("quit\n");
      this.process.kill();
    }
  }
}