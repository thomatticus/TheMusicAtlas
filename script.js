
"use strict";

/* ==========================================
   THE MUSIC ATLAS
========================================== */


/* ==========================================
   CURATED ARTIST LIBRARY
========================================== */

const artistLibrary = [

  // POP
  { name: "Michael Jackson", genre: "Pop" },
  { name: "Madonna", genre: "Pop" },
  { name: "Prince", genre: "Pop" },
  { name: "Kate Bush", genre: "Pop" },
  { name: "Whitney Houston", genre: "Pop" },
  { name: "Janet Jackson", genre: "Pop" },
  { name: "Mariah Carey", genre: "Pop" },
  { name: "Britney Spears", genre: "Pop" },
  { name: "Beyoncé", genre: "Pop" },
  { name: "Lady Gaga", genre: "Pop" },

  // ROCK
  { name: "Chuck Berry", genre: "Rock" },
  { name: "Jimi Hendrix", genre: "Rock" },
  { name: "The Beatles", genre: "Rock" },
  { name: "Led Zeppelin", genre: "Rock" },
  { name: "David Bowie", genre: "Rock" },
  { name: "Fleetwood Mac", genre: "Rock" },
  { name: "Talking Heads", genre: "Rock" },
  { name: "Nirvana", genre: "Rock" },
  { name: "Radiohead", genre: "Rock" },
  { name: "Paramore", genre: "Rock" },

  // HIP-HOP
  { name: "Grandmaster Flash", genre: "Hip-Hop" },
  { name: "Tupac Shakur", genre: "Hip-Hop" },
  { name: "The Notorious B.I.G.", genre: "Hip-Hop" },
  { name: "Jay-Z", genre: "Hip-Hop" },
  { name: "Missy Elliott", genre: "Hip-Hop" },
  { name: "Nas", genre: "Hip-Hop" },
  { name: "Eminem", genre: "Hip-Hop" },
  { name: "Kendrick Lamar", genre: "Hip-Hop" },
  { name: "Cardi B", genre: "Hip-Hop" },
  { name: "Ye", genre: "Hip-Hop" },

  // COUNTRY
  { name: "Hank Williams", genre: "Country" },
  { name: "Patsy Cline", genre: "Country" },
  { name: "Johnny Cash", genre: "Country" },
  { name: "Loretta Lynn", genre: "Country" },
  { name: "Willie Nelson", genre: "Country" },
  { name: "Dolly Parton", genre: "Country" },
  { name: "Emmylou Harris", genre: "Country" },
  { name: "Garth Brooks", genre: "Country" },
  { name: "Shania Twain", genre: "Country" },
  { name: "Kacey Musgraves", genre: "Country" },

  // ELECTRONIC
  { name: "Kraftwerk", genre: "Electronic" },
  { name: "Giorgio Moroder", genre: "Electronic" },
  { name: "Brian Eno", genre: "Electronic" },
  { name: "New Order", genre: "Electronic" },
  { name: "Depeche Mode", genre: "Electronic" },
  { name: "Aphex Twin", genre: "Electronic" },
  { name: "Daft Punk", genre: "Electronic" },
  { name: "Massive Attack", genre: "Electronic" },
  { name: "Björk", genre: "Electronic" },
  { name: "Skrillex", genre: "Electronic" },

  // JAZZ
  { name: "Louis Armstrong", genre: "Jazz" },
  { name: "Duke Ellington", genre: "Jazz" },
  { name: "Billie Holiday", genre: "Jazz" },
  { name: "Ella Fitzgerald", genre: "Jazz" },
  { name: "Charlie Parker", genre: "Jazz" },
  { name: "Miles Davis", genre: "Jazz" },
  { name: "John Coltrane", genre: "Jazz" },
  { name: "Nina Simone", genre: "Jazz" },
  { name: "Herbie Hancock", genre: "Jazz" },
  { name: "Kamasi Washington", genre: "Jazz" }

];


/* ==========================================
   ORIGINAL HOMEPAGE ARTISTS
========================================== */

const originalNames = [
  "Kate Bush",
  "David Bowie",
  "Missy Elliott",
  "Dolly Parton",
  "Björk",
  "Nina Simone"
];

const genres = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Country",
  "Electronic",
  "Jazz"
];


/* ==========================================
   SETTINGS
========================================== */

