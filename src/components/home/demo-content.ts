/** Presentation fixtures only. No persistence, API contracts, or business entities. */
export const demoTopics = ["Все темы", "Технологии", "Дизайн", "Идеи", "Культура"] as const;
export type DemoTopic = (typeof demoTopics)[number];
export type DemoArtwork = "orbit" | "type" | "architecture";

export type DemoStory = {
  id: string;
  category: Exclude<DemoTopic, "Все темы">;
  title: string;
  excerpt: string;
  author: string;
  initials: string;
  readingMinutes: number;
  artwork: DemoArtwork;
};

export const demoStories: readonly DemoStory[] = [
  {
    id: "quiet-technology",
    category: "Технологии",
    title: "Технологии, которые умеют быть незаметными",
    excerpt: "Почему следующий большой шаг в интерфейсах — дать нам чуть больше тишины.",
    author: "Марк Волков",
    initials: "МВ",
    readingMinutes: 6,
    artwork: "orbit",
  },
  {
    id: "type-and-voice",
    category: "Дизайн",
    title: "У каждого шрифта есть свой голос",
    excerpt: "Как типографика меняет смысл ещё до того, как мы прочитаем первое слово.",
    author: "Анна Белова",
    initials: "АБ",
    readingMinutes: 4,
    artwork: "type",
  },
  {
    id: "space-to-think",
    category: "Идеи",
    title: "Оставить место для случайных открытий",
    excerpt: "Не всё нужно оптимизировать. Иногда лучшие идеи приходят по дороге в другое место.",
    author: "Саша Мир",
    initials: "СМ",
    readingMinutes: 8,
    artwork: "architecture",
  },
];

export const demoSpotlight = [
  { category: "Культура", title: "Интернет снова становится маленьким", note: "О личных сайтах и камерных сообществах" },
  { category: "Технологии", title: "Что останется человеку в эпоху ИИ", note: "Любопытство как профессиональный навык" },
  { category: "Дизайн", title: "Хороший дизайн начинается с вопроса", note: "Сначала понять. Потом нарисовать." },
] as const;
