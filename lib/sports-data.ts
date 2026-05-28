// Sports leagues and their teams — used for the League & Team dropdowns on the eBay listing form.

export interface LeagueData {
  label: string;       // display name shown in the dropdown (matches eBay's accepted aspect value exactly)
  sport: string;       // groups optgroups in the select (must match a value in SPORT_LIST)
  teams: string[];
}

// Normalize a stored league value (which may be in short form from old data) to match
// the dropdown's long-form label. e.g. "NFL" → "National Football League (NFL)".
const LEAGUE_ALIASES: Record<string, string> = {
  "MLB":  "Major League Baseball (MLB)",
  "NFL":  "National Football League (NFL)",
  "NBA":  "National Basketball Association (NBA)",
  "WNBA": "Women's National Basketball Association (WNBA)",
  "NHL":  "National Hockey League (NHL)",
  "MLS":  "Major League Soccer (MLS)",
  "UFC":  "Ultimate Fighting Championship (UFC)",
  "Hockey": "Ice Hockey",  // sport alias
  "MMA":    "Mixed Martial Arts (MMA)",  // sport alias
};
export function canonicalizeLeague(stored: string | null | undefined): string {
  if (!stored) return "";
  return LEAGUE_ALIASES[stored] ?? stored;
}
export function canonicalizeSport(stored: string | null | undefined): string {
  if (!stored) return "";
  return LEAGUE_ALIASES[stored] ?? stored;
}

