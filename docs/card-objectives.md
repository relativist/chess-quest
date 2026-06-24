# Card Objective System

This document defines future objective rules for Chess Quest cards. The MVP displays the objective on the map, in the pre-battle dialog, and on the game page. The battle screen now evaluates objectives automatically after legal player moves; survival objectives also advance after Stockfish replies.

## Objective Types

- `checkmate`: victory when the player checkmates the opponent. This is always a valid fallback victory condition for every card.
- `give_check`: victory when the player's move gives check. Checkmate also satisfies this objective.
- `capture_piece`: victory when the player's move captures the configured target piece type. Checkmate also satisfies this objective.
- `survive_half_moves`: victory when the configured number of legal half-moves is reached without losing. Checkmate before the counter is reached also satisfies this objective.

## Evaluation Rules

- The player side is the side to move in the starting FEN.
- Objective checks are evaluated after each legal player move from `chess.js`.
- If `chess.isCheckmate()` is true after the player's move, the card is completed regardless of the configured objective.
- `give_check` uses `chess.isCheck()` after the move.
- `capture_piece` uses the verbose `Move.captured` field from `chess.js` and maps it to the configured piece type.
- `survive_half_moves` counts legal half-moves from the game history, including both player moves and Stockfish replies.
- Draw/loss states do not award victory unless a future card explicitly defines a draw/survival objective that allows it.

## MVP Defaults

- Opening Gate: survive 8 half-moves.
- Knight Fork: give check.
- Rook File: checkmate.
- Queen Pressure: survive 10 half-moves.
- Grandmaster Peak: capture queen.
- Editor-created cards use a fallback by difficulty: low difficulty gives check, medium difficulty survive 8 half-moves, high difficulty checkmate.

## UI Contract

Every card data view exposes:

- `objective`: structured machine-readable objective.
- `objectiveLabel`: full or short human-readable text for UI surfaces.

The map and pre-battle dialog should show a short objective. The game page should show enough text for the player to know what finishes the card.
