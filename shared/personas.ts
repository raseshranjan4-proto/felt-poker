import { seededRng } from './cards';
import { VARIANTS } from './variants';

export type Archetype = 'shark' | 'tag' | 'lag' | 'maniac' | 'rock' | 'nit' | 'station' | 'fish';

export interface Traits {
  looseness: number;
  aggression: number;
  bluffing: number;
  tilt: number;
  discipline: number;
  position: number;
  chattiness: number;
}

export interface Persona {
  id: string;
  name: string;
  nickname: string;
  country: string; // ISO-2
  age: number;
  archetype: Archetype;
  stars: 1 | 2 | 3 | 4 | 5;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  favGame: string;
  traits: Traits;
  bio: string;
  catchphrase: string;
  tell: string;
  initials: string;
}

export const ARCHETYPES: Record<Archetype, { label: string; count: number; plays: string; traits: Record<keyof Traits, [number, number]>; stars: [number, number] }> = {
  shark: { label: 'Shark', count: 30, plays: 'Solid, balanced, punishes mistakes', stars: [5, 5],
    traits: { looseness: [30, 45], aggression: [60, 80], bluffing: [35, 55], tilt: [2, 15], discipline: [85, 98], position: [80, 98], chattiness: [10, 70] } },
  tag: { label: 'Tight-aggressive', count: 40, plays: 'Few hands, bets them hard', stars: [3, 4],
    traits: { looseness: [18, 32], aggression: [62, 82], bluffing: [20, 40], tilt: [8, 30], discipline: [70, 90], position: [60, 85], chattiness: [5, 55] } },
  lag: { label: 'Loose-aggressive', count: 35, plays: 'Many hands, constant pressure', stars: [3, 4],
    traits: { looseness: [48, 68], aggression: [70, 90], bluffing: [50, 75], tilt: [15, 40], discipline: [50, 75], position: [60, 90], chattiness: [30, 85] } },
  maniac: { label: 'Maniac', count: 25, plays: 'Raises almost anything, huge bluffs', stars: [2, 3],
    traits: { looseness: [75, 95], aggression: [85, 99], bluffing: [70, 95], tilt: [40, 80], discipline: [5, 30], position: [10, 40], chattiness: [60, 99] } },
  rock: { label: 'Rock', count: 30, plays: 'Only premium hands; easy to read', stars: [2, 3],
    traits: { looseness: [8, 18], aggression: [35, 55], bluffing: [3, 12], tilt: [3, 15], discipline: [80, 95], position: [30, 55], chattiness: [5, 40] } },
  nit: { label: 'Nit', count: 25, plays: 'Folds nearly everything, tiny bets', stars: [1, 2],
    traits: { looseness: [3, 12], aggression: [10, 30], bluffing: [0, 8], tilt: [5, 25], discipline: [60, 85], position: [10, 35], chattiness: [5, 50] } },
  station: { label: 'Calling station', count: 35, plays: 'Calls too much, rarely raises', stars: [1, 2],
    traits: { looseness: [70, 92], aggression: [5, 22], bluffing: [2, 12], tilt: [20, 50], discipline: [5, 25], position: [5, 25], chattiness: [40, 90] } },
  fish: { label: 'Recreational', count: 40, plays: 'Random, emotional, fun', stars: [1, 2],
    traits: { looseness: [50, 85], aggression: [20, 60], bluffing: [15, 50], tilt: [40, 90], discipline: [10, 40], position: [5, 30], chattiness: [50, 99] } },
};

