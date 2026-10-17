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

/* ==========================================
   SMART ALBUM TITLE MATCHING
========================================== */

function normalizeAlbum(value) {
  return normalize(
    String(value || "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(
        /\b(deluxe|remastered|remaster|expanded|anniversary|edition|bonus tracks|bonus track)\b/gi,
        " "
      )
      .replace(/\s+/g, " ")
  );
}

function exactArtistName(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function artistNamesMatch(left, right) {
  return exactArtistName(left) === exactArtistName(right);
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

/* ==========================================
   SMART ARTIST BIOGRAPHIES
========================================== */

function shortBiography(text, maxWords = 65) {
  const full = cleanText(text);

  if (!full) return "";

  const sentences =
    full.match(/[^.!?]+(?:[.!?]+|$)/g) || [full];

  const selected = [];
  let words = 0;

  for (const sentence of sentences) {
    const trimmed = sentence.trim();

    if (!trimmed) continue;

    const count = trimmed.split(/\s+/).length;

    if (
      selected.length > 0 &&
      words + count > maxWords
    ) {
      break;
    }

    selected.push(trimmed);
    words += count;

    if (words >= maxWords) break;
  }

  return selected.join(" ").trim();
}

/* ==========================================
   BIOGRAPHY EXPAND / COLLAPSE
========================================== */

function renderBiography(text) {
  const bio = document.querySelector("#artist-bio");

  if (!bio) return;

  const full = cleanText(text);
  const short = shortBiography(full, 65);

  const oldButton =
    document.querySelector("#bio-toggle");

  if (oldButton) oldButton.remove();

  bio.textContent = short;

  if (!full || short === full) {
    return;
  }

  const button = document.createElement("button");

  button.id = "bio-toggle";
  button.className = "bio-toggle";
  button.type = "button";
  button.textContent = "Read more";

  button.setAttribute(
    "aria-expanded",
    "false"
  );

  bio.insertAdjacentElement(
    "afterend",
    button
  );

  let expanded = false;

  button.addEventListener("click", () => {
    expanded = !expanded;

    bio.textContent = expanded
      ? full
      : short;

    button.textContent = expanded
      ? "Show less"
      : "Read more";

    button.setAttribute(
      "aria-expanded",
      String(expanded)
    );
  });
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

/* ==========================================
   CURATED PROFILE BUILDER
========================================== */

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
      image: null,
      mbid: null
    })),

    past: [...profile.past],
    present: [...profile.present],
    future: [...profile.future]
  };
}

/* ==========================================
   THEAUDIODB

   Requests are spaced to respect the
   external service.
========================================== */

function audioDb(endpoint, params = {}) {
  const key =
    `audiodb:${endpoint}:${JSON.stringify(params)}`;

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

        if (remaining) {
          await pause(remaining);
        }

        nextAudioDbRequest = Date.now() + 2100;

        return requestJSON(url.toString());
      });

    audioDbQueue = job.catch(() => {});

    return job;
  });
}

async function getAudioDbArtist(name) {
  const data = await audioDb("search.php", {
    s: name
  });

  return (data.artists || []).find(artist =>
    artistNamesMatch(artist.strArtist, name)
  ) || null;
}

async function getAudioDbAlbums(name) {
  const data = await audioDb("searchalbum.php", {
    s: name
  });

  return (data.album || []).filter(album =>
    artistNamesMatch(album.strArtist, name)
  );
}

function findAudioDbAlbum(albums, title) {
  return albums.find(album =>
    normalizeAlbum(album.strAlbum) ===
    normalizeAlbum(title)
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
  const key =
    `lastfm:${method}:${JSON.stringify(params)}`;

  return cached(key, async () => {
    if (
      !LASTFM_API_KEY ||
      LASTFM_API_KEY ===
        "PASTE_YOUR_EXISTING_LASTFM_API_KEY_HERE"
    ) {
      throw new Error(
        "Add your existing Last.fm API key."
      );
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
      throw new Error(
        data.message || "Last.fm unavailable"
      );
    }

    return data;
  });
}

async function getLastfmArtist(name) {
  const data = await lastfm("artist.getInfo", {
    artist: name,
    autocorrect: 1
  });

  const artist = data.artist || null;

  if (!artist) return null;

  if (artistNamesMatch(artist.name, name)) {
    return artist;
  }

  // Prevent punctuation-only artist collisions.
  // Anxious and .anxious. remain separate artists.
  if (
    normalize(artist.name) === normalize(name)
  ) {
    return null;
  }

  // Other spelling corrections can still be useful.
  return artist;
}

async function getSimilarArtists(name) {
  const data = await lastfm("artist.getSimilar", {
    artist: name,
    autocorrect: 0,
    limit: 75
  });

  console.log(
  "Music Atlas similar artists:",
  name,
  data.similarartists?.artist
);

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
    autocorrect: 0,
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
    autocorrect: 0
  });

  const result = data.album || null;

  return result &&
    artistNamesMatch(
      result.artist?.name || result.artist,
      artist
    )
      ? result
      : null;
}

