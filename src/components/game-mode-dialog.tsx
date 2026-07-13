import Image from "next/image";
import Link from "next/link";

type GameModeDialogProps = {
  icons: {
    campaign: string;
    online: string;
    solo: string;
  };
};

const GAME_MODES = [
  {
    description: "Проходите карты, побеждайте противников.",
    href: "/map",
    key: "campaign",
    title: "Кампания",
  },
  {
    description: "Настройте партию против Stockfish по своим правилам.",
    href: "/solo",
    key: "solo",
    title: "Соло",
  },
  {
    description: "Сетевые партии между людьми с магей.",
    href: "/online",
    key: "online",
    title: "Онлайн",
  },
] as const;

export function GameModeDialog({ icons }: GameModeDialogProps) {
  return (
    <dialog className="battle-dialog game-mode-dialog" open aria-labelledby="game-mode-dialog-title">
      <div className="battle-dialog-header">
        <div>
          <p className="eyebrow">Начало игры</p>
          <h2 id="game-mode-dialog-title">Выберите режим</h2>
        </div>
      </div>
      <div className="game-mode-grid">
        {GAME_MODES.map((mode) => (
          <Link className="game-mode-card" href={mode.href} key={mode.key}>
            <Image src={icons[mode.key]} alt="" width={160} height={160} priority />
            <strong>{mode.title}</strong>
            <span>{mode.description}</span>
          </Link>
        ))}
      </div>
    </dialog>
  );
}