export const LEAGUES: LeagueData[] = [

  // ── Baseball ───────────────────────────────────────────────────────────────
  {
    label: "Major League Baseball (MLB)", sport: "Baseball",
    teams: [
      "Arizona Diamondbacks","Atlanta Braves","Baltimore Orioles","Boston Red Sox",
      "Chicago Cubs","Chicago White Sox","Cincinnati Reds","Cleveland Guardians",
      "Colorado Rockies","Detroit Tigers","Houston Astros","Kansas City Royals",
      "Los Angeles Angels","Los Angeles Dodgers","Miami Marlins","Milwaukee Brewers",
      "Minnesota Twins","New York Mets","New York Yankees","Oakland Athletics",
      "Philadelphia Phillies","Pittsburgh Pirates","San Diego Padres","San Francisco Giants",
      "Seattle Mariners","St. Louis Cardinals","Tampa Bay Rays","Texas Rangers",
      "Toronto Blue Jays","Washington Nationals",
    ],
  },
  {
    label: "NPB (Japan)", sport: "Baseball",
    teams: [
      "Chiba Lotte Marines","Fukuoka SoftBank Hawks","Hanshin Tigers",
      "Hiroshima Toyo Carp","Hokkaido Nippon-Ham Fighters","Orix Buffaloes",
      "Saitama Seibu Lions","Tohoku Rakuten Golden Eagles","Tokyo Yakult Swallows",
      "Toyo Carp","Yokohama DeNA BayStars","Yomiuri Giants",
    ],
  },
  {
    label: "KBO (Korea)", sport: "Baseball",
    teams: [
      "Doosan Bears","Hanwha Eagles","Kia Tigers","Kiwoom Heroes",
      "KT Wiz","LG Twins","Lotte Giants","NC Dinos","Samsung Lions","SSG Landers",
    ],
  },

  // ── Football ───────────────────────────────────────────────────────────────
  {
    label: "National Football League (NFL)", sport: "Football",
    teams: [
      "Arizona Cardinals","Atlanta Falcons","Baltimore Ravens","Buffalo Bills",
      "Carolina Panthers","Chicago Bears","Cincinnati Bengals","Cleveland Browns",
      "Dallas Cowboys","Denver Broncos","Detroit Lions","Green Bay Packers",
      "Houston Texans","Indianapolis Colts","Jacksonville Jaguars","Kansas City Chiefs",
      "Las Vegas Raiders","Los Angeles Chargers","Los Angeles Rams","Miami Dolphins",
      "Minnesota Vikings","New England Patriots","New Orleans Saints","New York Giants",
      "New York Jets","Philadelphia Eagles","Pittsburgh Steelers","San Francisco 49ers",
      "Seattle Seahawks","Tampa Bay Buccaneers","Tennessee Titans","Washington Commanders",
    ],
  },
  {
    label: "CFL", sport: "Football",
    teams: [
      "BC Lions","Calgary Stampeders","Edmonton Elks","Hamilton Tiger-Cats",
      "Montreal Alouettes","Ottawa Redblacks","Saskatchewan Roughriders",
      "Toronto Argonauts","Winnipeg Blue Bombers",
    ],
  },
  {
    label: "USFL", sport: "Football",
    teams: [
      "Birmingham Stallions","Houston Gamblers","Memphis Showboats","Michigan Panthers",
      "New Jersey Generals","Philadelphia Stars","Pittsburgh Maulers","Tampa Bay Bandits",
    ],
  },

  // ── Basketball ─────────────────────────────────────────────────────────────
  {
    label: "National Basketball Association (NBA)", sport: "Basketball",
    teams: [
      "Atlanta Hawks","Boston Celtics","Brooklyn Nets","Charlotte Hornets",
      "Chicago Bulls","Cleveland Cavaliers","Dallas Mavericks","Denver Nuggets",
      "Detroit Pistons","Golden State Warriors","Houston Rockets","Indiana Pacers",
      "Los Angeles Clippers","Los Angeles Lakers","Memphis Grizzlies","Miami Heat",
      "Milwaukee Bucks","Minnesota Timberwolves","New Orleans Pelicans","New York Knicks",
      "Oklahoma City Thunder","Orlando Magic","Philadelphia 76ers","Phoenix Suns",
      "Portland Trail Blazers","Sacramento Kings","San Antonio Spurs","Toronto Raptors",
      "Utah Jazz","Washington Wizards",
    ],
  },
  {
    label: "Women's National Basketball Association (WNBA)", sport: "Basketball",
    teams: [
      "Atlanta Dream","Chicago Sky","Connecticut Sun","Dallas Wings",
      "Indiana Fever","Las Vegas Aces","Los Angeles Sparks","Minnesota Lynx",
      "New York Liberty","Phoenix Mercury","Seattle Storm","Washington Mystics",
    ],
  },

  // ── Hockey ─────────────────────────────────────────────────────────────────
  {
    label: "National Hockey League (NHL)", sport: "Ice Hockey",
    teams: [
      "Anaheim Ducks","Arizona Coyotes","Boston Bruins","Buffalo Sabres",
      "Calgary Flames","Carolina Hurricanes","Chicago Blackhawks","Colorado Avalanche",
      "Columbus Blue Jackets","Dallas Stars","Detroit Red Wings","Edmonton Oilers",
      "Florida Panthers","Los Angeles Kings","Minnesota Wild","Montreal Canadiens",
      "Nashville Predators","New Jersey Devils","New York Islanders","New York Rangers",
      "Ottawa Senators","Philadelphia Flyers","Pittsburgh Penguins","San Jose Sharks",
      "Seattle Kraken","St. Louis Blues","Tampa Bay Lightning","Toronto Maple Leafs",
      "Utah Hockey Club","Vancouver Canucks","Vegas Golden Knights","Washington Capitals",
      "Winnipeg Jets",
    ],
  },

  // ── Soccer ─────────────────────────────────────────────────────────────────
  {
    label: "Major League Soccer (MLS)", sport: "Soccer",
    teams: [
      "Atlanta United","Austin FC","Charlotte FC","Chicago Fire","CF Cincinnati",
      "Colorado Rapids","Columbus Crew","D.C. United","FC Dallas","Houston Dynamo",
      "Inter Miami CF","LA Galaxy","LAFC","Minnesota United","CF Montréal",
      "Nashville SC","New England Revolution","New York City FC","New York Red Bulls",
      "Orlando City","Philadelphia Union","Portland Timbers","Real Salt Lake",
      "San Jose Earthquakes","Seattle Sounders","Sporting Kansas City",
      "St. Louis City SC","Toronto FC","Vancouver Whitecaps",
    ],
  },
  {
    label: "Premier League", sport: "Soccer",
    teams: [
      "Arsenal","Aston Villa","Bournemouth","Brentford","Brighton",
      "Chelsea","Crystal Palace","Everton","Fulham","Ipswich Town",
      "Leicester City","Liverpool","Manchester City","Manchester United",
      "Newcastle United","Nottingham Forest","Southampton","Tottenham Hotspur",
      "West Ham United","Wolverhampton Wanderers",
    ],
  },
  {
    label: "La Liga", sport: "Soccer",
    teams: [
      "Athletic Club","Atlético de Madrid","Barcelona","Celta Vigo","Deportivo Alavés",
      "Espanyol","Getafe","Girona","Las Palmas","Leganés",
      "Mallorca","Osasuna","Rayo Vallecano","Real Betis","Real Madrid",
      "Real Sociedad","Real Valladolid","Sevilla","Valencia","Villarreal",
    ],
  },
  {
    label: "Bundesliga", sport: "Soccer",
    teams: [
      "Bayer Leverkusen","Bayern Munich","Borussia Dortmund","Borussia Mönchengladbach",
      "Eintracht Frankfurt","Freiburg","Heidenheim","Hoffenheim","Holstein Kiel",
      "Mainz","RB Leipzig","St. Pauli","Stuttgart","Union Berlin",
      "Werder Bremen","Wolfsburg",
    ],
  },
  {
    label: "Serie A", sport: "Soccer",
    teams: [
      "AC Milan","Atalanta","Bologna","Como","Empoli","Fiorentina",
      "Genoa","Inter Milan","Juventus","Lazio","Lecce","Monza",
      "Napoli","Parma","Roma","Torino","Udinese","Venezia","Verona",
    ],
  },
  {
    label: "Ligue 1", sport: "Soccer",
    teams: [
      "Angers","AJ Auxerre","Lens","Lille","Lyon","Marseille",
      "Monaco","Montpellier","Nantes","Nice","PSG","Reims",
      "Rennes","Saint-Étienne","Strasbourg","Toulouse",
    ],
  },

  // ── Golf ───────────────────────────────────────────────────────────────────
  {
    label: "PGA Tour", sport: "Golf", teams: [],
  },
  {
    label: "LPGA Tour", sport: "Golf", teams: [],
  },

  // ── Tennis ─────────────────────────────────────────────────────────────────
  {
    label: "ATP Tour", sport: "Tennis", teams: [],
  },
  {
    label: "WTA Tour", sport: "Tennis", teams: [],
  },

  // ── Combat sports ──────────────────────────────────────────────────────────
  {
    label: "Ultimate Fighting Championship (UFC)", sport: "Mixed Martial Arts (MMA)", teams: [],
  },
  {
    label: "Boxing (Various)", sport: "Boxing", teams: [],
  },
  {
    label: "WWE", sport: "Wrestling", teams: [],
  },
  {
    label: "AEW", sport: "Wrestling", teams: [],
  },

  // ── Racing ─────────────────────────────────────────────────────────────────
  {
    label: "NASCAR Cup Series", sport: "NASCAR",
    teams: [
      "23XI Racing","Hendrick Motorsports","Joe Gibbs Racing","Kaulig Racing",
      "Petty GMS Motorsports","Richard Childress Racing","Stewart-Haas Racing",
      "Team Penske","Trackhouse Racing",
    ],
  },
  {
    label: "Formula 1", sport: "Racing",
    teams: [
      "Alpine","Aston Martin","Ferrari","Haas","McLaren","Mercedes",
      "RB (AlphaTauri)","Red Bull Racing","Sauber (Alfa Romeo)","Williams",
    ],
  },

  // ── College ────────────────────────────────────────────────────────────────
  {
    label: "NCAA Football", sport: "College Football", teams: [],
  },
  {
    label: "NCAA Basketball", sport: "College Basketball", teams: [],
  },
  {
    label: "NCAA Baseball", sport: "College Baseball", teams: [],
  },
];