/* ==========================================
   MUSICBRAINZ
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

        if (remaining) {
          await pause(remaining);
        }

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

/* ==========================================
   ARTIST IDENTITY
========================================== */

async function findMusicBrainzArtist(name) {
  const query = encodeURIComponent(
    `artist:"${String(name).replace(/"/g, "")}"`
  );

  const data = await musicBrainz(
    `artist/?query=${query}&fmt=json&limit=50`
  );

  const candidates = data.artists || [];
  const requested = exactArtistName(name);

  const exact = candidates.filter(artist =>
    artistNamesMatch(artist.name, name)
  );

  if (exact.length) {
    return exact.sort((a, b) =>
      (b.score || 0) - (a.score || 0)
    )[0];
  }

  const partial = candidates.filter(artist => {
    const candidate = exactArtistName(artist.name);

    return (
      candidate.startsWith(requested) &&
      candidate !== requested &&
      candidate[0] === requested[0]
    );
  });

  partial.sort((a, b) => {
    const aName = exactArtistName(a.name);
    const bName = exactArtistName(b.name);

    const aPrefix =
      aName.startsWith(requested + " ") ? 1 : 0;

    const bPrefix =
      bName.startsWith(requested + " ") ? 1 : 0;

    return (
      (bPrefix - aPrefix) ||
      ((b.score || 0) - (a.score || 0)) ||
      (aName.length - bName.length)
    );
  });

  return partial[0] || null;
}

/* ==========================================
   VERIFIED MUSICBRAINZ ALBUMS
========================================== */

async function getMusicBrainzAlbums(id) {
  const data = await musicBrainz(
    `release-group/?artist=${encodeURIComponent(id)}` +
    "&type=album&limit=100&fmt=json"
  );

  const albums = new Map();

  for (const item of data["release-groups"] || []) {
    if (item["primary-type"] !== "Album") {
      continue;
    }

    if (
      (item["secondary-types"] || []).some(type =>
        [
          "Compilation",
          "Live",
          "Remix",
          "DJ-mix"
        ].includes(type)
      )
    ) {
      continue;
    }

    const key = normalize(item.title);

    if (!key || albums.has(key)) {
      continue;
    }

    albums.set(key, {
      title: item.title,
      year:
        item["first-release-date"]?.slice(0, 4) || "",
      mbid: item.id
    });
  }

  return [...albums.values()];
}

/* ==========================================
   MUSICBRAINZ RELATIONSHIPS
========================================== */

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

    if (!artist?.name) {
      continue;
    }

    if (!allowedTypes.has(relation.type)) {
      continue;
    }

    if (artist.type !== "Group") {
      continue;
    }

    const key = normalize(artist.name);

    if (seen.has(key)) {
      continue;
    }

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

  const wiki = await safe(
    () => wikipediaExtract(name)
  );

  const wikiBio =
    wiki &&
    artistNamesMatch(wiki.title, name)
      ? usefulText(wiki.text, 65)
      : "";

  const lastfmBio = usefulText(
    lastfmArtist?.bio?.summary,
    65
  );

  const candidates = [
    wikiBio,
    audioBio,
    lastfmBio
  ].filter(Boolean);

  if (!candidates.length) {
    return `Explore the music and connections of ${name}.`;
  }

  const substantial = candidates.find(
    text => text.split(/\s+/).length >= 65
  );

  return substantial || candidates[0];
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

  if (audioDescription) {
    return audioDescription;
  }

  const lastfmAlbum = await safe(
    () => getLastfmAlbum(artist, album.title)
  );

  const lastfmDescription = albumSummary(
    lastfmAlbum?.wiki?.summary
  );

  if (lastfmDescription) {
    return lastfmDescription;
  }

  const wiki = await safe(
    () => wikipediaExtract(
      `${album.title} (${artist} album)`
    )
  );

  if (
    wiki &&
    wiki.text.length >= 55 &&
    normalize(wiki.title).includes(
      normalize(album.title)
    )
  ) {
    return albumSummary(wiki.text);
  }

  return "";
}