const NAMES: Record<string, { first: string[]; last: string[] }> = {
  US: { first: ['Dusty', 'Carla', 'Mason', 'Tammy', 'Hank', 'Jolene', 'Travis', 'Nora', 'Wade', 'Lacey', 'Russ', 'Darlene'], last: ['Calhoun', 'Whitaker', 'Boone', 'Pruitt', 'Haskins', 'Dorsey', 'Kimball', 'Ruiz', 'Garner', 'Spade'] },
  GB: { first: ['Nigel', 'Fiona', 'Rupert', 'Imogen', 'Clive', 'Harriet', 'Alfie', 'Poppy'], last: ['Ashworth', 'Pembroke', 'Hale', 'Fairfax', 'Thorne', 'Cobb', 'Bellamy'] },
  IN: { first: ['Amit', 'Priya', 'Rohan', 'Kavya', 'Vikram', 'Ananya', 'Arjun', 'Meera', 'Kabir', 'Isha'], last: ['Rao', 'Mehta', 'Iyer', 'Kapoor', 'Nair', 'Bose', 'Malhotra', 'Desai'] },
  JP: { first: ['Yuki', 'Kenji', 'Haruto', 'Aiko', 'Ren', 'Sakura', 'Daichi', 'Mei'], last: ['Tanaka', 'Sato', 'Watanabe', 'Kobayashi', 'Mori', 'Ishida'] },
  BR: { first: ['Thiago', 'Larissa', 'Bruno', 'Camila', 'Rafael', 'Bianca'], last: ['Souza', 'Almeida', 'Costa', 'Pereira', 'Lima', 'Barros'] },
  DE: { first: ['Lukas', 'Greta', 'Matthias', 'Lena', 'Klaus', 'Anja'], last: ['Becker', 'Hoffmann', 'Krüger', 'Vogel', 'Schäfer', 'Brandt'] },
  NG: { first: ['Mara', 'Chidi', 'Ngozi', 'Tunde', 'Amaka', 'Femi'], last: ['Okafor', 'Adeyemi', 'Eze', 'Balogun', 'Nwosu', 'Okon'] },
  SE: { first: ['Ingrid', 'Lars', 'Astrid', 'Nils', 'Freja', 'Sven'], last: ['Solberg', 'Lindqvist', 'Berg', 'Holm', 'Ekström'] },
  IT: { first: ['Sal', 'Giulia', 'Marco', 'Francesca', 'Enzo', 'Chiara'], last: ['Romano', 'Ricci', 'Moretti', 'Conti', 'Gallo'] },
  FR: { first: ['Léa', 'Hugo', 'Camille', 'Julien', 'Manon', 'Théo'], last: ['Laurent', 'Moreau', 'Girard', 'Fontaine', 'Mercier'] },
  KR: { first: ['Min-jun', 'Seo-yeon', 'Ji-ho', 'Ha-eun', 'Do-yun'], last: ['Kim', 'Park', 'Choi', 'Jung', 'Kang'] },
  MX: { first: ['Diego', 'Valeria', 'Mateo', 'Ximena', 'Emilio'], last: ['Hernández', 'Ortega', 'Castillo', 'Navarro', 'Vargas'] },
  AU: { first: ['Bluey', 'Shazza', 'Mick', 'Kylie', 'Gazza', 'Tahlia'], last: ['Dawson', 'McKenzie', 'Fraser', 'Kelly', 'Nolan'] },
  CN: { first: ['Wei', 'Li Na', 'Jun', 'Xiu', 'Hao', 'Mei Lin'], last: ['Chen', 'Wang', 'Zhang', 'Liu', 'Huang'] },
  EG: { first: ['Omar', 'Yasmin', 'Karim', 'Nadia', 'Tarek'], last: ['Hassan', 'Farouk', 'Mansour', 'Saleh'] },
  RU: { first: ['Dmitri', 'Olga', 'Sergei', 'Katya', 'Ivan'], last: ['Volkov', 'Petrova', 'Sokolov', 'Orlova'] },
  CA: { first: ['Gord', 'Shannon', 'Brody', 'Maddie', 'Rene'], last: ['Tremblay', 'MacLeod', 'Gagnon', 'Fraser'] },
  ES: { first: ['Javier', 'Lucía', 'Pablo', 'Carmen', 'Álvaro'], last: ['García', 'Romero', 'Navarro', 'Torres'] },
};

