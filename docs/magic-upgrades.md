# Magic Upgrade System

This document defines the Chess Quest magic upgrade contract used on the battle screen.

## Upgrade Catalog

| Upgrade | Cost | Target | Effect |
| --- | ---: | --- | --- |
| Подсказка | 10 gold | Current position | Shows the engine recommendation on the board. The magic action is recorded, and the player keeps the move. |
| Слон | 10 gold | Own pawn | Replaces one own pawn with a bishop. |
| Конь | 10 gold | Own pawn | Replaces one own pawn with a knight. |
| Ладья | 10 gold | Own pawn | Replaces one own pawn with a rook. |

## Rules

- `Подсказка` does not consume the player's action.
- Piece-changing magic consumes the player's action.
- After piece-changing magic is accepted, control passes to Stockfish.
- Only own pawns can be transformed by piece magic.
- Piece magic must be rejected without charging gold when the player has no own pawns on the board.
- Kings cannot be replaced, transformed, or selected as magic targets.
- A magic action must be rejected if it leaves either king missing or creates an invalid board state.
- Costs are paid before applying the action; failed validation must not charge gold.
- The session history should record magic actions separately from SAN moves but keep them in the same timeline.

## Engine Handoff

- `Подсказка` does not mutate the board. It records a magic action, highlights the recommended move, and leaves the turn with the player.
- `Слон`, `Конь`, and `Ладья` highlight own pawns, mutate the selected pawn, validate the resulting FEN, record the action, then schedule an engine reply.

## Implementation Notes

- The structured catalog lives in `src/lib/quest/magic-upgrades.ts`.
- The game UI should disable magic controls until the player has enough gold, it is the player's turn, and Stockfish is ready.
- Target selection should reuse board selection state and legal target highlighting.
- The future database model should store magic action type, target square, optional replacement piece, paid gold, before FEN, and after FEN.
