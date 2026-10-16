
"use strict";

/* ==========================================
   THE MUSIC ATLAS — CONNECTIONS
========================================== */

const LASTFM_API_KEY =
  "f331bbed64ed16ac2142346684f12e2c";

const AUDIODB_KEY = "123";

const LASTFM_URL =
  "https://ws.audioscrobbler.com/2.0/";

const AUDIODB_URL =
  `https://www.theaudiodb.com/api/v1/json/${AUDIODB_KEY}/`;

const MUSICBRAINZ_URL =
  "https://musicbrainz.org/ws/2/";

const $ = selector => document.querySelector(selector);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

const requestCache = new Map();
const profileCache = new Map();
const profileJobs = new Map();
const imageCache = new Map();

const PROFILE_CACHE_MS = 30 * 60 * 1000;
const FAILED_REQUEST_CACHE_MS = 30 * 1000;

let renderVersion = 0;
let rippleVersion = 0;
let callbackNumber = 0;
let trail = [];
let loadingScreen = null;

let musicBrainzQueue = Promise.resolve();
let nextMusicBrainzRequest = 0;

let audioDbQueue = Promise.resolve();
let nextAudioDbRequest = 0;

/* ==========================================
   UTILITIES
========================================== */

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalize(value) {
  return slug(value).replace(/-/g, "");
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

function cached(key, callback) {
  const existing = requestCache.get(key);

  if (existing) {
    if (!existing.expires || existing.expires > Date.now()) {
      return existing.promise;
    }

    requestCache.delete(key);
  }

  const entry = {
    promise: null,
    expires: 0
  };

  entry.promise = Promise.resolve()
    .then(callback)
    .catch(error => {
      // A short failure cache prevents repeated
      // immediate requests to an unavailable API.
      entry.expires = Date.now() + FAILED_REQUEST_CACHE_MS;
      throw error;
    });

  requestCache.set(key, entry);

  return entry.promise;
}

async function safe(callback, fallback = null) {
  try {
    return await callback();
  } catch (error) {
    console.info(
      "Music Atlas:",
      error?.message || error
    );

    return fallback;
  }
}

async function requestJSON(
  url,
  options = {},
  timeout = 8500
) {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeout
  );

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function cleanText(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\[[^\]]+\]/g, "")
    .replace(/Read more on Last\.fm.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(text, max = 180) {
  const value = cleanText(text);

  if (value.length <= max) return value;

  const fragment = value.slice(0, max);
  const lastSpace = fragment.lastIndexOf(" ");

  return fragment
    .slice(0, lastSpace > 0 ? lastSpace : max)
    .trim() + "…";
}

function usefulText(text, minimum = 45) {
  const value = cleanText(text);

  if (value.length < minimum) return "";

  if (
    /^(listen to|discover|explore) (the|this|a) (album|record)/i
      .test(value)
  ) {
    return "";
  }

  return value;
}

function albumSummary(text) {
  const value = usefulText(text);

  if (!value) return "";

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  let result = "";

  for (const sentence of sentences) {
    if ((result + sentence).length > 180) break;

    result += (result ? " " : "") + sentence;

    if (result.length >= 90) break;
  }

  return shorten(result || value, 175);
}

/* ==========================================
   CURATED ARTIST PROFILES

   Original editorial content preserved.
========================================== */

const PROFILES = {
  "david-bowie": {
    name: "David Bowie",
    genre: "ART ROCK · GLAM ROCK",
    bio: "A restless innovator who reshaped popular music through reinvention, theatricality, and experimentation.",
    albums: [
      ["Hunky Dory", 1971, "Piano-led songwriting, vivid characters, and some of Bowie's most enduring melodies."],
      ["Low", 1977, "Fragmented art rock, electronic textures, and atmospheric instrumentals make this a daring reinvention."],
      ["Let's Dance", 1983, "Funk rhythms, polished production, and irresistible pop hooks mark Bowie's dance-floor transformation."]
    ],
    past: ["Little Richard", "Jacques Brel", "Anthony Newley"],
    present: ["Brian Eno", "Iggy Pop", "Queen"],
    future: ["St. Vincent", "Janelle Monáe", "Christine and the Queens"]
  },

  "brian-eno": {
    name: "Brian Eno",
    genre: "AMBIENT · EXPERIMENTAL",
    bio: "A musician, producer, and sonic experimenter who helped define ambient music and expand the possibilities of the recording studio.",
    albums: [
      ["Here Come the Warm Jets", 1974, "Eccentric art rock filled with unusual guitar textures, playful vocals, and studio experimentation."],
      ["Another Green World", 1975, "A remarkable meeting of miniature pop songs, ambient passages, and luminous instrumental textures."],
      ["Ambient 1: Music for Airports", 1978, "Slowly unfolding instrumental pieces designed to transform the atmosphere around the listener."]
    ],
    past: ["John Cage", "La Monte Young", "Steve Reich"],
    present: ["David Bowie", "Talking Heads", "Roxy Music"],
    future: ["Aphex Twin", "The Orb", "Jon Hopkins"]
  },

  "talking-heads": {
    name: "Talking Heads",
    genre: "NEW WAVE · ART ROCK",
    bio: "A New York band that blended angular rock, dance rhythms, and adventurous production into a singularly inventive sound.",
    albums: [
      ["Fear of Music", 1979, "Nervy rhythms, sharp guitars, and restless songwriting push new wave into stranger territory."],
      ["Remain in Light", 1980, "Interlocking rhythms, funk influences, and layered studio experiments create a hypnotic sound."],
      ["Speaking in Tongues", 1983, "Playful grooves, art-rock eccentricity, and some of the band's most irresistible songs."]
    ],
    past: ["James Brown", "Fela Kuti", "Parliament-Funkadelic"],
    present: ["Brian Eno", "Blondie", "Devo"],
    future: ["LCD Soundsystem", "Vampire Weekend", "Tune-Yards"]
  },

  "kate-bush": {
    name: "Kate Bush",
    genre: "ART POP · ART ROCK",
    bio: "An English singer-songwriter whose theatrical performances, adventurous production, and imaginative songs helped expand the possibilities of art pop.",
    albums: [
      ["The Dreaming", 1982, "An audacious experiment in vocal performance, sampling, unusual rhythms, and theatrical songwriting."],
      ["Hounds of Love", 1985, "Immediate pop melodies meet ambitious storytelling and atmospheric production."],
      ["The Sensual World", 1989, "Lush arrangements, expressive vocals, and emotionally rich songs with a cinematic feel."]
    ],
    past: ["David Bowie", "Elton John", "Pink Floyd"],
    present: ["Peter Gabriel", "David Gilmour", "Roy Harper"],
    future: ["Tori Amos", "Björk", "Florence + the Machine"]
  },

  "lcd-soundsystem": {
    name: "LCD Soundsystem",
    genre: "DANCE-PUNK · ELECTRONIC",
    bio: "James Murphy's New York project combines punk urgency, dance-floor pulse, and emotionally resonant songwriting.",
    albums: [
      ["LCD Soundsystem", 2005, "Wry lyrics, driving rhythms, and an exhilarating meeting of punk attitude and dance music."],
      ["Sound of Silver", 2007, "Pulsing electronic grooves meet sharp observations about friendship, aging, and nightlife."],
      ["This Is Happening", 2010, "Long-form dance-rock builds, emotional honesty, and meticulously arranged electronic textures."]
    ],
    past: ["Talking Heads", "New Order", "David Bowie"],
    present: ["Hot Chip", "The Rapture", "Yeah Yeah Yeahs"],
    future: ["Nation of Language", "Overmono", "Confidence Man"]
  },

  "tegan-and-sara": {
    name: "Tegan and Sara",
    genre: "INDIE ROCK · INDIE POP",
    bio: "Canadian twin sisters whose emotionally direct songwriting evolved from guitar-driven indie rock into polished, synth-led pop.",
    albums: [
      ["So Jealous", 2004, "Raw emotion, sharp guitar hooks, and tightly wound indie-rock songwriting make every chorus feel immediate."],
      ["The Con", 2007, "A darker, more intricate record where intimate lyrics meet unusual arrangements and restless melodies."],
      ["Heartthrob", 2013, "A bold transformation into shimmering synthesizers, expansive choruses, and confident electronic pop."]
    ],
    past: ["The Smashing Pumpkins", "Ani DiFranco", "The Cure"],
    present: ["Rilo Kiley", "Stars", "Paramore"],
    future: ["MUNA", "CHVRCHES", "The Aces"]
  },

  "coheed-and-cambria": {
    name: "Coheed and Cambria",
    genre: "PROGRESSIVE ROCK · POST-HARDCORE",
    bio: "An American progressive rock band known for soaring melodies, intricate arrangements, and a science-fiction narrative spanning much of their discography.",
    albums: [
      ["The Second Stage Turbine Blade", 2002, "Urgent post-hardcore energy meets intricate guitars, unusual song structures, and ambitious storytelling."],
      ["In Keeping Secrets of Silent Earth: 3", 2003, "Towering choruses, elaborate guitar passages, and cinematic science-fiction storytelling."],
      ["Good Apollo, I'm Burning Star IV, Volume One: From Fear Through the Eyes of Madness", 2005, "A theatrical, guitar-driven epic combining progressive ambition with soaring alternative-rock melodies."]
    ],
    past: ["Rush", "Pink Floyd", "At the Drive-In"],
    present: ["The Mars Volta", "Circa Survive", "The Dear Hunter"],
    future: ["Thank You Scientist", "Hail the Sun", "Closure in Moscow"]
  },

  "foxy-shazam": {
    name: "Foxy Shazam",
    genre: "GLAM ROCK · ALTERNATIVE ROCK",
    bio: "A Cincinnati rock band whose flamboyant performances combine theatrical vocals, glam-rock excess, soul influences, and unpredictable arrangements.",
    albums: [
      ["Introducing", 2008, "Wildly theatrical rock driven by dramatic vocals, frantic arrangements, and unpredictable energy."],
      ["Foxy Shazam", 2010, "Explosive glam-rock showmanship, piano-driven hooks, and enormous, celebratory choruses."],
      ["The Church of Rock and Roll", 2012, "Classic-rock swagger, soul influences, and exuberant theatrical performances."]
    ],
    past: ["Queen", "Meat Loaf", "Little Richard"],
    present: ["The Darkness", "The Dear Hunter", "Panic! at the Disco"],
    future: ["The Struts", "Greta Van Fleet", "Jellyfish"]
  }
};

function curatedProfile(key) {
  const profile = PROFILES[key];

  if (!profile) return null;

  return {
    ...profile,
    image: null,
    albums: profile.albums.map(album => ({
      title: album[0],
      year: album[1],
      why: album[2],
      image: null
    })),
    past: [...profile.past],
    present: [...profile.present],
    future: [...profile.future]
  };
}

/* ==========================================
   THEAUDIODB

   Request spacing remains unchanged to
   respect the external service.
========================================== */

function audioDb(endpoint, params = {}) {
  const key = `audiodb:${endpoint}:${JSON.stringify(params)}`;

  return cached(key, async () => {
    const url = new URL(endpoint, AUDIODB_URL);

    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }

    const job = audioDbQueue
      .catch(() => {})
      .then(async () => {
        const remaining = Math.max(
          0,
          nextAudioDbRequest - Date.now()
        );

        if (remaining) await pause(remaining);

        nextAudioDbRequest = Date.now() + 2100;

        return requestJSON(url.toString());
      });

    audioDbQueue = job.catch(() => {});

    return job;
  });
}