/* ==========================================
   SELECT THREE ALBUMS
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
    if (results.length >= 3) {
      return;
    }

    const key = normalize(album.title);

    if (!key || seen.has(key)) {
      return;
    }

    seen.add(key);

    const audio = findAudioDbAlbum(
      audioAlbums,
      album.title
    );

    results.push({
      title: album.title,
      year:
        album.year ||
        audio?.intYearReleased ||
        "",
      why: "",
      image: audioDbAlbumImage(audio),
      mbid: album.mbid || null
    });
  }

  for (const album of topAlbums) {
    const match = verified.get(
      normalize(album.title)
    );

    if (match) {
      add(match);
    }

    if (results.length === 3) {
      break;
    }
  }

  for (const album of verifiedAlbums) {
    add(album);

    if (results.length === 3) {
      break;
    }
  }

  if (results.length < 3) {
    for (const album of audioAlbums) {
      add({
        title: album.strAlbum,
        year: album.intYearReleased,
        mbid: null
      });

      if (results.length === 3) {
        break;
      }
    }
  }

  if (results.length < 3) {
    for (const album of topAlbums) {
      add(album);

      if (results.length === 3) {
        break;
      }
    }
  }

  return results;
}

/* ==========================================
   ARTIST CONNECTION DISCOVERY
========================================== */

/* ==========================================
   ARTIST START YEAR
========================================== */

function artistStartYear(artist) {
  const date =
    artist?.["life-span"]?.begin || "";

  const year = Number(date.slice(0, 4));

  return year >= 1850 && year <= 2100
    ? year
    : null;
}

/* ==========================================
   REVERSE CURATED CONNECTIONS
========================================== */

function reverseEditorialLinks(name) {
  const result = {
    past: [],
    present: [],
    future: []
  };

  const key = exactArtistName(name);

  for (const profile of Object.values(PROFILES)) {
    if (
      exactArtistName(profile.name) === key
    ) {
      continue;
    }

    const mappings = [
      ["past", "future"],
      ["present", "present"],
      ["future", "past"]
    ];

    for (const [source, destination] of mappings) {
      if (
        profile[source].some(
          artist =>
            exactArtistName(artist) === key
        )
      ) {
        result[destination].push(profile.name);
      }
    }
  }

  return result;
}

/* ==========================================
   VERIFY CONNECTION CANDIDATES
========================================== */

async function verifyConnectionCandidates(
  candidates,
  sourceArtist
) {
  const enriched = await Promise.all(
    candidates.map(async candidate => {
      const mb = await safe(
        () => findMusicBrainzArtist(
          candidate.name
        )
      );

      return {
        name:
          mb &&
          artistNamesMatch(
            mb.name,
            candidate.name
          )
            ? mb.name
            : candidate.name,

        year: artistStartYear(mb),

        type: mb?.type || null,

        match:
          Number(candidate.match) || 0,

        mbid: mb?.id || null
      };
    })
  );

  return enriched.filter(candidate => {
    if (
      sourceArtist?.type === "Group" &&
      candidate.type === "Person"
    ) {
      return false;
    }

    return Boolean(
      candidate.name &&
      candidate.match > 0
    );
  });
}

/* ==========================================
   BUILD MUSICAL CONNECTIONS
========================================== */

