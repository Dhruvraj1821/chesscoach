import { Chess } from "chess.js";

/**
 * Detects the most likely tactical theme for a blunder position.
 * Uses chess.js position analysis — no engine calls needed.
 *
 * Returns one of: fork, pin, skewer, back_rank, hanging_piece,
 * missed_tactic (fallback when no specific pattern detected)
 */
export function detectTacticalTheme(fenBefore, playedMoveUci, bestMoveUci) {
  try {
    const chess = new Chess(fenBefore);

    // Check back rank mate pattern
    if (isBackRankPattern(chess)) return "back_rank";

    // Check if the played move left a piece hanging
    if (isHangingPieceBlunder(chess, playedMoveUci)) return "hanging_piece";

    // Check if best move creates a fork
    if (bestMoveUci && isForkPattern(chess, bestMoveUci)) return "fork";

    // Check pin pattern in current position
    if (isPinPattern(chess)) return "pin";

    // Check skewer pattern
    if (isSkewerPattern(chess)) return "skewer";

    return "missed_tactic";
  } catch {
    return "missed_tactic";
  }
}

function isBackRankPattern(chess) {
  // Back rank weakness: king on back rank with no escape squares
  // and a rook/queen on open file pointing at it
  const board = chess.board();
  const turn = chess.turn(); // whose turn it is to move (the side that blundered)
  const opponentColor = turn === "w" ? "b" : "w";

  // Find opponent's king position
  let kingRow = -1, kingCol = -1;
  const backRank = opponentColor === "w" ? 7 : 0;

  for (let col = 0; col < 8; col++) {
    const piece = board[backRank][col];
    if (piece && piece.type === "k" && piece.color === opponentColor) {
      kingRow = backRank;
      kingCol = col;
      break;
    }
  }

  if (kingRow === -1) return false;

  // Check if king's escape squares on back rank are blocked by own pieces
  const neighbors = [kingCol - 1, kingCol, kingCol + 1].filter(c => c >= 0 && c < 8);
  const escapesBlocked = neighbors.every(col => {
    const sq = board[kingRow][col];
    return sq && sq.color === opponentColor;
  });

  if (!escapesBlocked) return false;

  // Check if there's a rook or queen on the same file
  for (let row = 0; row < 8; row++) {
    if (row === kingRow) continue;
    const piece = board[row][kingCol];
    if (piece && piece.color === turn && (piece.type === "r" || piece.type === "q")) {
      return true;
    }
  }

  return false;
}

function isHangingPieceBlunder(chess, playedMoveUci) {
  if (!playedMoveUci || playedMoveUci === "0000") return false;

  // Make the played move and see if the moved piece is immediately capturable
  const chessCopy = new Chess(chess.fen());
  const from = playedMoveUci.slice(0, 2);
  const to = playedMoveUci.slice(2, 4);

  const result = chessCopy.move({ from, to });
  if (!result) return false;

  // Check if the destination square is attacked by opponent
  const attackers = chessCopy.attackers(to, chessCopy.turn());
  if (attackers.length === 0) return false;

  // Check if it's defended — if attackers > defenders it's hanging
  const defenders = chessCopy.attackers(to, result.color);
  return attackers.length > defenders.length;
}

function isForkPattern(chess, bestMoveUci) {
  if (!bestMoveUci || bestMoveUci === "0000") return false;

  const chessCopy = new Chess(chess.fen());
  const from = bestMoveUci.slice(0, 2);
  const to = bestMoveUci.slice(2, 4);

  const result = chessCopy.move({ from, to });
  if (!result) return false;

  // After the best move, count how many opponent pieces of value >= knight are attacked
  const opponentColor = chessCopy.turn();
  const board = chessCopy.board();
  const valuablePieces = ["q", "r", "n", "b", "k"];

  let attackedValuablePieces = 0;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece || piece.color !== opponentColor) continue;
      if (!valuablePieces.includes(piece.type)) continue;

      const square = String.fromCharCode(97 + col) + (8 - row);
      const attackers = chessCopy.attackers(square, result.color);
      if (attackers.length > 0) attackedValuablePieces++;
    }
  }

  // Fork = one move attacks 2+ valuable pieces simultaneously
  return attackedValuablePieces >= 2;
}