async function getAudioDbArtist(name) {
  const data = await audioDb("search.php", { s: name });

  return (data.artists || []).find(artist =>
    normalize(artist.strArtist) === normalize(name)
  ) || null;
}

async function getAudioDbAlbums(name) {
  const data = await audioDb("searchalbum.php", { s: name });

  return (data.album || []).filter(album =>
    normalize(album.strArtist) === normalize(name)
  );
}

function findAudioDbAlbum(albums, title) {
  return albums.find(album =>
    normalize(album.strAlbum) === normalize(title)
  ) || null;
}

function audioDbAlbumImage(album) {
  return (
    album?.strAlbumThumbHQ ||
    album?.strAlbumThumb ||
    null
  );
}

/* ==========================================
   LAST.FM
========================================== */

function lastfm(method, params = {}) {
  const key = `lastfm:${method}:${JSON.stringify(params)}`;

  return cached(key, async () => {
    if (
      !LASTFM_API_KEY ||
      LASTFM_API_KEY ===
        "PASTE_YOUR_EXISTING_LASTFM_API_KEY_HERE"
    ) {
      throw new Error("Add your existing Last.fm API key.");
    }

    const url = new URL(LASTFM_URL);

    url.searchParams.set("method", method);
    url.searchParams.set("api_key", LASTFM_API_KEY);
    url.searchParams.set("format", "json");

    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }

    const data = await requestJSON(url.toString());

    if (data.error) {
      throw new Error(data.message || "Last.fm unavailable");
    }

    return data;
  });
}