const SEARCH_LIMIT = 6;
const SEARCH_PAGE_SIZE = 100;
const SEARCH_MAX_PAGES = 3;

const MIN_IMAGE_SIZE = 400;
const IMAGE_SAMPLE_SIZE = 48;
const IMAGE_TIMEOUT = 9000;

const MIN_RELATED_ARTIST_FANS = 1000;

const CONNECTIONS_ENABLED = false;

const imageOverrides = {};


/* ==========================================
   ARTIST ALIASES
========================================== */

const artistRules = {

  "Tupac Shakur": {
    searches: ["2Pac", "Tupac Shakur"],
    aliases: ["2Pac", "Tupac Shakur"]
  },

  "The Notorious B.I.G.": {
    searches: [
      "The Notorious B.I.G.",
      "Notorious BIG"
    ],
    aliases: [
      "The Notorious B.I.G.",
      "Notorious B.I.G."
    ]
  },

  "Grandmaster Flash": {
    searches: [
      "Grandmaster Flash",
      "Grandmaster Flash and The Furious Five"
    ],
    aliases: [
      "Grandmaster Flash",
      "Grandmaster Flash & The Furious Five",
      "Grandmaster Flash and The Furious Five"
    ]
  },

  "Jay-Z": {
    searches: ["JAY-Z", "Jay-Z"],
    aliases: ["JAY-Z", "Jay-Z"]
  },

  "Ye": {
    searches: ["Kanye West", "Ye"],
    aliases: ["Kanye West", "Ye"]
  },

  "Missy Elliott": {
    searches: ["Missy Elliott"],
    aliases: [
      "Missy Elliott",
      "Missy Misdemeanor Elliott"
    ]
  },

  "Jimi Hendrix": {
    searches: [
      "Jimi Hendrix",
      "The Jimi Hendrix Experience"
    ],
    aliases: [
      "Jimi Hendrix",
      "The Jimi Hendrix Experience"
    ]
  }

};


/* ==========================================
   SEARCH EXCLUSION RULES
========================================== */

const excludedSearchPatterns = [
  /\btributes?\b/i,
  /\bkaraoke\b/i,
  /\bcover band\b/i,
  /\bcover versions?\b/i,
  /\bsound.?alike\b/i,
  /\blook.?alike\b/i,
  /\bmeditation\b/i,
  /\bmeditative\b/i,
  /\brelaxation\b/i,
  /\brelaxing music\b/i,
  /\bsleep music\b/i,
  /\btribute orchestra\b/i,
  /\bin the style of\b/i,
  /\bmade famous by\b/i,
  /\boriginally performed by\b/i
];


/* ==========================================
   ELEMENTS
========================================== */

const artistGrid =
  document.getElementById("artist-grid");

const featuredHeading =
  document.querySelector(".featured-heading");

const refreshButton =
  document.getElementById("refresh-artists");

const searchForm =
  document.getElementById("search-form");

const searchInput =
  document.getElementById("artist-search");

const homeLink =
  document.getElementById("home-link");

const loadingScreen =
  document.getElementById("loading-screen");


/* ==========================================
   STATE AND CACHES
========================================== */

const artistCache = new Map();
const imageCache = new Map();

const discoveryQueues = new Map();
const lastDisplayedByGenre = new Map();

let requestCounter = 0;
let searchRequestNumber = 0;

let rippleRunning = false;
let reshufflePreparing = false;


/* ==========================================
   UTILITIES
========================================== */