async function buildConnections(
  name,
  similar,
  documented,
  mbArtist
) {
  const result = reverseEditorialLinks(name);

  const used = new Set([
    exactArtistName(name),
    ...Object.values(result)
      .flat()
      .map(exactArtistName)
  ]);

  const sourceYear =
    artistStartYear(mbArtist);

  /* ========================================
     ADD AN ARTIST TO A COLUMN
  ======================================== */

  function add(column, artistName) {
    const key =
      exactArtistName(artistName);

    if (!key || used.has(key)) {
      return false;
    }

    if (result[column].length >= 3) {
      return false;
    }

    used.add(key);

    result[column].push(artistName);

    return true;
  }

  function allColumnsFull() {
    return (
      result.past.length >= 3 &&
      result.present.length >= 3 &&
      result.future.length >= 3
    );
  }

  /* ========================================
     DOCUMENTED COLLABORATIONS
  ======================================== */

  for (const artist of documented || []) {
    add("present", artist);
  }

  /* ========================================
     PREPARE LAST.FM RECOMMENDATIONS
  ======================================== */

  const candidateNames = new Set();

  const candidates = (similar || [])
    .filter(item => {
      if (!item?.name) {
        return false;
      }

      if (!(Number(item.match) > 0)) {
        return false;
      }

      const key =
        exactArtistName(item.name);

      if (
        used.has(key) ||
        candidateNames.has(key)
      ) {
        return false;
      }

      candidateNames.add(key);

      return true;
    })
    .sort(
      (a, b) =>
        Number(b.match) -
        Number(a.match)
    );

  /* ========================================
     CHRONOLOGICAL CLASSIFICATION
  ======================================== */

  function classify(candidate) {
    if (
      !sourceYear ||
      !candidate.year
    ) {
      return "unknown";
    }

    const difference =
      candidate.year - sourceYear;

    if (difference <= -5) {
      return "past";
    }

    if (difference >= 5) {
      return "future";
    }

    return "present";
  }

  /* ========================================
     DISTRIBUTE VERIFIED CANDIDATES
  ======================================== */

  function distribute(artists) {
    const available = artists.filter(
      candidate =>
        !used.has(
          exactArtistName(candidate.name)
        )
    );

    /* ======================================
       FIRST PASS: STRONG CHRONOLOGY
    ====================================== */

    for (const column of [
      "past",
      "future",
      "present"
    ]) {
      for (const candidate of available) {
        if (result[column].length >= 3) {
          break;
        }

        if (
          classify(candidate) === column
        ) {
          add(
            column,
            candidate.name
          );
        }
      }
    }

    /* ======================================
       SECOND PASS: RELAXED CHRONOLOGY
    ====================================== */

    if (sourceYear) {
      for (const candidate of available) {
        if (result.past.length >= 3) {
          break;
        }

        if (
          candidate.year &&
          candidate.year < sourceYear
        ) {
          add(
            "past",
            candidate.name
          );
        }
      }

      for (const candidate of available) {
        if (result.future.length >= 3) {
          break;
        }

        if (
          candidate.year &&
          candidate.year > sourceYear
        ) {
          add(
            "future",
            candidate.name
          );
        }
      }
    }

    /* ======================================
       THIRD PASS: UNKNOWN-DATE ARTISTS
    ====================================== */

    const unknown = available.filter(
      candidate =>
        classify(candidate) === "unknown" &&
        !used.has(
          exactArtistName(candidate.name)
        )
    );

    for (const column of [
      "past",
      "future",
      "present"
    ]) {
      for (const candidate of unknown) {
        if (result[column].length >= 3) {
          break;
        }

        add(
          column,
          candidate.name
        );
      }
    }

    /* ======================================
       FINAL PASS: RELATED DISCOVERIES
    ====================================== */

    for (const column of [
      "past",
      "future",
      "present"
    ]) {
      for (const candidate of available) {
        if (result[column].length >= 3) {
          break;
        }

        add(
          column,
          candidate.name
        );
      }
    }
  }

  /* ========================================
     FIRST PASS — ORIGINAL 24 CANDIDATES
  ======================================== */

  const primaryCandidates =
    candidates.slice(0, 24);

  const primaryVerified =
    await verifyConnectionCandidates(
      primaryCandidates,
      mbArtist
    );

  distribute(primaryVerified);

  /* ========================================
     SECOND PASS — 12 MORE CANDIDATES
  ======================================== */

  if (!allColumnsFull()) {
    const additionalCandidates =
      candidates.slice(24, 36);

    if (additionalCandidates.length) {
      const additionalVerified =
        await verifyConnectionCandidates(
          additionalCandidates,
          mbArtist
        );

      distribute(additionalVerified);
    }
  }

  /* ========================================
     FINAL RESULT
  ======================================== */

  return {
    past: result.past.slice(0, 3),
    present: result.present.slice(0, 3),
    future: result.future.slice(0, 3)
  };
}