async function getLastfmArtist(name) {
  const data = await lastfm("artist.getInfo", {
    artist: name,
    autocorrect: 1
  });

  return data.artist || null;
}

async function getSimilarArtists(name) {
  const data = await lastfm("artist.getSimilar", {
    artist: name,
    autocorrect: 1,
    limit: 50
  });

  return (data.similarartists?.artist || [])
    .filter(item => item.name)
    .map(item => ({
      name: item.name,
      match: Number(item.match) || 0
    }))
    .sort((a, b) => b.match - a.match);
}

async function getTopAlbums(name) {
  const data = await lastfm("artist.getTopAlbums", {
    artist: name,
    autocorrect: 1,
    limit: 80
  });

  return (data.topalbums?.album || [])
    .filter(item => item.name)
    .filter(item =>
      !/\b(deluxe|remaster|bonus|anniversary|single|expanded edition)\b/i
        .test(item.name)
    )
    .map(item => ({
      title: item.name,
      playcount: Number(item.playcount) || 0
    }));
}

async function getLastfmAlbum(artist, album) {
  const data = await lastfm("album.getInfo", {
    artist,
    album,
    autocorrect: 1
  });

  return data.album || null;
}

/* ==========================================
   MUSICBRAINZ

   Important: We retain the original
   request spacing and full candidate
   verification for recommendation quality.
========================================== */

function musicBrainz(path) {
  return cached(`mb:${path}`, async () => {
    const job = musicBrainzQueue
      .catch(() => {})
      .then(async () => {
        const remaining = Math.max(
          0,
          nextMusicBrainzRequest - Date.now()
        );

        if (remaining) await pause(remaining);

        nextMusicBrainzRequest = Date.now() + 1200;

        return requestJSON(
          `${MUSICBRAINZ_URL}${path}`,
          {
            headers: {
              Accept: "application/json"
            }
          },
          10000
        );
      });

    musicBrainzQueue = job.catch(() => {});

    return job;
  });
}

async function findMusicBrainzArtist(name) {
  const query = encodeURIComponent(
    `artist:"${name.replace(/"/g, "")}"`
  );

  const data = await musicBrainz(
    `artist/?query=${query}&fmt=json&limit=15`
  );

  return (data.artists || []).find(artist =>
    normalize(artist.name) === normalize(name)
  ) || null;
}

async function getMusicBrainzAlbums(id) {
  const data = await musicBrainz(
    `release-group/?artist=${encodeURIComponent(id)}` +
    "&type=album&limit=100&fmt=json"
  );

  const albums = new Map();

  for (const item of data["release-groups"] || []) {
    if (item["primary-type"] !== "Album") continue;

    if (
      (item["secondary-types"] || []).some(type =>
        ["Compilation", "Live", "Remix", "DJ-mix"].includes(type)
      )
    ) {
      continue;
    }

    const key = normalize(item.title);

    if (!key || albums.has(key)) continue;

    albums.set(key, {
      title: item.title,
      year: item["first-release-date"]?.slice(0, 4) || "",
      mbid: item.id
    });
  }

  return [...albums.values()];
}

