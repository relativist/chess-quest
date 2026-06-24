import { STARTING_FEN, validateBoardTemplateFen } from "./chess/fen-validation";
import type { CardObjective } from "./quest/card-objectives";

export type Difficulty = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type DemoBoardTemplateSeed = {
  slug: string;
  name: string;
  description: string;
  fen: string;
};

export type DemoQuestCardSeed = {
  slug: string;
  order: number;
  title: string;
  text: string;
  congratulationsText: string;
  startingFen?: string | null;
  difficulty: Difficulty;
  rewardGold: number;
  rewardScore: number;
  completed: boolean;
  boardTemplateSlug: string | null;
  templateName: string;
  objective?: CardObjective;
};

export type DemoQuestMapSeed = {
  slug: string;
  title: string;
  description: string;
  order: number;
  isPublished: boolean;
  boardTemplates: DemoBoardTemplateSeed[];
  cards: DemoQuestCardSeed[];
};

export const demoMapSeed: DemoQuestMapSeed = {
  slug: "demo-road-to-tower",
  title: "Начало пути в мир Chess Quest",
  description: "Победи бомбических гоблинов и забери награду.",
  order: 1,
  isPublished: true,
  boardTemplates: [
    {
      slug: "knight-fork-template",
      name: "Тактика коня",
      description: "Ранняя позиция с активным слоном и конем, где легко увидеть тактический мотив.",
      fen: "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3",
    },
    {
      slug: "rook-file-template",
      name: "Ладейная атака",
      description: "Упрощенная позиция для игры по открытым линиям без перегруза фигурами.",
      fen: "4k3/8/8/8/8/8/R7/4K3 w - - 0 1",
    },
    {
      slug: "queen-pressure-template",
      name: "Сложная середина",
      description: "Ферзь черных активен, белым нужно аккуратно найти план защиты и контригры.",
      fen: "4k3/8/8/8/8/3q4/8/4K3 w - - 0 1",
    },
    {
      slug: "grandmaster-peak-template",
      name: "Гроссмейстерский рубеж",
      description: "Плотная миттельшпильная позиция с рокировками и несколькими планами за обе стороны.",
      fen: "r3k2r/ppp2ppp/2n1bn2/3qp3/3P4/2N1PN2/PPP2PPP/R2QKB1R w KQkq - 0 1",
    },
  ],
  cards: [
    {
      slug: "opening-gate",
      order: 1,
      title: "Начало пути",
      text: "Первый гоблин нагло смотрит тебе в глаза!",
      congratulationsText: "Ты стойко держался и победил. Победа засчитана.",
      objective: { type: "checkmate" },
      difficulty: 0,
      rewardGold: 100,
      rewardScore: 100,
      completed: true,
      boardTemplateSlug: null,
      templateName: "Стандартная расстановка",
    },
    {
      slug: "knight-fork",
      order: 2,
      title: "Гоблины на коне. Конная развилка",
      text: "Позиция с открытыми линиями и шансом на тактический удар.",
      congratulationsText: "Развилка сработала. Противник повержен, награда твоя.",
      objective: { type: "give_check" },
      difficulty: 2,
      rewardGold: 300,
      rewardScore: 300,
      completed: false,
      boardTemplateSlug: "knight-fork-template",
      templateName: "Тактика коня",
    },
    {
      slug: "rook-file",
      order: 3,
      title: "Гоблины на ладье. Открытая вертикаль",
      text: "Ладьи уже готовы к атаке. Найди план и не отдай инициативу.",
      congratulationsText: "Вертикаль под контролем. Можно забирать награды.",
      objective: { type: "checkmate" },
      difficulty: 4,
      rewardGold: 500,
      rewardScore: 500,
      completed: false,
      boardTemplateSlug: "rook-file-template",
      templateName: "Ладейная атака",
    },
    {
      slug: "queen-pressure",
      order: 4,
      title: "Гоблины на ферзе. Давление ферзя",
      text: "Ферзь соперника активен. Нужно пережить угрозы и перехватить темп.",
      congratulationsText: "Давление выдержано. Победа засчитана.",
      objective: { type: "checkmate" },
      difficulty: 6,
      rewardGold: 700,
      rewardScore: 700,
      completed: false,
      boardTemplateSlug: "queen-pressure-template",
      templateName: "Сложная середина",
    },
    {
      slug: "grandmaster-peak",
      order: 5,
      title: "Гоблины на короле. Вершина карты",
      text: "Финальная демо-битва на максимальной сложности карты.",
      congratulationsText: "Вершина взята. Отличная победа в финальной битве карты.",
      objective: { type: "checkmate" },
      difficulty: 8,
      rewardGold: 900,
      rewardScore: 900,
      completed: false,
      boardTemplateSlug: "grandmaster-peak-template",
      templateName: "Гроссмейстерский рубеж",
    },
  ],
};