const NICKS: Record<Archetype, string[]> = {
  shark: ['The Ledger', 'Ice Water', 'The Surgeon', 'Calculator', 'Silent Storm', 'The Closer', 'Cold Deck', 'The Professor', 'Gravity', 'Checkmate', 'The Auditor', 'Velvet Hammer'],
  tag: ['Sharpshooter', 'The Sniper', 'Clockwork', 'Precision', 'Straight Arrow', 'The Machine', 'Patience', 'Iron Will', 'The Scalpel', 'Steady Eddie'],
  lag: ['Pressure Cooker', 'The Hurricane', 'Wildfire', 'Loose Cannon', 'The Bulldozer', 'Pedal Down', 'Fast Lane', 'The Shark Tank', 'Thunder', 'Barrel Roll'],
  maniac: ['All-In', 'Big Sal', 'Kaboom', 'The Tornado', 'Firestarter', 'No Brakes', 'Mayhem', 'Dynamite', 'Ten Barrels', 'Showtime'],
  rock: ['The Boulder', 'Granite', 'The Wall', 'Old Faithful', 'Stonehenge', 'The Monk', 'Bedrock', 'Glacier'],
  nit: ['Tight Purse', 'The Miser', 'Penny', 'Snail', 'The Hermit', 'Fold Master', 'Scrooge', 'Turtle'],
  station: ['I Gotta See It', 'The Sponge', 'Curious George', 'Velcro', 'The Collector', 'Showdown Sam', 'Just Checking', 'Sticky'],
  fish: ['Lucky Charm', 'Beginner\'s Luck', 'Sunday Driver', 'Weekend Warrior', 'Hopeful', 'Card Sharp (Self-Titled)', 'Rainbow', 'Coin Flip', 'Happy Hour', 'Long Shot'],
};

const BIO_OPENERS = [
  'Retired %job who', 'Former %job who', 'Off-duty %job who', 'Part-time %job who', 'Self-described %job who', 'Night-shift %job who',
];
const JOBS = ['accountant', 'trucker', 'dentist', 'chess coach', 'chef', 'pilot', 'librarian', 'lawyer', 'florist', 'bus driver', 'marine biologist', 'magician', 'tax inspector', 'DJ', 'nurse', 'barista', 'architect', 'stunt double', 'violinist', 'firefighter', 'data scientist', 'tour guide'];
const BIO_ENDS: Record<Archetype, string[]> = {
  shark: ['tracks every bet out loud.', 'never raises without a reason they can recite.', 'studies hand histories on the train.', 'has played the circuit for twenty years.'],
  tag: ['waits for the right spot, then strikes.', 'keeps a notebook of every opponent.', 'plays exactly four tables of focus.', 'folds without a flicker of regret.'],
  lag: ['believes every pot is up for grabs.', 'likes to make the table uncomfortable.', 'treats the button like a birthright.', 'reads weakness from across the room.'],
  maniac: ['thinks folding is a myth.', 'raises first and asks questions never.', 'came for the action and brought plenty.', 'once shoved blind on a dare.'],
  rock: ['knits between hands.', 'folds 85% of hands and enjoys it.', 'has never bluffed, on principle.', 'waits all night for Aces.'],
  nit: ['protects every chip like family.', 'calls a min-raise "reckless".', 'brings exact change to the game.', 'considers the big blind an insult.'],
  station: ['just has to see what you had.', 'calls because the river might help.', 'thinks every bet is a bluff.', 'came to see cards, not fold them.'],
  fish: ['learned the rules last Tuesday.', 'plays every hand with a hunch.', 'brings a lucky charm to every game.', 'is here mostly for the snacks.'],
};
const PHRASES: Record<Archetype, string[]> = {
  shark: ["That's 1,240 in the pot. I have it written down.", 'Interesting sizing.', 'Take your time.', 'Numbers never lie.', 'Fold equity is a beautiful thing.'],
  tag: ['Patience pays.', 'Not this one.', 'I like my spot.', 'Discipline wins.', 'Right place, right time.'],
  lag: ['Let\'s make it interesting.', 'Pressure is a privilege.', 'You sure about that?', 'Every pot is my pot.', 'Fortune favours the bold.'],
  maniac: ['ALL IN! Who\'s scared?', 'Raise! Raise it again!', 'Cards are just suggestions.', 'Boom!', 'Chips are for throwing.'],
  rock: ['I only play the good ones.', 'Wake me when it\'s Aces.', 'Fold. Again.', 'Slow and steady.', 'No need to rush.'],
  nit: ['That\'s too rich for me.', 'I\'ll wait.', 'Maybe next hand.', 'Ooh, risky.', 'Fold, obviously.'],
  station: ['I gotta see it.', 'Call. What do you have?', 'River might help.', 'Can\'t fold now!', 'Let\'s see a showdown.'],
  fish: ['Is a flush good?', 'I have a feeling about this one!', 'Ooh, pretty cards!', 'Was that a bluff?', 'Lucky lucky!'],
};
const TELLS = [
  'goes quiet when holding a monster.', 'chats more when bluffing.', 'bets fast with weak hands.', 'tanks before big folds.',
  'stacks chips neatly with strong hands.', 'over-bets the river when scared.', 'always checks the nuts on the flop.', 'sighs before raising.',
  'min-raises with draws.', 'stares at the board when they miss.', 'talks about the weather when bluffing.', 'snap-calls with top pair.',
  'small-bets the turn with air.', 'hums when they hit the flop.', 'never bluffs into three players.', 'raises to exactly 3x with premiums.',
];