async function getMusicBrainzRelationships(id) {
  const data = await musicBrainz(
    `artist/${encodeURIComponent(id)}` +
    "?inc=artist-rels&fmt=json"
  );

  const results = [];
  const seen = new Set();

  const allowedTypes = new Set([
    "collaboration",
    "producer",
    "remixer"
  ]);

  for (const relation of data.relations || []) {
    const artist = relation.artist;

    if (!artist?.name) continue;
    if (!allowedTypes.has(relation.type)) continue;

    // Preserve the existing group-only
    // relationship filtering.
    if (artist.type !== "Group") continue;

    const key = normalize(artist.name);

    if (seen.has(key)) continue;

    seen.add(key);
    results.push(artist.name);
  }

  return results;
}

/* ==========================================
   WIKIPEDIA
========================================== */

function wikipediaExtract(title) {
  return cached(
    `wikipedia:${normalize(title)}`,
    async () => {
      const url = new URL(
        "https://en.wikipedia.org/w/api.php"
      );

      url.searchParams.set("action", "query");
      url.searchParams.set("prop", "extracts");
      url.searchParams.set("exintro", "1");
      url.searchParams.set("explaintext", "1");
      url.searchParams.set("redirects", "1");
      url.searchParams.set("titles", title);
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");

      const data = await requestJSON(
        url.toString(),
        {},
        7000
      );

      const page = Object.values(
        data.query?.pages || {}
      )[0];

      if (!page || page.missing !== undefined) {
        return null;
      }

      return {
        title: page.title,
        text: cleanText(page.extract)
      };
    }
  );
}

/* ==========================================
   ARTIST BIOGRAPHY
========================================== */

async function artistBiography(
  name,
  audioArtist,
  lastfmArtist
) {
  const audioBio = usefulText(
    audioArtist?.strBiographyEN ||
    audioArtist?.strBiography,
    65
  );

  if (audioBio) return shorten(audioBio, 290);

  const wiki = await safe(
    () => wikipediaExtract(name)
  );

  if (
    wiki &&
    normalize(wiki.title) === normalize(name) &&
    wiki.text.length >= 65
  ) {
    return shorten(wiki.text, 290);
  }

  const lastfmBio = usefulText(
    lastfmArtist?.bio?.summary,
    65
  );

  if (lastfmBio) return shorten(lastfmBio, 290);

  return `Explore the music and connections of ${name}.`;
}

/* ==========================================
   ALBUM DESCRIPTIONS
========================================== */

async function albumDescription(
  artist,
  album,
  audioAlbums
) {
  const audioMatch = findAudioDbAlbum(
    audioAlbums,
    album.title
  );

  const audioDescription = albumSummary(
    audioMatch?.strDescriptionEN ||
    audioMatch?.strDescription
  );

  if (audioDescription) return audioDescription;

  const lastfmAlbum = await safe(
    () => getLastfmAlbum(artist, album.title)
  );

  const lastfmDescription = albumSummary(
    lastfmAlbum?.wiki?.summary
  );

  if (lastfmDescription) return lastfmDescription;

  const wiki = await safe(
    () => wikipediaExtract(
      `${album.title} (${artist} album)`
    )
  );

  if (
    wiki &&
    wiki.text.length >= 55 &&
    normalize(wiki.title).includes(normalize(album.title))
  ) {
    return albumSummary(wiki.text);
  }

  return "";
}

/* ==========================================
   SELECT THREE ALBUMS

   Selection order remains unchanged.
========================================== */

function selectAlbums(
  topAlbums,
  verifiedAlbums,
  audioAlbums
) {
  const results = [];
  const seen = new Set();

  const verified = new Map(
    verifiedAlbums.map(album => [
      normalize(album.title),
      album
    ])
  );

  function add(album) {
    if (results.length >= 3) return;

    const key = normalize(album.title);

    if (!key || seen.has(key)) return;

    seen.add(key);

    const audio = findAudioDbAlbum(
      audioAlbums,
      album.title
    );

    results.push({
      title: album.title,
      year: album.year || audio?.intYearReleased || "",
      why: "",
      image: audioDbAlbumImage(audio)
    });
  }

  for (const album of topAlbums) {
    const match = verified.get(normalize(album.title));

    if (match) add(match);
    if (results.length === 3) break;
  }

  for (const album of verifiedAlbums) {
    add(album);
    if (results.length === 3) break;
  }

  if (results.length < 3) {
    for (const album of audioAlbums) {
      add({
        title: album.strAlbum,
        year: album.intYearReleased
      });

      if (results.length === 3) break;
    }
  }

  if (results.length < 3) {
    for (const album of topAlbums) {
      add(album);
      if (results.length === 3) break;
    }
  }

  return results;
}

/* ==========================================
   ARTIST CONNECTION DISCOVERY

   Original 24-candidate algorithm preserved.
========================================== */

function artistStartYear(artist) {
  const date = artist?.["life-span"]?.begin || "";
  const year = Number(date.slice(0, 4));

  return year >= 1850 && year <= 2100
    ? year
    : null;
}