/* ==========================================
   LIVE ARTIST PROFILE
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
      ? safe(
          () => getMusicBrainzAlbums(mbArtist.id),
          []
        )
      : Promise.resolve([]),

    safe(() => getAudioDbAlbums(realName), []),

    mbArtist?.id
      ? safe(
          () => getMusicBrainzRelationships(mbArtist.id),
          []
        )
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

  /* ========================================
     START CONNECTION DISCOVERY
  ======================================== */

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

  /* ========================================
     DISPLAY BIOGRAPHY AND ALBUMS FIRST
  ======================================== */

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
========================================== */

function getCachedProfile(key) {
  const entry = profileCache.get(key);

  if (!entry) {
    return null;
  }

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
  const key = exactArtistName(name);

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

        profileCache.set(
          exactArtistName(profile.name),
          {
            profile,
            expires: Date.now() + PROFILE_CACHE_MS
          }
        );
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
   DEEZER JSONP REQUESTS
========================================== */

function deezer(url) {
  return new Promise((resolve, reject) => {
    const callback =
      `atlas_callback_${++callbackNumber}`;

    const script = document.createElement("script");

    let finished = false;

    const timer = setTimeout(() => {
      finish(
        new Error("Artwork lookup timed out")
      );
    }, 6500);

    function finish(error, data) {
      if (finished) {
        return;
      }

      finished = true;

      clearTimeout(timer);
      script.remove();

      delete window[callback];

      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    }

    window[callback] = data =>
      finish(null, data);

    script.onerror = () =>
      finish(new Error("Artwork unavailable"));

    script.src =
      `${url}${url.includes("?") ? "&" : "?"}` +
      `output=jsonp&callback=${callback}`;

    document.head.appendChild(script);
  });
}

/* ==========================================
   ARTIST PHOTOGRAPH LOOKUP
========================================== */

function findArtistPhoto(name) {
  return cached(
    `portrait:${exactArtistName(name)}`,
    async () => {
      const data = await deezer(
        "https://api.deezer.com/search/artist" +
        `?q=${encodeURIComponent(name)}&limit=25`
      );

      const artists = (data.data || [])
        .filter(item =>
          artistNamesMatch(item.name, name)
        )
        .sort(
          (a, b) =>
            (b.nb_fan || 0) -
            (a.nb_fan || 0)
        );

      return (
        artists[0]?.picture_xl ||
        artists[0]?.picture_big ||
        null
      );
    }
  );
}

/* ==========================================
   COVER ART ARCHIVE
========================================== */

async function findCoverArtArchive(mbid) {
  if (!mbid) {
    return null;
  }

  return cached(
    `coverarchive:${mbid}`,
    async () => {
      const url =
        "https://coverartarchive.org/release-group/" +
        encodeURIComponent(mbid);

      const data = await requestJSON(
        url,
        {},
        7000
      );

      const images = data.images || [];

      const front =
        images.find(item => item.front) ||
        images[0];

      if (!front) {
        return null;
      }

      return (
        front.thumbnails?.large ||
        front.thumbnails?.["500"] ||
        front.image ||
        null
      );
    }
  );
}

/* ==========================================
   ITUNES ALBUM ARTWORK
========================================== */

async function findItunesAlbumCover(
  artist,
  album
) {
  const query = encodeURIComponent(
    `${artist} ${album}`
  );

  const data = await requestJSON(
    "https://itunes.apple.com/search" +
    `?term=${query}&entity=album&limit=100`,
    {},
    7000
  );

  const match = (data.results || []).find(item =>
    artistNamesMatch(item.artistName, artist) &&
    normalizeAlbum(item.collectionName) ===
    normalizeAlbum(album)
  );

  if (!match?.artworkUrl100) {
    return null;
  }

  return match.artworkUrl100.replace(
    /100x100(?:bb)?/,
    "600x600bb"
  );
}

/* ==========================================
   DEEZER ALBUM ARTWORK
========================================== */

async function findDeezerAlbumCover(
  artist,
  album
) {
  const query = encodeURIComponent(
    `${artist} ${album}`
  );

  const data = await deezer(
    "https://api.deezer.com/search/album" +
    `?q=${query}&limit=100`
  );

  const match = (data.data || []).find(item =>
    artistNamesMatch(
      item.artist?.name,
      artist
    ) &&
    normalizeAlbum(item.title) === normalizeAlbum(album)
  );

  return (
    match?.cover_xl ||
    match?.cover_big ||
    null
  );
}

/* ==========================================
   COLLECT ALBUM COVER CANDIDATES

   Look up artwork sources concurrently
   instead of waiting for each service
   before contacting the next.
========================================== */

async function findAlbumCoverCandidates(
  artist,
  album,
  mbid = null
) {
  const key =
    `covers:${exactArtistName(artist)}:` +
    `${normalize(album)}:${mbid || ""}`;

  return cached(key, async () => {
    const [archive, itunes, deezerCover] =
      await Promise.all([
        mbid
          ? safe(
              () => findCoverArtArchive(mbid)
            )
          : Promise.resolve(null),

        safe(
          () => findItunesAlbumCover(
            artist,
            album
          )
        ),

        safe(
          () => findDeezerAlbumCover(
            artist,
            album
          )
        )
      ]);

    return [
      ...new Set(
        [
          archive,
          itunes,
          deezerCover
        ].filter(Boolean)
      )
    ];
  });
}

/* ==========================================
   FIND FIRST AVAILABLE ALBUM COVER

   Verify images before displaying them.
========================================== */

async function findAlbumCover(
  artist,
  album,
  mbid = null
) {
  const candidates =
    await findAlbumCoverCandidates(
      artist,
      album,
      mbid
    );

  for (const url of candidates) {
    if (await verifyImage(url)) {
      return url;
    }
  }

  return null;
}

/* ==========================================
   IMAGE LOADING
========================================== */

function verifyImage(url) {
  if (!url) {
    return Promise.resolve(false);
  }

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
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timer);

      resolve(success);
    }

    image.onload = () =>
      finish(image.naturalWidth > 0);

    image.onerror = () =>
      finish(false);

    image.src = url;
  });

  imageCache.set(url, job);

  return job;
}