// The six hand-written showcase personas from the spec come first.
const SHOWCASE: Array<Partial<Persona> & { name: string; archetype: Archetype }> = [
  { name: 'Mara Okafor', nickname: 'The Ledger', country: 'NG', age: 41, archetype: 'shark', favGame: 'PLO5',
    traits: { looseness: 38, aggression: 62, bluffing: 44, tilt: 12, discipline: 91, position: 85, chattiness: 70 },
    bio: 'Ex-accountant who tracks every bet out loud. Never raises without a reason she can recite.',
    catchphrase: "That's 1,240 in the pot. I have it written down.", tell: 'goes quiet when holding a monster.' },
  { name: 'Dusty Calhoun', nickname: 'I Gotta See It', country: 'US', age: 63, archetype: 'station', favGame: "No-Limit Hold'em",
    traits: { looseness: 88, aggression: 14, bluffing: 6, tilt: 35, discipline: 12, position: 10, chattiness: 76 },
    bio: 'Retired trucker who has never folded the river in his life.', catchphrase: 'I gotta see it.', tell: 'snap-calls with top pair.' },
  { name: 'Yuki Tanaka', nickname: 'Clockwork', country: 'JP', age: 29, archetype: 'tag', favGame: 'PLO',
    traits: { looseness: 24, aggression: 78, bluffing: 30, tilt: 10, discipline: 88, position: 80, chattiness: 6 },
    bio: 'Plays fast and says almost nothing. Folds without a flicker.', catchphrase: '…', tell: 'bets fast with weak hands.' },
  { name: 'Sal Romano', nickname: 'Big Sal', country: 'IT', age: 52, archetype: 'maniac', favGame: 'Crazy Pineapple',
    traits: { looseness: 92, aggression: 97, bluffing: 88, tilt: 72, discipline: 10, position: 20, chattiness: 95 },
    bio: 'Raises blind and laughs louder after losing.', catchphrase: 'Raise! Raise it again!', tell: 'chats more when bluffing.' },
  { name: 'Ingrid Solberg', nickname: 'The Monk', country: 'SE', age: 58, archetype: 'rock', favGame: "Fixed-Limit Hold'em",
    traits: { looseness: 10, aggression: 45, bluffing: 4, tilt: 5, discipline: 94, position: 40, chattiness: 20 },
    bio: 'Knits between hands and folds 85% of them.', catchphrase: "Wake me when it's Aces.", tell: 'stacks chips neatly with strong hands.' },
  { name: 'Amit Rao', nickname: 'The Professor', country: 'IN', age: 47, archetype: 'lag', favGame: 'Big O',
    traits: { looseness: 60, aggression: 84, bluffing: 70, tilt: 20, discipline: 72, position: 92, chattiness: 80 },
    bio: 'Explains the maths of his bluffs, usually after they work.', catchphrase: 'Fold equity is a beautiful thing.', tell: 'raises to exactly 3x with premiums.' },
];

const difficultyFor = (stars: number): Persona['difficulty'] => (stars >= 4 ? 'Hard' : stars === 3 ? 'Medium' : 'Easy');
const initialsOf = (name: string) => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