function reverseEditorialLinks(name) {
  const result = {
    past: [],
    present: [],
    future: []
  };

  const key = normalize(name);

  for (const profile of Object.values(PROFILES)) {
    if (normalize(profile.name) === key) continue;

    const mappings = [
      ["past", "future"],
      ["present", "present"],
      ["future", "past"]
    ];

    for (const [source, destination] of mappings) {
      if (
        profile[source].some(
          artist => normalize(artist) === key
        )
      ) {
        result[destination].push(profile.name);
      }
    }
  }

  return result;
}

async function buildConnections(
  name,
  similar,
  documented,
  mbArtist
) {
  const result = reverseEditorialLinks(name);

  const seen = new Set([
    normalize(name),
    ...Object.values(result).flat().map(normalize)
  ]);

  function add(column, artist) {
    const key = normalize(artist);

    if (!key || seen.has(key)) return false;
    if (result[column].length >= 3) return false;

    seen.add(key);
    result[column].push(artist);

    return true;
  }

  for (const artist of documented) {
    add("present", artist);
  }

  const sourceYear = artistStartYear(mbArtist);

  // Do not reduce this number:
  // these checks preserve recommendation quality.
  const candidates = similar
    .filter(item =>
      item.name &&
      item.match > 0 &&
      !seen.has(normalize(item.name))
    )
    .slice(0, 24);

  const enriched = await Promise.all(
    candidates.map(async candidate => {
      const mb = await safe(
        () => findMusicBrainzArtist(candidate.name)
      );

      return {
        name: candidate.name,
        year: artistStartYear(mb),
        type: mb?.type || null,
        match: candidate.match
      };
    })
  );

  const filtered = enriched.filter(candidate => {
    if (!candidate.type) return false;

    if (
      mbArtist?.type === "Group" &&
      candidate.type === "Person"
    ) {
      return false;
    }

    return (
      candidate.type === "Group" ||
      candidate.type === "Person"
    );
  });

  // Earlier artists.
  for (const candidate of filtered) {
    if (!sourceYear || !candidate.year) continue;

    if (candidate.year <= sourceYear - 5) {
      add("past", candidate.name);
    }
  }

  // Contemporary artists.
  for (const candidate of filtered) {
    if (result.present.length >= 3) break;

    if (
      sourceYear &&
      candidate.year &&
      Math.abs(candidate.year - sourceYear) <= 8
    ) {
      add("present", candidate.name);
    }
  }

  // Later artists.
  for (const candidate of filtered) {
    if (!sourceYear || !candidate.year) continue;

    if (candidate.year >= sourceYear + 5) {
      add("future", candidate.name);
    }
  }

  // Fill earlier column.
  for (const candidate of filtered) {
    if (result.past.length >= 3) break;

    if (
      sourceYear &&
      candidate.year &&
      candidate.year > sourceYear
    ) {
      continue;
    }

    add("past", candidate.name);
  }

  // Fill contemporary column.
  for (const candidate of filtered) {
    if (result.present.length >= 3) break;

    add("present", candidate.name);
  }

  // Fill later column.
  for (const candidate of filtered) {
    if (result.future.length >= 3) break;

    if (
      sourceYear &&
      candidate.year &&
      candidate.year < sourceYear
    ) {
      continue;
    }

    add("future", candidate.name);
  }

  return result;
}

/* ==========================================
   LIVE PROFILE — OPTIMIZED

   Main content and discovery connections
   are prepared independently.

   The page can display the biography
   and albums while MusicBrainz continues
   verifying the recommendations.
========================================== */

async function fetchLiveProfile(name, onPreview = null) {
  const [
    mbArtist,
    lastfmArtist,
    audioArtist
  ] = await Promise.all([
    safe(() => findMusicBrainzArtist(name)),
    safe(() => getLastfmArtist(name)),
    safe(() => getAudioDbArtist(name))
  ]);

  if (!mbArtist && !lastfmArtist && !audioArtist) {
    return null;
  }

  const realName =
    mbArtist?.name ||
    audioArtist?.strArtist ||
    lastfmArtist?.name ||
    name;

  const [
    similar,
    topAlbums,
    verifiedAlbums,
    audioAlbums,
    documented
  ] = await Promise.all([
    safe(() => getSimilarArtists(realName), []),
    safe(() => getTopAlbums(realName), []),

    mbArtist?.id
      ? safe(() => getMusicBrainzAlbums(mbArtist.id), [])
      : Promise.resolve([]),

    safe(() => getAudioDbAlbums(realName), []),

    mbArtist?.id
      ? safe(() => getMusicBrainzRelationships(mbArtist.id), [])
      : Promise.resolve([])
  ]);

  const genre =
    [
      audioArtist?.strGenre,
      audioArtist?.strStyle
    ]
      .filter(Boolean)
      .slice(0, 2)
      .join(" · ")
      .toUpperCase() ||
    (lastfmArtist?.tags?.tag || [])
      .slice(0, 2)
      .map(tag => tag.name.toUpperCase())
      .join(" · ") ||
    "ARTIST DISCOVERY";

  const albums = selectAlbums(
    topAlbums,
    verifiedAlbums,
    audioAlbums
  );

  // Start the full recommendation algorithm now.
  // It runs while biography and album information
  // are being prepared.
  const connectionsJob = buildConnections(
    realName,
    similar,
    documented,
    mbArtist
  );

  const [bio, descriptions] = await Promise.all([
    artistBiography(
      realName,
      audioArtist,
      lastfmArtist
    ),

    Promise.all(
      albums.map(album =>
        albumDescription(
          realName,
          album,
          audioAlbums
        )
      )
    )
  ]);

  albums.forEach((album, index) => {
    album.why = descriptions[index] || "";
  });

  const baseProfile = {
    name: realName,
    genre,
    bio,
    image:
      audioArtist?.strArtistThumb ||
      audioArtist?.strArtistFanart ||
      null,
    albums,
    past: [],
    present: [],
    future: []
  };

  // Display the finished biography and albums
  // without waiting for all 24 artist checks.
  if (typeof onPreview === "function") {
    onPreview(baseProfile);
  }

  const connections = await connectionsJob;

  return {
    ...baseProfile,
    ...connections
  };
}