export const demoMapSeeds: DemoQuestMapSeed[] = [
  demoMapSeed,
  {
    slug: "forest-tactics-trail",
    title: "Лес тактических ловушек",
    description: "Короткая карта про вилки, связки и аккуратное развитие фигур.",
    order: 2,
    isPublished: true,
    boardTemplates: [
      {
        slug: "forest-bishop-pin-template",
        name: "Лесная связка",
        description: "Белым нужно сыграть спокойно: фигуры активны, но одна ошибка отдаст темп.",
        fen: "4k3/8/8/8/4r3/8/4B3/4K3 w - - 0 1",
      },
      {
        slug: "forest-knight-outpost-template",
        name: "Конный форпост",
        description: "Два коня в центре, цель — найти первый шах и не потерять фигуру.",
        fen: "4k3/8/8/3n4/8/2N5/8/4K3 w - - 0 1",
      },
      {
        slug: "forest-pawn-race-template",
        name: "Пешечная тропа",
        description: "Мини-эндшпиль, где важен каждый темп.",
        fen: "4k3/6p1/8/8/8/8/1P6/4K3 w - - 0 1",
      },
      {
        slug: "forest-queen-trap-template",
        name: "Ловушка ферзя",
        description: "Ферзь соперника активен, но ладья может перехватить инициативу.",
        fen: "4k3/8/8/8/3q4/8/4R3/4K3 w - - 0 1",
      },
      {
        slug: "forest-final-file-template",
        name: "Последняя вертикаль леса",
        description: "Ладья и король учат держать открытую линию.",
        fen: "4k3/8/8/8/8/8/R7/4K3 w - - 0 1",
      },
    ],
    cards: [
      {
        slug: "forest-first-snare",
        order: 1,
        title: "Первая лесная ловушка",
        text: "Сделай первые ходы точно и переживи стартовую атаку.",
        congratulationsText: "Ловушка обезврежена. Можно идти глубже в лес.",
        objective: { type: "checkmate" },
        difficulty: 1,
        rewardGold: 160,
        rewardScore: 160,
        completed: false,
        boardTemplateSlug: null,
        templateName: "Стандартная расстановка",
      },
      {
        slug: "forest-bishop-pin",
        order: 2,
        title: "Связка на просеке",
        text: "Слон держит линию. Найди способ использовать связку.",
        congratulationsText: "Связка сработала, позиция удержана.",
        objective: { type: "checkmate" },
        difficulty: 2,
        rewardGold: 260,
        rewardScore: 260,
        completed: false,
        boardTemplateSlug: "forest-bishop-pin-template",
        templateName: "Лесная связка",
      },
      {
        slug: "forest-knight-outpost",
        order: 3,
        title: "Конь на форпосте",
        text: "Конь в центре диктует игру. Покажи первый шах.",
        congratulationsText: "Форпост закреплен, соперник отступает.",
        objective: { type: "checkmate" },
        difficulty: 3,
        rewardGold: 360,
        rewardScore: 360,
        completed: false,
        boardTemplateSlug: "forest-knight-outpost-template",
        templateName: "Конный форпост",
      },
      {
        slug: "forest-queen-trap",
        order: 4,
        title: "Ферзь в чаще",
        text: "Не гоняйся за ферзем вслепую: сначала переживи угрозы.",
        congratulationsText: "Угрозы погашены, темп за тобой.",
        objective: { type: "checkmate" },
        difficulty: 4,
        rewardGold: 460,
        rewardScore: 460,
        completed: false,
        boardTemplateSlug: "forest-queen-trap-template",
        templateName: "Ловушка ферзя",
      },
      {
        slug: "forest-final-file",
        order: 5,
        title: "Вертикаль у старого дуба",
        text: "Финал карты: ладья должна довести атаку до мата.",
        congratulationsText: "Лесная карта пройдена, награда твоя.",
        objective: { type: "checkmate" },
        difficulty: 5,
        rewardGold: 560,
        rewardScore: 560,
        completed: false,
        boardTemplateSlug: "forest-final-file-template",
        templateName: "Последняя вертикаль леса",
      },
    ],
  },
  {
    slug: "desert-endgame-road",
    title: "Песчаная дорога эндшпилей",
    description: "Карта про пешечные гонки, выживание и точные эндшпильные решения.",
    order: 3,
    isPublished: true,
    boardTemplates: [
      {
        slug: "desert-pawn-break-template",
        name: "Пешечный прорыв",
        description: "Один проходной темп решает всю партию.",
        fen: "4k3/8/3p4/8/4P3/8/8/4K3 w - - 0 1",
      },
      {
        slug: "desert-rook-checks-template",
        name: "Шахи по пустыне",
        description: "Ладья гонит короля по открытой доске.",
        fen: "4k3/8/8/8/8/8/7R/4K3 w - - 0 1",
      },
      {
        slug: "desert-minor-duel-template",
        name: "Дуэль легких фигур",
        description: "Слон против коня, цель — не дать сопернику активизироваться.",
        fen: "4k3/8/8/8/3n4/8/2B5/4K3 w - - 0 1",
      },
      {
        slug: "desert-queen-race-template",
        name: "Ферзевый мираж",
        description: "Ферзь далеко, но угрозы появляются быстро.",
        fen: "4k3/8/8/8/8/6q1/8/4KQ2 w - - 0 1",
      },
      {
        slug: "desert-last-stand-template",
        name: "Последняя стоянка",
        description: "Плотная позиция на выживание против активного короля.",
        fen: "4k3/8/4p3/3pP3/3P4/8/8/4K3 w - - 0 1",
      },
    ],
    cards: [
      {
        slug: "desert-open-heat",
        order: 1,
        title: "Жара первых ходов",
        text: "В пустыне нельзя тратить темпы. Продержись стартовый отрезок.",
        congratulationsText: "Первые угрозы пережиты, путь открыт.",
        objective: { type: "checkmate" },
        difficulty: 2,
        rewardGold: 220,
        rewardScore: 220,
        completed: false,
        boardTemplateSlug: null,
        templateName: "Стандартная расстановка",
      },
      {
        slug: "desert-pawn-break",
        order: 2,
        title: "Пешечный прорыв",
        text: "Найди точный темп в пешечном окончании.",
        congratulationsText: "Пешка прошла, позиция выиграна.",
        objective: { type: "checkmate" },
        difficulty: 3,
        rewardGold: 320,
        rewardScore: 320,
        completed: false,
        boardTemplateSlug: "desert-pawn-break-template",
        templateName: "Пешечный прорыв",
      },
      {
        slug: "desert-rook-checks",
        order: 3,
        title: "Ладейные шахи",
        text: "Дай шах и удержи инициативу ладьей.",
        congratulationsText: "Король загнан под шахи.",
        objective: { type: "checkmate" },
        difficulty: 4,
        rewardGold: 420,
        rewardScore: 420,
        completed: false,
        boardTemplateSlug: "desert-rook-checks-template",
        templateName: "Шахи по пустыне",
      },
      {
        slug: "desert-queen-race",
        order: 4,
        title: "Ферзевый мираж",
        text: "Ферзи готовы к размену угрозами. Переживи критические ходы.",
        congratulationsText: "Мираж рассеялся, атака отбита.",
        objective: { type: "checkmate" },
        difficulty: 5,
        rewardGold: 520,
        rewardScore: 520,
        completed: false,
        boardTemplateSlug: "desert-queen-race-template",
        templateName: "Ферзевый мираж",
      },
      {
        slug: "desert-last-stand",
        order: 5,
        title: "Последняя стоянка",
        text: "Финал пустыни: удержи пешечный фронт до конца.",
        congratulationsText: "Песчаная дорога пройдена.",
        objective: { type: "checkmate" },
        difficulty: 6,
        rewardGold: 620,
        rewardScore: 620,
        completed: false,
        boardTemplateSlug: "desert-last-stand-template",
        templateName: "Последняя стоянка",
      },
    ],
  },
  {
    slug: "citadel-checkmate-ascent",
    title: "Подъем к матовой цитадели",
    description: "Финальная встроенная карта с более острыми позициями и высокой наградой.",
    order: 4,
    isPublished: true,
    boardTemplates: [
      {
        slug: "citadel-back-rank-template",
        name: "Слабая последняя горизонталь",
        description: "Король заперт, ладья может решить партию.",
        fen: "6k1/6pp/8/8/8/8/5PPP/4R1K1 w - - 0 1",
      },
      {
        slug: "citadel-queen-battery-template",
        name: "Ферзевая батарея",
        description: "Ферзь и ладья давят по одной линии.",
        fen: "6k1/6pp/8/8/8/8/5PPP/4RQK1 w - - 0 1",
      },
      {
        slug: "citadel-knight-check-template",
        name: "Конный шах у ворот",
        description: "Конь рядом с королем, но нужен точный маршрут.",
        fen: "4k3/8/8/8/3N4/8/8/4K3 w - - 0 1",
      },
      {
        slug: "citadel-bishop-net-template",
        name: "Слоновая сеть",
        description: "Диагональ открыта, королю соперника тесно.",
        fen: "6k1/8/8/8/8/2B5/8/4K3 w - - 0 1",
      },
      {
        slug: "citadel-final-template",
        name: "Тронный зал",
        description: "Сильнейшая встроенная позиция перед пользовательскими картами.",
        fen: "6k1/5ppp/8/8/8/8/5PPP/4RQK1 w - - 0 1",
      },
    ],
    cards: [
      {
        slug: "citadel-gate",
        order: 1,
        title: "Ворота цитадели",
        text: "На входе важна надежность: переживи серию ответов движка.",
        congratulationsText: "Ворота открыты.",
        objective: { type: "checkmate" },
        difficulty: 4,
        rewardGold: 300,
        rewardScore: 300,
        completed: false,
        boardTemplateSlug: null,
        templateName: "Стандартная расстановка",
      },
      {
        slug: "citadel-back-rank",
        order: 2,
        title: "Последняя горизонталь",
        text: "Ищи матовую сетку по слабой горизонтали.",
        congratulationsText: "Горизонталь вскрыта.",
        objective: { type: "checkmate" },
        difficulty: 5,
        rewardGold: 450,
        rewardScore: 450,
        completed: false,
        boardTemplateSlug: "citadel-back-rank-template",
        templateName: "Слабая последняя горизонталь",
      },
      {
        slug: "citadel-knight-check",
        order: 3,
        title: "Конный шах у ворот",
        text: "Найди шах конем и сохрани инициативу.",
        congratulationsText: "Шах найден, оборона дрогнула.",
        objective: { type: "checkmate" },
        difficulty: 6,
        rewardGold: 600,
        rewardScore: 600,
        completed: false,
        boardTemplateSlug: "citadel-knight-check-template",
        templateName: "Конный шах у ворот",
      },
      {
        slug: "citadel-queen-battery",
        order: 4,
        title: "Ферзевая батарея",
        text: "Ферзь и ладья готовы к решающему удару.",
        congratulationsText: "Батарея пробила защиту.",
        objective: { type: "checkmate" },
        difficulty: 7,
        rewardGold: 750,
        rewardScore: 750,
        completed: false,
        boardTemplateSlug: "citadel-queen-battery-template",
        templateName: "Ферзевая батарея",
      },
      {
        slug: "citadel-final-room",
        order: 5,
        title: "Тронный зал",
        text: "Последняя встроенная битва перед пользовательскими картами.",
        congratulationsText: "Цитадель взята. Теперь можно строить свои карты.",
        objective: { type: "checkmate" },
        difficulty: 8,
        rewardGold: 950,
        rewardScore: 950,
        completed: false,
        boardTemplateSlug: "citadel-final-template",
        templateName: "Тронный зал",
      },
    ],
  },
];