function isPinPattern(chess) {
  // Simplified pin detection: check if any piece is pinned to the king
  // by looking for sliding pieces (bishops, rooks, queens) that have a
  // friendly piece between them and the opponent king
  const board = chess.board();
  const turn = chess.turn();
  const opponentColor = turn === "w" ? "b" : "w";

  // Find opponent king
  let kingSquare = null;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (piece && piece.type === "k" && piece.color === opponentColor) {
        kingSquare = { row, col };
      }
    }
  }

  if (!kingSquare) return false;

  // Check diagonals and ranks/files from king for potential pins
  const directions = [
    { dr: 0, dc: 1 }, { dr: 0, dc: -1 },
    { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
    { dr: 1, dc: 1 }, { dr: 1, dc: -1 },
    { dr: -1, dc: 1 }, { dr: -1, dc: -1 },
  ];

  const isDiagonal = (dr, dc) => Math.abs(dr) === Math.abs(dc);
  const isStraight = (dr, dc) => dr === 0 || dc === 0;

  for (const { dr, dc } of directions) {
    let friendlyCount = 0;
    let r = kingSquare.row + dr;
    let c = kingSquare.col + dc;

    while (r >= 0 && r < 8 && c >= 0 && c < 8) {
      const piece = board[r][c];
      if (piece) {
        if (piece.color === opponentColor) {
          friendlyCount++;
          if (friendlyCount > 1) break;
        } else {
          // Our piece — check if it's a sliding piece in the right direction
          if (friendlyCount === 1) {
            const canPin =
              (isDiagonal(dr, dc) && (piece.type === "b" || piece.type === "q")) ||
              (isStraight(dr, dc) && (piece.type === "r" || piece.type === "q"));
            if (canPin) return true;
          }
          break;
        }
      }
      r += dr;
      c += dc;
    }
  }

  return false;
}

function isSkewerPattern(chess) {
  // Skewer: like a pin but the more valuable piece is in front
  // Simplified: check if the king or queen is on a line attacked by sliding piece
  // with another piece behind it
  const board = chess.board();
  const turn = chess.turn();
  const opponentColor = turn === "w" ? "b" : "w";

  const directions = [
    { dr: 0, dc: 1 }, { dr: 0, dc: -1 },
    { dr: 1, dc: 0 }, { dr: -1, dc: 0 },
    { dr: 1, dc: 1 }, { dr: 1, dc: -1 },
    { dr: -1, dc: 1 }, { dr: -1, dc: -1 },
  ];

  const isDiagonal = (dr, dc) => Math.abs(dr) === Math.abs(dc);
  const isStraight = (dr, dc) => dr === 0 || dc === 0;
  const pieceValue = { k: 100, q: 9, r: 5, b: 3, n: 3, p: 1 };

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const attacker = board[row][col];
      if (!attacker || attacker.color !== turn) continue;
      if (!["b", "r", "q"].includes(attacker.type)) continue;

      for (const { dr, dc } of directions) {
        const canAttack =
          (isDiagonal(dr, dc) && (attacker.type === "b" || attacker.type === "q")) ||
          (isStraight(dr, dc) && (attacker.type === "r" || attacker.type === "q"));
        if (!canAttack) continue;

        let r = row + dr, c = col + dc;
        let firstPiece = null;

        while (r >= 0 && r < 8 && c >= 0 && c < 8) {
          const piece = board[r][c];
          if (piece) {
            if (piece.color === opponentColor) {
              if (!firstPiece) {
                firstPiece = piece;
              } else {
                // Two opponent pieces on same line — skewer if first is more valuable
                if (pieceValue[firstPiece.type] > pieceValue[piece.type]) {
                  return true;
                }
                break;
              }
            } else break;
          }
          r += dr;
          c += dc;
        }
      }
    }
  }

  return false;
}