/* ==========================================
   COMPLETE PROFILE CACHE

   This is separate from individual API
   response caching.

   Revisit an artist:
   - No new discovery calculations
   - No new album selection
   - No repeated biography assembly

   Cache lasts 30 minutes per page session.
========================================== */

function getCachedProfile(key) {
  const entry = profileCache.get(key);

  if (!entry) return null;

  if (entry.expires <= Date.now()) {
    profileCache.delete(key);
    return null;
  }

  return entry.profile;
}

async function getLiveProfile(
  name,
  onPreview = null
) {
  const key = normalize(name);

  const existing = getCachedProfile(key);

  if (existing) {
    return existing;
  }

  if (profileJobs.has(key)) {
    return profileJobs.get(key);
  }

  const job = fetchLiveProfile(name, onPreview)
    .then(profile => {
      if (profile) {
        profileCache.set(key, {
          profile,
          expires: Date.now() + PROFILE_CACHE_MS
        });

        // Reuse the result under the canonical
        // artist name as well.
        profileCache.set(normalize(profile.name), {
          profile,
          expires: Date.now() + PROFILE_CACHE_MS
        });
      }

      return profile;
    })
    .finally(() => {
      profileJobs.delete(key);
    });

  profileJobs.set(key, job);

  return job;
}

/* ==========================================
   DEEZER ARTWORK LOOKUP
========================================== */

function deezer(url) {
  return new Promise((resolve, reject) => {
    const callback =
      `atlas_callback_${++callbackNumber}`;

    const script = document.createElement("script");

    let finished = false;

    const timer = setTimeout(() => {
      finish(new Error("Artwork lookup timed out"));
    }, 6500);

    function finish(error, data) {
      if (finished) return;

      finished = true;

      clearTimeout(timer);
      script.remove();
      delete window[callback];

      if (error) reject(error);
      else resolve(data);
    }

    window[callback] = data => finish(null, data);

    script.onerror = () =>
      finish(new Error("Artwork unavailable"));

    script.src =
      `${url}${url.includes("?") ? "&" : "?"}` +
      `output=jsonp&callback=${callback}`;

    document.head.appendChild(script);
  });
}

function findArtistPhoto(name) {
  return cached(
    `portrait:${normalize(name)}`,
    async () => {
      const data = await deezer(
        "https://api.deezer.com/search/artist" +
        `?q=${encodeURIComponent(name)}&limit=25`
      );

      const artists = (data.data || [])
        .filter(item =>
          normalize(item.name) === normalize(name)
        )
        .sort(
          (a, b) =>
            (b.nb_fan || 0) - (a.nb_fan || 0)
        );

      return (
        artists[0]?.picture_xl ||
        artists[0]?.picture_big ||
        null
      );
    }
  );
}

function findAlbumCover(artist, album) {
  return cached(
    `cover:${normalize(artist)}:${normalize(album)}`,
    async () => {
      const query = encodeURIComponent(
        `${artist} ${album}`
      );

      const data = await safe(() =>
        requestJSON(
          "https://itunes.apple.com/search" +
          `?term=${query}&entity=album&limit=100`,
          {},
          7000
        )
      );

      const match = (data?.results || []).find(item =>
        normalize(item.artistName) === normalize(artist) &&
        normalize(item.collectionName)
          .startsWith(normalize(album))
      );

      if (match?.artworkUrl100) {
        return match.artworkUrl100.replace(
          /100x100(?:bb)?/,
          "600x600bb"
        );
      }

      const deezerData = await safe(() =>
        deezer(
          "https://api.deezer.com/search/album" +
          `?q=${query}&limit=100`
        )
      );

      const deezerMatch = (
        deezerData?.data || []
      ).find(item =>
        normalize(item.artist?.name) === normalize(artist) &&
        normalize(item.title).startsWith(normalize(album))
      );

      return (
        deezerMatch?.cover_xl ||
        deezerMatch?.cover_big ||
        null
      );
    }
  );
}

/* ==========================================
   IMAGE LOADING — OPTIMIZED

   Validated images are cached.

   A URL is no longer validated twice
   during the same loading operation.
========================================== */

function verifyImage(url) {
  if (!url) return Promise.resolve(false);

  if (imageCache.has(url)) {
    return imageCache.get(url);
  }

  const job = new Promise(resolve => {
    const image = new Image();

    let finished = false;

    const timer = setTimeout(
      () => finish(false),
      6500
    );

    function finish(success) {
      if (finished) return;

      finished = true;
      clearTimeout(timer);

      resolve(success);
    }

    image.onload = () =>
      finish(image.naturalWidth > 0);

    image.onerror = () => finish(false);

    image.src = url;
  });

  imageCache.set(url, job);

  return job;
}