export function getDemoCardBySlug(slug: string) {
  for (const map of demoMapSeeds) {
    const card = map.cards.find((candidate) => candidate.slug === slug);
    if (card) return card;
  }

  return undefined;
}

export function getCardStartingFen(card: DemoQuestCardSeed) {
  if (card.startingFen) return card.startingFen;
  if (!card.boardTemplateSlug) return STARTING_FEN;

  for (const map of demoMapSeeds) {
    const template = map.boardTemplates.find((candidate) => candidate.slug === card.boardTemplateSlug);
    if (template) return template.fen;
  }

  return undefined;
}

export function validateDemoSeedData() {
  const issues: string[] = [];
  const mapSlugs = new Set<string>();
  const mapOrders = new Set<number>();
  const globalTemplateSlugs = new Set<string>();
  const globalCardSlugs = new Set<string>();

  for (const map of demoMapSeeds) {
    const templateSlugs = new Set(map.boardTemplates.map((template) => template.slug));
    const cardOrders = new Set<number>();

    if (mapSlugs.has(map.slug)) {
      issues.push(`Дублирующийся slug карты: ${map.slug}.`);
    }
    mapSlugs.add(map.slug);

    if (mapOrders.has(map.order)) {
      issues.push(`Дублирующийся order карты: ${map.order}.`);
    }
    mapOrders.add(map.order);

    if (map.cards.length !== 5) {
      issues.push(`Карта ${map.slug} должна содержать ровно 5 карточек.`);
    }

    for (const template of map.boardTemplates) {
      if (globalTemplateSlugs.has(template.slug)) {
        issues.push(`Дублирующийся slug шаблона: ${template.slug}.`);
      }
      globalTemplateSlugs.add(template.slug);

      const result = validateBoardTemplateFen(template.fen);
      if (!result.ok) {
        issues.push(`Шаблон ${template.slug} содержит невалидный FEN: ${result.issues.map((issue) => issue.code).join(", ")}`);
      }
    }

    for (const card of map.cards) {
      if (globalCardSlugs.has(card.slug)) {
        issues.push(`Дублирующийся slug карточки: ${card.slug}.`);
      }
      globalCardSlugs.add(card.slug);

      if (cardOrders.has(card.order)) {
        issues.push(`Дублирующийся order карточки ${card.order} в карте ${map.slug}.`);
      }
      cardOrders.add(card.order);

      if (card.difficulty < 0 || card.difficulty > 8) {
        issues.push(`Сложность карточки ${card.slug} должна быть от 0 до 8.`);
      }

      if (card.rewardGold <= 0 || card.rewardScore <= 0) {
        issues.push(`Награда карточки ${card.slug} должна быть положительной.`);
      }

      if (card.boardTemplateSlug && !templateSlugs.has(card.boardTemplateSlug)) {
        issues.push(`Карточка ${card.slug} ссылается на неизвестный шаблон ${card.boardTemplateSlug}.`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