/* ==========================================
   LOAD IMAGE

   Display preferred artwork immediately
   when available.

   Only search alternative sources if
   the preferred image cannot be loaded.
========================================== */

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
    const stillCurrent = () =>
      version === renderVersion &&
      image.isConnected;

    async function display(url) {
      if (!url) {
        return false;
      }

      if (!(await verifyImage(url))) {
        return false;
      }

      if (!stillCurrent()) {
        return true;
      }

      image.src = url;
      image.hidden = false;
      fallback.hidden = true;

      return true;
    }

    if (await display(preferred)) {
      return;
    }

    const alternatives = await safe(
      lookup,
      null
    );

    if (!stillCurrent()) {
      return;
    }

    const candidates = Array.isArray(alternatives)
      ? alternatives
      : alternatives
        ? [alternatives]
        : [];

    const seen = new Set();

    for (const url of candidates) {
      if (!url || seen.has(url)) {
        continue;
      }

      seen.add(url);

      if (await display(url)) {
        return;
      }
    }
  })();
}

/* ==========================================
   RENDER ALBUMS
========================================== */

function renderAlbums(profile, version) {
  const root = $("#albums");

  if (!root) {
    return;
  }

  root.replaceChildren();

  for (const album of profile.albums || []) {
    const card = makeElement(
      "article",
      "album"
    );

    const artwork = makeElement(
      "div",
      "album-art"
    );

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

    card.append(
      artwork,
      title,
      description
    );

    root.append(card);

    loadImage(
      image,
      fallback,
      album.image,
      () => findAlbumCoverCandidates(
        profile.name,
        album.title,
        album.mbid
      ),
      version
    );
  }
}

/* ==========================================
   RENDER CONNECTIONS

   Sentence-case headings.

   Display order:
   1. Their musical world.
   2. What shaped them.
   3. Where the sound went next.
========================================== */

function renderConnections(profile, version) {
  const root = $("#connections-grid");

  if (!root) {
    return;
  }

  root.replaceChildren();

  const columns = [
    ["past", "Influences"],
    ["present", "Similar artists"],
    ["future", "Next generation"]
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
      makeElement(
        "span",
        "blue-dot",
        "."
      )
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

  if (!root) {
    return;
  }

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

    button.addEventListener(
      "click",
      () => {
        trail = trail.slice(
          0,
          index + 1
        );

        render(entry.key);
      }
    );

    root.append(button);
  });

  root.scrollLeft = root.scrollWidth;
}

/* ==========================================
   SHOW PROFILE
========================================== */