function loadImage(
  image,
  fallback,
  preferred,
  lookup,
  version
) {
  image.hidden = true;
  fallback.hidden = false;
  image.removeAttribute("src");

  (async () => {
    let url = preferred;

    if (!url || !(await verifyImage(url))) {
      url = await safe(lookup);
    }

    if (!url || !(await verifyImage(url))) {
      return;
    }

    if (
      version !== renderVersion ||
      !image.isConnected
    ) {
      return;
    }

    image.src = url;
    image.hidden = false;
    fallback.hidden = true;
  })();
}

/* ==========================================
   RENDER ALBUMS
========================================== */

function renderAlbums(profile, version) {
  const root = $("#albums");

  root.replaceChildren();

  for (const album of profile.albums || []) {
    const card = makeElement("article", "album");
    const artwork = makeElement("div", "album-art");

    const fallback = makeElement(
      "span",
      "album-fallback",
      album.title
    );

    const image = document.createElement("img");

    image.alt = `${album.title} album cover`;
    image.hidden = true;

    artwork.append(fallback, image);

    const title = makeElement(
      "p",
      "album-title",
      `${album.title} `
    );

    title.append(
      makeElement(
        "span",
        "album-year",
        String(album.year || "")
      )
    );

    const description = makeElement(
      "p",
      "album-description",
      album.why || ""
    );

    card.append(artwork, title, description);
    root.append(card);

    loadImage(
      image,
      fallback,
      album.image,
      () => findAlbumCover(profile.name, album.title),
      version
    );
  }
}

/* ==========================================
   RENDER CONNECTIONS

   Clean, clickable names only.
   No description API requests.
========================================== */

function renderConnections(profile, version) {
  const root = $("#connections-grid");

  root.replaceChildren();

  const columns = [
    ["past", "What Shaped Them"],
    ["present", "Their Musical World"],
    ["future", "Where the Sound Went Next"]
  ];

  for (const [key, title] of columns) {
    const group = makeElement(
      "section",
      "connection-group"
    );

    const heading = makeElement(
      "h3",
      "group-title",
      title
    );

    heading.append(
      makeElement("span", "blue-dot", ".")
    );

    group.append(heading);

    for (const name of profile[key] || []) {
      const button = makeElement(
        "button",
        "connection"
      );

      button.type = "button";

      button.append(
        makeElement(
          "span",
          "connection-name",
          name
        )
      );

      button.addEventListener(
        "click",
        () => navigate(slug(name), name)
      );

      group.append(button);
    }

    root.append(group);
  }
}

/* ==========================================
   DISCOVERY TRAIL
========================================== */

function renderTrail() {
  const root = $("#discovery-trail");

  root.replaceChildren();

  trail.forEach((entry, index) => {
    if (index > 0) {
      root.append(
        makeElement(
          "span",
          "trail-separator",
          "·"
        )
      );
    }

    const button = makeElement(
      "button",
      "trail-step",
      entry.name
    );

    button.type = "button";

    if (index === trail.length - 1) {
      button.setAttribute(
        "aria-current",
        "page"
      );
    }

    button.addEventListener("click", () => {
      trail = trail.slice(0, index + 1);
      render(entry.key);
    });

    root.append(button);
  });

  root.scrollLeft = root.scrollWidth;
}

/* ==========================================
   SHOW PROFILE

   Optional preview mode:
   Biography and albums appear first.
   Connections follow when verified.

   No change to recommendation selection.
========================================== */

function showProfile(
  key,
  profile,
  version,
  preview = false
) {
  if (version !== renderVersion) return;

  const name =
    profile.name ||
    trail[trail.length - 1]?.name ||
    key;

  if (trail.length) {
    trail[trail.length - 1].name = name;
  }

  $("#artist-name").textContent = name;

  $("#artist-genre").textContent =
    profile.genre || "ARTIST DISCOVERY";

  $("#artist-bio").textContent =
    profile.bio || "";

  const portrait = $("#artist-photo");

  portrait.alt = `${name} portrait`;

  // Avoid restarting the artwork search when
  // only the connection columns are updated.
  if (!preview) {
    if (portrait.dataset.artistKey !== normalize(name)) {
      portrait.dataset.artistKey = normalize(name);

      loadImage(
        portrait,
        $("#portrait-fallback"),
        profile.image,
        () => findArtistPhoto(name),
        version
      );
    }
  } else {
    portrait.dataset.artistKey = normalize(name);

    loadImage(
      portrait,
      $("#portrait-fallback"),
      profile.image,
      () => findArtistPhoto(name),
      version
    );
  }

  if (preview) {
    renderAlbums(profile, version);
    $("#connections-grid").replaceChildren();
  } else {
    // The preview already displayed the albums.
    // Don't recreate them unless this is a
    // direct full-profile render.
    if (
      !$("#albums").children.length ||
      $("#albums").dataset.artistKey !== normalize(name)
    ) {
      renderAlbums(profile, version);
    }

    renderConnections(profile, version);
  }

  $("#albums").dataset.artistKey = normalize(name);

  renderTrail();

  document.title = `${name} — The Music Atlas`;
}

/* ==========================================
   WATER RIPPLE
========================================== */

