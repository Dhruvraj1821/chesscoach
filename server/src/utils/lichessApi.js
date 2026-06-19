import axios from "axios";

const LICHESS_HOST = "https://lichess.org";


export async function fetchUserGames(username, accessToken, max = 20) {
  let response;
  try {
    response = await axios.get(
      `${LICHESS_HOST}/api/games/user/${username}`,
      {
        params: {
          max,
          pgnInJson: true,
          opening: true,
          clocks: false,
          evals: false,
          moves: true,
        },
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/x-ndjson",
        },
        responseType: "text",
      }
    );
  } catch (err) {
    console.error("Lichess API error status:", err.response?.status);
    console.error("Lichess API error body:", err.response?.data);
    throw err;
  }

  const lines = response.data
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => JSON.parse(line));
}


export function parseLichessGame(rawGame, userId) {
  const playedAt = rawGame.createdAt
    ? new Date(rawGame.createdAt)
    : null;

  // Result from user's perspective
  // rawGame.winner is "white" | "black" | undefined (draw)
  let result = "draw";
  if (rawGame.winner) {
    const userColor =
      rawGame.players.white.user?.id === userId ? "white" : "black";
    result = rawGame.winner === userColor ? "win" : "loss";
  }

  const openingName = rawGame.opening?.name || null;
  const timeControl = rawGame.clock
    ? `${rawGame.clock.initial / 60}+${rawGame.clock.increment}`
    : rawGame.speed || null;

  return {
    lichessGameId: rawGame.id,
    pgn: rawGame.pgn || "",
    playedAt,
    result,
    openingName,
    timeControl,
  };
}