// All sports that have leagues (for optgroup labels)
export const SPORTS = [...new Set(LEAGUES.map(l => l.sport))];

// Comprehensive sports list for the Sport dropdown on the eBay listing form.
// Includes all major team sports, individual sports, and collectible card games.
export const SPORT_LIST = [
  // ── Team sports ──────────────────────────────────────────────────────────
  "Baseball",
  "Basketball",
  "Football",
  "Ice Hockey",
  "Soccer",
  // ── Individual sports ────────────────────────────────────────────────────
  "Boxing",
  "Cricket",
  "Golf",
  "Lacrosse",
  "Mixed Martial Arts (MMA)",
  "Auto Racing",
  "Rugby League",
  "Rugby Union",
  "Skateboarding",
  "Surfing",
  "Swimming",
  "Tennis",
  "Athletics",
  "Volleyball",
  "Wrestling",
  // ── Combat sports ────────────────────────────────────────────────────────
  "Martial Arts",
  // ── Card & table games ───────────────────────────────────────────────────
  "Magic: The Gathering",
  "Pokémon",
  "Yu-Gi-Oh!",
  "Dragon Ball Super",
  "Flesh and Blood",
  "Lorcana",
  "One Piece",
  // ── Multi-sport & other ──────────────────────────────────────────────────
  "College Sports",
  "Olympics",
  "Multi-Sport",
  "Entertainment",
  "Other",
] as const;