function showProfile(
  key,
  profile,
  version,
  preview = false
) {
  if (version !== renderVersion) {
    return;
  }

  const name =
    profile.name ||
    trail[trail.length - 1]?.name ||
    key;

  if (trail.length) {
    trail[trail.length - 1].name = name;
  }

  const nameElement = $("#artist-name");
  const genreElement = $("#artist-genre");
  const bioElement = $("#artist-bio");

  if (nameElement) {
    nameElement.textContent = name;
  }

  if (genreElement) {
    genreElement.textContent =
      profile.genre || "ARTIST DISCOVERY";
  }

  renderBiography(profile.bio || "");

  /* ========================================
     PORTRAIT LOADING
  ======================================== */

  const portrait = $("#artist-photo");
  const portraitFallback =
    $("#portrait-fallback");

  if (portrait && portraitFallback) {
    portrait.alt = `${name} portrait`;

    const artistKey =
      exactArtistName(name);

    if (
      preview ||
      portrait.dataset.artistKey !== artistKey
    ) {
      portrait.dataset.artistKey = artistKey;

      loadImage(
        portrait,
        portraitFallback,
        profile.image,
        () => findArtistPhoto(name),
        version
      );
    }
  }

  /* ========================================
     ALBUMS AND CONNECTIONS
  ======================================== */

  const albumsRoot = $("#albums");
  const connectionsRoot =
    $("#connections-grid");

  if (preview) {
    renderAlbums(profile, version);

    if (connectionsRoot) {
      connectionsRoot.replaceChildren();
    }
  } else {
    if (
      albumsRoot &&
      (
        !albumsRoot.children.length ||
        albumsRoot.dataset.artistKey !==
          exactArtistName(name)
      )
    ) {
      renderAlbums(profile, version);
    }

    renderConnections(profile, version);
  }

  if (albumsRoot) {
    albumsRoot.dataset.artistKey =
      exactArtistName(name);
  }

  renderTrail();

  document.title =
    `${name} — The Music Atlas`;
}

/* ==========================================
   WATER RIPPLE
========================================== */

function initializeRipple() {
  const existing = $("#loading-screen");

  if (existing) {
    loadingScreen = existing;
  } else {
    loadingScreen = document.createElement("div");

    loadingScreen.className = "loading-screen";
    loadingScreen.id = "loading-screen";

    loadingScreen.setAttribute(
      "role",
      "status"
    );

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
  }

  window.addEventListener(
    "resize",
    positionRipple
  );
}

function positionRipple() {
  if (!loadingScreen) {
    return;
  }

  const header = $(".site-header");

  const bottom = header
    ? header.getBoundingClientRect().bottom
    : 0;

  loadingScreen.style.top =
    `${Math.max(0, bottom)}px`;
}

function showRipple() {
  if (!loadingScreen) {
    return;
  }

  if (
    window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  ) {
    return;
  }

  positionRipple();

  loadingScreen.classList.remove(
    "is-fading"
  );

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
  if (!loadingScreen) {
    return;
  }

  if (version !== rippleVersion) {
    return;
  }

  loadingScreen.classList.add(
    "is-fading"
  );

  await pause(600);

  if (version !== rippleVersion) {
    return;
  }

  loadingScreen.hidden = true;

  loadingScreen.classList.remove(
    "is-fading"
  );
}

/* ==========================================
   LOAD ARTIST
========================================== */