function normalizeName(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function artistMatchesSearch(artist, query) {
  return normalizeName(artist.name)
    .includes(normalizeName(query));
}

function isObviousSearchClutter(name) {
  return excludedSearchPatterns.some(
    pattern => pattern.test(name)
  );
}

function wait(milliseconds) {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

function getCacheKey(artist) {
  return artist.id
    ? `deezer:${artist.id}`
    : `featured:${artist.name}`;
}

function setSearchMode(searching) {
  featuredHeading?.classList.toggle(
    "is-hidden",
    searching
  );
}

function getInitialArtists() {
  return originalNames
    .map(name =>
      artistLibrary.find(
        artist => artist.name === name
      )
    )
    .filter(Boolean);
}


/* ==========================================
   DISCOVERY QUEUES
========================================== */

function shuffleArray(items) {
  const shuffled = [...items];

  for (
    let i = shuffled.length - 1;
    i > 0;
    i--
  ) {
    const j = Math.floor(
      Math.random() * (i + 1)
    );

    [shuffled[i], shuffled[j]] =
      [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

function buildGenreQueue(genre) {
  return shuffleArray(
    artistLibrary.filter(
      artist => artist.genre === genre
    )
  );
}

function initializeDiscoveryQueues() {
  genres.forEach(genre => {
    const original = artistLibrary.find(
      artist =>
        artist.genre === genre &&
        originalNames.includes(artist.name)
    );

    const remaining = artistLibrary.filter(
      artist =>
        artist.genre === genre &&
        artist.name !== original?.name
    );

    discoveryQueues.set(
      genre,
      shuffleArray(remaining)
    );

    if (original) {
      lastDisplayedByGenre.set(
        genre,
        original.name
      );
    }
  });
}

async function findNextVerifiedArtist(genre) {
  let queue = discoveryQueues.get(genre);

  if (!queue || queue.length === 0) {
    queue = buildGenreQueue(genre);
  }

  const previousName =
    lastDisplayedByGenre.get(genre);

  if (
    queue.length > 1 &&
    queue[0].name === previousName
  ) {
    queue.push(queue.shift());
  }

  const attempts = queue.length;

  for (let i = 0; i < attempts; i++) {
    const candidate = queue.shift();

    if (!candidate) break;

    const image = await getArtistImage(
      candidate
    );

    if (image) {
      discoveryQueues.set(genre, queue);
      return candidate;
    }

    queue.push(candidate);
  }

  discoveryQueues.set(genre, queue);
  return null;
}

function recordDisplayedArtists(artists) {
  artists.forEach(artist => {
    if (genres.includes(artist.genre)) {
      lastDisplayedByGenre.set(
        artist.genre,
        artist.name
      );
    }
  });
}


/* ==========================================
   DEEZER JSONP
========================================== */

function deezerRequest(url) {
  return new Promise((resolve, reject) => {
    const callbackName =
      `musicAtlasCallback_${++requestCounter}`;

    const script = document.createElement("script");

    let finished = false;

    const timeout = setTimeout(() => {
      finish(new Error("Deezer request timed out"));
    }, 10000);

    function finish(error, data) {
      if (finished) return;

      finished = true;

      clearTimeout(timeout);
      script.remove();

      window[callbackName] = function() {};

      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    }

    window[callbackName] = data => {
      finish(null, data);
    };

    script.onerror = () => {
      finish(new Error("Deezer request failed"));
    };

    const separator = url.includes("?")
      ? "&"
      : "?";

    script.src =
      `${url}${separator}output=jsonp&callback=${callbackName}`;

    document.head.appendChild(script);
  });
}


/* ==========================================
   DEEZER ARTIST SEARCH
========================================== */

async function searchDeezer(
  query,
  limit = SEARCH_PAGE_SIZE,
  index = 0
) {
  const url =
    "https://api.deezer.com/search/artist?q=" +
    encodeURIComponent(query) +
    `&limit=${limit}&index=${index}`;

  const response = await deezerRequest(url);

  if (response?.error) {
    throw new Error(
      response.error.message ||
      "Deezer API error"
    );
  }

  return {
    data: Array.isArray(response?.data)
      ? response.data
      : [],
    next: response?.next || null
  };
}


/* ==========================================
   CURATED ARTIST LOOKUP
========================================== */

async function getArtistData(artist) {
  if (artist.id) {
    return {
      id: artist.id,
      name: artist.name,
      image: artist.image || null
    };
  }

  const key = getCacheKey(artist);

  if (artistCache.has(key)) {
    return artistCache.get(key);
  }

  const promise = (async () => {
    const rule = artistRules[artist.name] || {
      searches: [artist.name],
      aliases: [artist.name]
    };

    const acceptedNames = new Set(
      rule.aliases.map(normalizeName)
    );

    const candidates = new Map();

    for (const searchName of rule.searches) {
      const response = await searchDeezer(
        searchName
      );

      response.data.forEach(result => {
        if (!result?.id) return;

        if (!acceptedNames.has(
          normalizeName(result.name)
        )) {
          return;
        }

        candidates.set(result.id, result);
      });
    }

    const ranked = [...candidates.values()]
      .sort((a, b) =>
        Number(b.nb_fan || 0) -
        Number(a.nb_fan || 0)
      );

    const selected = ranked[0];

    if (!selected) return null;

    const data = await deezerRequest(
      `https://api.deezer.com/artist/${selected.id}`
    );

    if (!data || data.error) return null;

    if (!acceptedNames.has(
      normalizeName(data.name)
    )) {
      return null;
    }

    return {
      id: data.id,
      name: data.name,
      image:
        data.picture_xl ||
        data.picture_big ||
        null
    };
  })();

  artistCache.set(key, promise);

  try {
    const result = await promise;

    if (!result) {
      artistCache.delete(key);
    }

    return result;
  } catch (error) {
    artistCache.delete(key);

    console.warn(
      "Artist lookup failed:",
      artist.name,
      error
    );

    return null;
  }
}


/* ==========================================
   IMAGE QUALITY CHECK
========================================== */

function isMeaningfulPhoto(image) {
  if (
    image.naturalWidth < MIN_IMAGE_SIZE ||
    image.naturalHeight < MIN_IMAGE_SIZE
  ) {
    return false;
  }

  try {
    const canvas = document.createElement(
      "canvas"
    );

    canvas.width = IMAGE_SAMPLE_SIZE;
    canvas.height = IMAGE_SAMPLE_SIZE;

    const context = canvas.getContext("2d", {
      willReadFrequently: true
    });

    if (!context) return false;

    context.drawImage(
      image,
      0,
      0,
      IMAGE_SAMPLE_SIZE,
      IMAGE_SAMPLE_SIZE
    );

    const pixels = context.getImageData(
      0,
      0,
      IMAGE_SAMPLE_SIZE,
      IMAGE_SAMPLE_SIZE
    ).data;

    const brightnessValues = [];

    let brightnessTotal = 0;
    let saturationTotal = 0;
    let minimumBrightness = 255;
    let maximumBrightness = 0;

    for (
      let i = 0;
      i < pixels.length;
      i += 4
    ) {
      const r = pixels[i];
      const g = pixels[i + 1];
      const b = pixels[i + 2];

      const brightness = (r + g + b) / 3;

      const saturation =
        Math.max(r, g, b) -
        Math.min(r, g, b);

      brightnessValues.push(brightness);
      brightnessTotal += brightness;
      saturationTotal += saturation;

      minimumBrightness = Math.min(
        minimumBrightness,
        brightness
      );

      maximumBrightness = Math.max(
        maximumBrightness,
        brightness
      );
    }

    const pixelCount =
      brightnessValues.length;

    const averageBrightness =
      brightnessTotal / pixelCount;

    const averageSaturation =
      saturationTotal / pixelCount;

    const brightnessRange =
      maximumBrightness -
      minimumBrightness;

    let totalDetail = 0;
    let comparisons = 0;

    for (
      let y = 0;
      y < IMAGE_SAMPLE_SIZE;
      y++
    ) {
      for (
        let x = 0;
        x < IMAGE_SAMPLE_SIZE;
        x++
      ) {
        const index =
          y * IMAGE_SAMPLE_SIZE + x;

        if (x < IMAGE_SAMPLE_SIZE - 1) {
          totalDetail += Math.abs(
            brightnessValues[index] -
            brightnessValues[index + 1]
          );

          comparisons++;
        }

        if (y < IMAGE_SAMPLE_SIZE - 1) {
          totalDetail += Math.abs(
            brightnessValues[index] -
            brightnessValues[
              index + IMAGE_SAMPLE_SIZE
            ]
          );

          comparisons++;
        }
      }
    }

    const averageDetail = comparisons
      ? totalDetail / comparisons
      : 0;

    if (
      brightnessRange < 18 &&
      averageDetail < 2
    ) {
      return false;
    }

    if (
      averageBrightness > 155 &&
      averageBrightness < 245 &&
      averageSaturation < 12 &&
      averageDetail < 12 &&
      brightnessRange < 135
    ) {
      return false;
    }

    if (
      averageDetail < 2.5 &&
      brightnessRange < 65
    ) {
      return false;
    }

    return true;
  } catch (error) {
    console.warn(
      "Cannot inspect image:",
      error
    );

    return false;
  }
}


/* ==========================================
   IMAGE LOADING
========================================== */

function loadImage(url, artistName) {
  return new Promise(resolve => {
    if (!url) {
      resolve(null);
      return;
    }

    const image = new Image();

    let finished = false;

    const timeout = setTimeout(() => {
      finish(null);
    }, IMAGE_TIMEOUT);

    function finish(result) {
      if (finished) return;

      finished = true;

      clearTimeout(timeout);

      image.onload = null;
      image.onerror = null;

      resolve(result);
    }

    image.crossOrigin = "anonymous";
    image.alt = `Photograph of ${artistName}`;
    image.decoding = "async";

    image.style.width = "100%";
    image.style.height = "100%";
    image.style.objectFit = "cover";
    image.style.objectPosition = "center";
    image.style.display = "block";

    image.onload = () => {
      finish(
        isMeaningfulPhoto(image)
          ? image
          : null
      );
    };

    image.onerror = () => finish(null);

    image.src = url;
  });
}

async function getArtistImage(artist) {
  const key = getCacheKey(artist);

  if (imageCache.has(key)) {
    return imageCache.get(key);
  }

  const promise = (async () => {
    const override =
      imageOverrides[artist.name];

    if (override) {
      const overriddenImage = await loadImage(
        override,
        artist.name
      );

      if (overriddenImage) {
        return overriddenImage;
      }
    }

    if (artist.id && artist.image) {
      const directImage = await loadImage(
        artist.image,
        artist.name
      );

      if (directImage) {
        return directImage;
      }
    }

    const data = await getArtistData(artist);

    if (!data?.image) return null;

    return loadImage(
      data.image,
      artist.name
    );
  })();

  imageCache.set(key, promise);

  try {
    const image = await promise;

    if (!image) {
      imageCache.delete(key);
    }

    return image;
  } catch (error) {
    imageCache.delete(key);

    console.warn(
      "Photo unavailable:",
      artist.name,
      error
    );

    return null;
  }
}


/* ==========================================
   ARTIST CARD NAVIGATION
========================================== */

function openArtistConnections(artist) {
  if (!CONNECTIONS_ENABLED) {
    return;
  }

  window.location.href =
    "connections.html?artist=" +
    encodeURIComponent(artist.name);
}


/* ==========================================
   ARTIST CARDS
========================================== */

function createArtistCard(artist) {
  const card = document.createElement(
    CONNECTIONS_ENABLED ? "button" : "div"
  );

  if (CONNECTIONS_ENABLED) {
    card.type = "button";
  }

  card.className = "artist-card";

  card.dataset.artist = artist.name;
  card.dataset.genre = artist.genre;

  const picture =
    document.createElement("div");

  picture.className = "artist-picture";

  const placeholder =
    document.createElement("div");

  placeholder.className =
    "artist-picture-placeholder";

  placeholder.textContent = artist.name;

  picture.appendChild(placeholder);

  const genre =
    document.createElement("span");

  genre.className = "artist-genre";

  genre.textContent =
    artist.genre || "Artist";

  const name =
    document.createElement("h3");

  name.className = "artist-name";
  name.textContent = artist.name;

  card.append(picture, genre, name);

  queueMicrotask(async () => {
    if (!card.isConnected) return;

    const image =
      await getArtistImage(artist);

    if (image && card.isConnected) {
      picture.replaceChildren(
        image.cloneNode(true)
      );
    }
  });

  if (CONNECTIONS_ENABLED) {
    card.addEventListener("click", () => {
      openArtistConnections(artist);
    });
  }

  return card;
}


/* ==========================================
   DISPLAY ARTISTS
========================================== */

function showArtists(artists, message = "") {
  if (!artistGrid) return;

  artistGrid.replaceChildren();

  if (!artists.length) {
    const notice =
      document.createElement("p");

    notice.textContent =
      message ||
      "No artists found. Try another search.";

    artistGrid.appendChild(notice);
    return;
  }

  const fragment =
    document.createDocumentFragment();

  artists.forEach(artist => {
    fragment.appendChild(
      createArtistCard(artist)
    );
  });

  artistGrid.appendChild(fragment);
}


/* ==========================================
   BLUE WATER RIPPLE
========================================== */

async function playRipple(callback, artists = []) {
  if (rippleRunning) return;

  rippleRunning = true;

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  let updated = false;

  function updateOnce() {
    if (updated) return;

    updated = true;
    callback();
  }

  try {
    const reduceMotion =
      window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;

    if (!loadingScreen || reduceMotion) {
      updateOnce();
      return;
    }

    loadingScreen.classList.remove(
      "is-fading"
    );

    loadingScreen.hidden = false;

    const rings =
      loadingScreen.querySelectorAll(
        ".ripple-ring"
      );

    rings.forEach(ring => {
      ring.style.animation = "none";

      void ring.offsetWidth;

      ring.style.animation = "";
    });

    await new Promise(resolve => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    const minimumDisplay = wait(1500);

    const preparation =
      Promise.allSettled(
        artists.map(getArtistImage)
      );

    await Promise.race([
      preparation,
      wait(4000)
    ]);

    await minimumDisplay;

    updateOnce();

    await new Promise(resolve => {
      requestAnimationFrame(resolve);
    });

    loadingScreen.classList.add(
      "is-fading"
    );

    await wait(600);

    loadingScreen.hidden = true;

    loadingScreen.classList.remove(
      "is-fading"
    );
  } catch (error) {
    console.warn(
      "Ripple transition failed:",
      error
    );

    updateOnce();

    if (loadingScreen) {
      loadingScreen.hidden = true;

      loadingScreen.classList.remove(
        "is-fading"
      );
    }
  } finally {
    rippleRunning = false;

    if (refreshButton) {
      refreshButton.disabled = false;
    }
  }
}


/* ==========================================
   VERIFIED RESHUFFLE
========================================== */

async function discoverArtists() {
  if (
    rippleRunning ||
    reshufflePreparing
  ) {
    return;
  }

  reshufflePreparing = true;

  searchRequestNumber++;

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  try {
    const selection =
      await Promise.all(
        genres.map(genre =>
          findNextVerifiedArtist(genre)
        )
      );

    if (selection.some(artist => !artist)) {
      console.warn(
        "Not every genre has a verified photo."
      );

      return;
    }

    await playRipple(() => {
      setSearchMode(false);
      showArtists(selection);
      recordDisplayedArtists(selection);
    }, selection);
  } catch (error) {
    console.warn(
      "Reshuffle failed:",
      error
    );
  } finally {
    reshufflePreparing = false;

    if (
      refreshButton &&
      !rippleRunning
    ) {
      refreshButton.disabled = false;
    }
  }
}


/* ==========================================
   SEARCH RELEVANCE
========================================== */

function scoreArtist(artist, query) {
  const name = normalizeName(artist.name);
  const term = normalizeName(query);

  const fans = Number(artist.nb_fan || 0);

  let relevance = 0;

  if (name === term) {
    relevance = 1000000;
  } else if (name.startsWith(term)) {
    relevance = 100000;
  } else if (name.includes(term)) {
    relevance = 10000;
  }

  return relevance +
    Math.log10(fans + 1) * 100;
}


/* ==========================================
   SEARCH QUALITY
========================================== */

function isCredibleSearchResult(
  artist,
  query
) {
  const name = normalizeName(artist.name);
  const term = normalizeName(query);

  if (!name.includes(term)) {
    return false;
  }

  if (isObviousSearchClutter(artist.name)) {
    return false;
  }

  /*
    Exact matches are eligible,
    regardless of fan count.
  */

  if (name === term) {
    return true;
  }

  return Number(artist.nb_fan || 0) >=
    MIN_RELATED_ARTIST_FANS;
}


/* ==========================================
   WORLDWIDE ARTIST SEARCH
   CLEAN, DEDUPLICATED, EXACT-FIRST
========================================== */

async function findWorldwideArtists(query) {
  const candidatesByName = new Map();

  let nextIndex = 0;
  let morePages = true;

  /*
    Gather candidates from Deezer.
  */

  for (
    let page = 0;
    page < SEARCH_MAX_PAGES && morePages;
    page++
  ) {
    const response = await searchDeezer(
      query,
      SEARCH_PAGE_SIZE,
      nextIndex
    );

    for (const artist of response.data) {
      if (!artist?.id || !artist?.name) {
        continue;
      }

      if (!isCredibleSearchResult(
        artist,
        query
      )) {
        continue;
      }

      const nameKey =
        normalizeName(artist.name);

      if (!candidatesByName.has(nameKey)) {
        candidatesByName.set(
          nameKey,
          new Map()
        );
      }

      candidatesByName
        .get(nameKey)
        .set(artist.id, artist);
    }

    morePages =
      Boolean(response.next) &&
      response.data.length > 0;

    nextIndex += SEARCH_PAGE_SIZE;
  }

  /*
    Rank duplicate Deezer entries
    within each unique artist name.
  */

  const groups = [
    ...candidatesByName.values()
  ].map(entriesMap => {
    const entries = [
      ...entriesMap.values()
    ].sort(
      (a, b) =>
        Number(b.nb_fan || 0) -
        Number(a.nb_fan || 0)
    );

    return {
      name: entries[0].name,
      entries,
      score: scoreArtist(
        entries[0],
        query
      )
    };
  });

  groups.sort(
    (a, b) => b.score - a.score
  );

  const queryWords = query
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const exactGroups = groups.filter(
    group =>
      normalizeName(group.name) ===
      normalizeName(query)
  );

  const eligibleGroups =
    queryWords.length > 1 &&
    exactGroups.length > 0
      ? exactGroups
      : groups;

  const selected = [];

  for (const group of eligibleGroups) {
    if (selected.length >= SEARCH_LIMIT) {
      break;
    }

    for (const result of group.entries) {
      const curatedArtist =
        artistLibrary.find(
          artist =>
            normalizeName(artist.name) ===
            normalizeName(result.name)
        );

      const artist = {
        id: result.id,
        name: result.name,
        genre:
          curatedArtist?.genre || "Artist",
        image:
          result.picture_xl ||
          result.picture_big ||
          null
      };

      if (!artist.image) {
        continue;
      }

      const photo =
        await getArtistImage(artist);

      if (!photo) {
        continue;
      }

      selected.push(artist);
      break;
    }
  }

  return selected;
}


/* ==========================================
   ARTIST SEARCH
========================================== */

async function searchArtists(query) {
  if (
    rippleRunning ||
    reshufflePreparing
  ) {
    return;
  }

  const term = query.trim();

  if (!term) {
    restoreHome();
    return;
  }

  const requestId =
    ++searchRequestNumber;

  searchForm?.setAttribute(
    "aria-busy",
    "true"
  );

  let selection = [];
  let errorMessage = "";

  try {
    selection =
      await findWorldwideArtists(term);
  } catch (error) {
    console.warn(
      "Worldwide search failed:",
      error
    );

    /*
      Fall back to curated artists
      when Deezer search fails.
    */

    const matches =
      artistLibrary.filter(artist =>
        artistMatchesSearch(
          artist,
          term
        )
      );

    const checked = await Promise.all(
      matches.map(async artist => {
        const photo =
          await getArtistImage(artist);

        return photo ? artist : null;
      })
    );

    selection = checked
      .filter(Boolean)
      .slice(0, SEARCH_LIMIT);

    if (!selection.length) {
      errorMessage =
        "Artist search is temporarily unavailable.";
    }
  } finally {
    if (
      requestId === searchRequestNumber
    ) {
      searchForm?.removeAttribute(
        "aria-busy"
      );
    }
  }

  if (
    requestId !== searchRequestNumber
  ) {
    return;
  }

  await playRipple(() => {
    setSearchMode(true);

    showArtists(
      selection,
      errorMessage
    );
  }, selection);
}


/* ==========================================
   RETURN HOME
========================================== */

function restoreHome() {
  if (
    rippleRunning ||
    reshufflePreparing
  ) {
    return;
  }

  searchRequestNumber++;

  const artists = getInitialArtists();

  playRipple(() => {
    setSearchMode(false);
    showArtists(artists);
    recordDisplayedArtists(artists);
  }, artists);
}


/* ==========================================
   EVENTS
========================================== */

if (refreshButton) {
  refreshButton.addEventListener(
    "click",
    () => {
      if (
        rippleRunning ||
        reshufflePreparing
      ) {
        return;
      }

      if (searchInput) {
        searchInput.value = "";
      }

      discoverArtists();
    }
  );
}

if (searchForm) {
  searchForm.addEventListener(
    "submit",
    event => {
      event.preventDefault();

      searchArtists(
        searchInput?.value || ""
      );
    }
  );
}

if (homeLink) {
  homeLink.addEventListener(
    "click",
    event => {
      event.preventDefault();

      if (searchInput) {
        searchInput.value = "";
      }

      restoreHome();

      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    }
  );
}


/* ==========================================
   INITIALIZE
========================================== */

initializeDiscoveryQueues();

const initialArtists =
  getInitialArtists();

setSearchMode(false);
showArtists(initialArtists);