function initializeRipple() {
  loadingScreen = document.createElement("div");

  loadingScreen.className = "loading-screen";
  loadingScreen.id = "loading-screen";

  loadingScreen.setAttribute("role", "status");
  loadingScreen.setAttribute(
    "aria-label",
    "Loading artist information"
  );

  loadingScreen.hidden = true;

  loadingScreen.innerHTML = `
    <div class="water-ripple" aria-hidden="true">
      <span class="ripple-ring"></span>
      <span class="ripple-ring"></span>
      <span class="ripple-ring"></span>
      <span class="ripple-ring"></span>
      <span class="ripple-center"></span>
    </div>
  `;

  const header = $(".site-header");

  if (header) {
    header.insertAdjacentElement(
      "afterend",
      loadingScreen
    );
  } else {
    document.body.prepend(loadingScreen);
  }

  window.addEventListener(
    "resize",
    positionRipple
  );
}

function positionRipple() {
  if (!loadingScreen) return;

  const header = $(".site-header");

  const bottom = header
    ? header.getBoundingClientRect().bottom
    : 0;

  loadingScreen.style.top =
    `${Math.max(0, bottom)}px`;
}

function showRipple() {
  if (!loadingScreen) return;

  if (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  ) {
    return;
  }

  positionRipple();

  loadingScreen.classList.remove("is-fading");
  loadingScreen.hidden = false;

  loadingScreen
    .querySelectorAll(".ripple-ring")
    .forEach(ring => {
      ring.style.animation = "none";
      void ring.offsetWidth;
      ring.style.animation = "";
    });
}

async function hideRipple(version) {
  if (!loadingScreen) return;
  if (version !== rippleVersion) return;

  loadingScreen.classList.add("is-fading");

  await pause(600);

  if (version !== rippleVersion) return;

  loadingScreen.hidden = true;
  loadingScreen.classList.remove("is-fading");
}

/* ==========================================
   LOAD ARTIST — OPTIMIZED

   Cached profiles display immediately.

   New artists:
   1. Resolve artist information.
   2. Display biography and albums.
   3. Finish full recommendation checks.
   4. Display verified connections.

   No candidate checks are skipped.
========================================== */

async function render(key) {
  const version = ++renderVersion;
  const transition = ++rippleVersion;
  const started = Date.now();

  const url = new URL(window.location.href);

  url.searchParams.set("artist", key);

  history.replaceState(
    { artist: key },
    "",
    url
  );

  // Clear old artist identity so image loading
  // is not accidentally reused for a new page.
  const portrait = $("#artist-photo");
  portrait.dataset.artistKey = "";

  $("#albums").dataset.artistKey = "";

  showRipple();

  try {
    const curated = curatedProfile(key);

    if (curated) {
      showProfile(key, curated, version);
      return;
    }

    const name =
      trail[trail.length - 1]?.name ||
      key.replace(/-/g, " ");

    // Complete profile cache is checked first.
    const existing = getCachedProfile(normalize(name));

    if (existing) {
      showProfile(key, existing, version);
      return;
    }

    $("#artist-name").textContent = name;
    $("#artist-genre").textContent = "DISCOVERING";
    $("#artist-bio").textContent = "";

    portrait.hidden = true;
    $("#portrait-fallback").hidden = false;

    $("#albums").replaceChildren();
    $("#connections-grid").replaceChildren();

    renderTrail();

    let previewDisplayed = false;

    const profile = await getLiveProfile(
      name,
      preview => {
        if (version !== renderVersion) return;

        previewDisplayed = true;

        showProfile(
          key,
          preview,
          version,
          true
        );
      }
    );

    if (version !== renderVersion) return;

    if (!profile) {
      $("#artist-genre").textContent =
        "ARTIST SEARCH";

      $("#artist-bio").textContent =
        "We couldn't find reliable information for that artist. Try another spelling.";

      return;
    }

    if (previewDisplayed) {
      // Albums and portrait are already visible.
      // Only add the fully verified connections.
      renderConnections(profile, version);
      renderTrail();
    } else {
      showProfile(key, profile, version);
    }

  } catch (error) {
    if (version !== renderVersion) return;

    console.error(
      "Music Atlas discovery error:",
      error
    );

    $("#artist-genre").textContent =
      "ARTIST SEARCH";

    $("#artist-bio").textContent =
      "The music services are temporarily unavailable. Please try again.";

  } finally {
    if (transition === rippleVersion) {
      const elapsed = Date.now() - started;

      if (elapsed < 700) {
        await pause(700 - elapsed);
      }

      await hideRipple(transition);
    }
  }
}

/* ==========================================
   NAVIGATION
========================================== */

function navigate(key, name) {
  if (!key) return;

  trail.push({
    key,
    name:
      name ||
      PROFILES[key]?.name ||
      key
  });

  render(key);
}

/* ==========================================
   SEARCH
========================================== */

$("#discovery-search").addEventListener(
  "submit",
  event => {
    event.preventDefault();

    const input = $("#artist-search");
    const query = input.value.trim();

    if (!query) return;

    trail = [];

    navigate(slug(query), query);

    input.value = "";
    input.blur();
  }
);

/* ==========================================
   START OVER
========================================== */

$("#reset-trail").addEventListener(
  "click",
  () => {
    trail = [];
    navigate("david-bowie", "David Bowie");
  }
);

/* ==========================================
   INITIALIZE
========================================== */

initializeRipple();

const requested =
  new URLSearchParams(
    window.location.search
  ).get("artist") || "David Bowie";

navigate(slug(requested), requested);