function generate(): Persona[] {
  const rng = seededRng(20261030);
  const pick = <T,>(a: T[]) => a[Math.floor(rng() * a.length)];
  const range = ([lo, hi]: [number, number]) => Math.round(lo + rng() * (hi - lo));
  const used = new Set<string>();
  const out: Persona[] = [];

  for (const s of SHOWCASE) {
    const a = ARCHETYPES[s.archetype];
    const stars = range(a.stars as [number, number]) as Persona['stars'];
    used.add(s.name);
    out.push({
      ...(s as Persona),
      id: `p${out.length + 1}`, initials: initialsOf(s.name), stars, difficulty: difficultyFor(stars),
    });
  }

  const countries = Object.keys(NAMES);
  for (const arch of Object.keys(ARCHETYPES) as Archetype[]) {
    const a = ARCHETYPES[arch];
    const already = out.filter((p) => p.archetype === arch).length;
    for (let k = already; k < a.count; k++) {
      let name = '', country = '';
      for (let tries = 0; tries < 50; tries++) {
        country = pick(countries);
        name = `${pick(NAMES[country].first)} ${pick(NAMES[country].last)}`;
        if (!used.has(name)) break;
      }
      used.add(name);
      const traits = Object.fromEntries(Object.entries(a.traits).map(([t, r]) => [t, range(r)])) as unknown as Traits;
      const stars = range(a.stars as [number, number]) as Persona['stars'];
      const job = pick(JOBS);
      out.push({
        id: `p${out.length + 1}`,
        name,
        nickname: pick(NICKS[arch]),
        country,
        age: 21 + Math.floor(rng() * 52),
        archetype: arch,
        stars,
        difficulty: difficultyFor(stars),
        favGame: pick(VARIANTS).tag,
        traits,
        bio: `${pick(BIO_OPENERS).replace('%job', job)} ${pick(BIO_ENDS[arch])}`.replace(/^./, (c) => c.toUpperCase()),
        catchphrase: pick(PHRASES[arch]),
        tell: pick(TELLS),
        initials: initialsOf(name),
      });
    }
  }
  return out;
}

export const PERSONAS: Persona[] = generate();
export const personaById = (id: string | undefined) => PERSONAS.find((p) => p.id === id);

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States', GB: 'United Kingdom', IN: 'India', JP: 'Japan', BR: 'Brazil', DE: 'Germany', NG: 'Nigeria', SE: 'Sweden',
  IT: 'Italy', FR: 'France', KR: 'South Korea', MX: 'Mexico', AU: 'Australia', CN: 'China', EG: 'Egypt', RU: 'Russia', CA: 'Canada', ES: 'Spain',
};

// ---------- table talk ----------

export type ChatTrigger = 'greet' | 'bigWin' | 'bigLoss' | 'bluffWin' | 'allIn' | 'fold' | 'raise';

const LINES: Record<ChatTrigger, Partial<Record<Archetype, string[]>> & { any: string[] }> = {
  greet: { any: ['Evening, all.', 'Deal me in.', 'Good luck, everyone.', 'Hi hi!', 'Let\'s play.'],
    shark: ['Evening. Let\'s see what you have.'], maniac: ['Who\'s ready to gamble?!'], nit: ['Blinds seem high tonight.'] },
  bigWin: { any: ['Ship it!', 'I\'ll take that.', 'Nice pot.', 'Thank you very much.'],
    shark: ['As calculated.'], fish: ['I won?! I WON!'], station: ['Told you I had to see it.'], maniac: ['BOOM! Who\'s next?'] },
  bigLoss: { any: ['Ouch.', 'Nice hand.', 'Unbelievable river.', 'Well played.'],
    maniac: ['Rigged! Deal again!'], fish: ['But I had a pair…'], nit: ['This is why I fold.'], shark: ['Variance.'] },
  bluffWin: { any: ['You\'ll never know.', 'Good fold.', 'Maybe I had it.'],
    lag: ['Pressure is a privilege.'], shark: ['Good laydown.'], maniac: ['Seven-deuce, baby!'] },
  allIn: { any: ['All in.', 'Let\'s gamble.', 'Your decision.'],
    maniac: ['ALL IN! Who\'s scared?'], rock: ['I\'ve waited all night for this.'], fish: ['Here goes nothing!'] },
  fold: { any: ['Not this time.', 'Fold.', 'Too rich for me.'], nit: ['Easy fold.'], station: ['Ugh, fine. Fold.'] },
  raise: { any: ['Raise.', 'Let\'s make it bigger.', 'Bump it.'], maniac: ['Raise! Raise it again!'], lag: ['Let\'s make it interesting.'] },
};

export function chatLine(p: Persona, trigger: ChatTrigger, rng: () => number = Math.random): string | null {
  const odds = { greet: 0.6, bigWin: 0.6, bigLoss: 0.5, bluffWin: 0.6, allIn: 0.5, fold: 0.05, raise: 0.08 }[trigger];
  if (rng() > odds * (p.traits.chattiness / 70)) return null;
  const pool = LINES[trigger][p.archetype] ?? [];
  const all = rng() < 0.4 ? [p.catchphrase] : pool.length && rng() < 0.6 ? pool : LINES[trigger].any;
  return all[Math.floor(rng() * all.length)];
}