async function render(key) {
  const version = ++renderVersion;
  const transition = ++rippleVersion;
  const started = Date.now();

  const currentName =
    trail[trail.length - 1]?.name ||
    key.replace(/-/g, " ");

  /* ========================================
     PRESERVE EXACT ARTIST NAME IN URL
  ======================================== */

  const url = new URL(
    window.location.href
  );

  url.searchParams.set(
    "artist",
    currentName
  );

  history.replaceState(
    { artist: currentName },
    "",
    url
  );

  /* ========================================
     CLEAR PREVIOUS ARTIST STATE
  ======================================== */

  const portrait = $("#artist-photo");
  const albumsRoot = $("#albums");

  if (portrait) {
    portrait.dataset.artistKey = "";
  }

  if (albumsRoot) {
    albumsRoot.dataset.artistKey = "";
  }

  showRipple();

  try {
   
    /* ==========================================
   CURATED ARTISTS — UNIFIED EXPERIENCE
========================================== */

const curated = curatedProfile(key);

if (curated) {
  const live = await safe(
    () => getLiveProfile(curated.name)
  );

  if (version !== renderVersion) {
    return;
  }

  const liveAlbums = live?.albums || [];

  const unified = {
    ...curated,

    
    bio: live?.bio || curated.bio,

    image: live?.image || curated.image,

    albums: curated.albums.map(album => {
      const match = liveAlbums.find(
        item =>
          normalize(item.title) ===
          normalize(album.title)
      );

      return {
        ...album,
        image: match?.image || album.image,
        mbid: match?.mbid || album.mbid
      };
    }),

    // Keep the curated connections.
    past: curated.past,
    present: curated.present,
    future: curated.future
  };

  showProfile(
    key,
    unified,
    version
  );

  return;
}

    /* ======================================
       LIVE PROFILE
    ====================================== */

    const name =
      trail[trail.length - 1]?.name ||
      key.replace(/-/g, " ");

    const existing = getCachedProfile(
      exactArtistName(name)
    );

    if (existing) {
      showProfile(
        key,
        existing,
        version
      );

      return;
    }

    const profile = await getLiveProfile(
      name,
      preview => {
        if (version !== renderVersion) {
          return;
        }

        showProfile(
          key,
          preview,
          version,
          true
        );
      }
    );

    if (version !== renderVersion) {
      return;
    }

    if (!profile) {
      showProfile(
        key,
        {
          name,
          genre: "ARTIST DISCOVERY",
          bio:
            "We couldn't find reliable information " +
            "for this artist. Try another search.",
          image: null,
          albums: [],
          past: [],
          present: [],
          future: []
        },
        version
      );

      return;
    }

    showProfile(
      key,
      profile,
      version
    );

  } catch (error) {
    console.error(
      "Music Atlas profile error:",
      error
    );

    if (version === renderVersion) {
      showProfile(
        key,
        {
          name: currentName,
          genre: "ARTIST DISCOVERY",
          bio:
            "Artist information is temporarily " +
            "unavailable. Please try again.",
          image: null,
          albums: [],
          past: [],
          present: [],
          future: []
        },
        version
      );
    }

  } finally {
    if (version === renderVersion) {
      const elapsed =
        Date.now() - started;

      const remaining = Math.max(
        0,
        450 - elapsed
      );

      if (remaining) {
        await pause(remaining);
      }

      await hideRipple(transition);
    }
  }
}

/* ==========================================
   NAVIGATE TO ARTIST
========================================== */

function navigate(key, name = "") {
  const artistName =
    String(name || key.replace(/-/g, " "))
      .trim();

  if (!artistName) {
    return;
  }

  const artistKey = slug(artistName);

  const current =
    trail[trail.length - 1];

  if (
    current &&
    artistNamesMatch(
      current.name,
      artistName
    )
  ) {
    return;
  }

  trail.push({
    key: artistKey,
    name: artistName
  });

  render(artistKey);
}

/* ==========================================
   ARTIST SEARCH
========================================== */

const searchForm = $("#discovery-search");
const searchInput = $("#artist-search");

if (searchForm && searchInput) {
  searchForm.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      const name =
        searchInput.value.trim();

      if (!name) {
        return;
      }

      navigate(
        slug(name),
        name
      );

      searchInput.value = "";
    }
  );
}

/* ==========================================
   START OVER
========================================== */

const resetButton = $("#reset-trail");

if (resetButton) {
  resetButton.addEventListener(
    "click",
    () => {
      window.location.href =
        "index.html";
    }
  );
}

/* ==========================================
   INITIALIZE
========================================== */

initializeRipple();

const params = new URLSearchParams(
  window.location.search
);

const requested =
  params.get("artist")?.trim() ||
  "David Bowie";

navigate(
  slug(requested),
  requested
);

/* ========================================
   THE MUSIC ATLAS — LIGHT / DARK MODE
======================================== */

(function setupThemeToggle() {
  const button = document.getElementById("theme-toggle");

  if (!button) return;

  const icon = button.querySelector(".theme-icon");

  const savedTheme = localStorage.getItem("music-atlas-theme");

  const prefersDark = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;

    icon.textContent = theme === "dark" ? "☀" : "☾";

    const label = theme === "dark"
      ? "Switch to light mode"
      : "Switch to dark mode";

    button.setAttribute("aria-label", label);
    button.title = label;
  }

  applyTheme(
    savedTheme === "light" || savedTheme === "dark"
      ? savedTheme
      : prefersDark ? "dark" : "light"
  );

  button.addEventListener("click", () => {
    const nextTheme =
      document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark";

    applyTheme(nextTheme);
    localStorage.setItem("music-atlas-theme", nextTheme);
  });
})();
