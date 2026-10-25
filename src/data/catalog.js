// Placeholder catalog. All titles are fictional. Swap videoUrl (or add youtubeId) per title to wire real content.
const SAMPLE = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'

const raw = [
  ['Thunder Rangers', 'tv', 'Action', 'Five teens and one ancient power crystal stand between the city and the Shadow Legion.', 'jetix'],
  ['Galaxy Kids', 'tv', 'Sci-Fi', 'A misfit crew of space cadets accidentally steal the fastest ship in the fleet.', 'jetix'],
  ['Spin Masters', 'tv', 'Action', 'Spinning-top battles decide the fate of the underground arenas.', 'jetix'],
  ['Robo Fusion', 'tv', 'Sci-Fi', 'Two brothers merge their robots to fight a rogue AI.', 'jetix'],
  ['Kung Fu Critters', 'tv', 'Comedy', 'Martial-arts animals defend a sleepy mountain village.', 'jetix'],
  ['Shadow Ninja X', 'tv', 'Action', 'A schoolboy by day, a masked ninja by night.', 'jetix'],
  ['Little Titan', 'tv', 'Adventure', 'A small boy with giant strength keeps his village safe.', 'pogo'],
  ['Funny Fables', 'tv', 'Comedy', 'Classic folk tales retold with chaotic twists.', 'pogo'],
  ['Mad Labs', 'tv', 'Kids', 'Crazy science experiments you should never try at home.', 'pogo'],
  ['Desi Detectives', 'tv', 'Mystery', 'Three kids solve neighbourhood mysteries on bicycles.', 'pogo'],
  ['Cricket Champs', 'tv', 'Sports', 'An underdog street team aims for the national trophy.', 'pogo'],
  ['Magic Pencil', 'tv', 'Fantasy', 'Whatever Raju draws comes to life, for better or worse.', 'pogo'],
  ['Toon Toon Show', 'tv', 'Comedy', 'Slapstick shorts starring a cat, a dog and a very angry duck.', 'toonz'],
  ['Basement Genius', 'tv', 'Sci-Fi', 'A ten-year-old inventor hides a rocket workshop under the stairs.', 'toonz'],
  ['Penguin Patrol', 'tv', 'Action', 'Three super-powered penguin sisters guard Iceberg City.', 'toonz'],
  ['Scaredy Pup', 'tv', 'Horror', 'A nervous puppy keeps saving his family from spooky things.', 'toonz'],
  ['Pumpkin Ronin', 'tv', 'Action', 'A wandering pumpkin swordsman searches for the way home.', 'toonz'],
  ['Elemental Tamers', 'tv', 'Anime', 'Tamers and their elemental beasts compete for the crown.', 'otaku'],
  ['Seven Stars Saga', 'tv', 'Anime', 'Seven fallen stars, one wish, and a boy who refuses to give up.', 'otaku'],
  ['Byte World', 'tv', 'Anime', 'Kids fall into a computer world full of shape-shifting creatures.', 'otaku'],
  ['Blade Spirits', 'tv', 'Anime', 'Swordsmen bound to spirit weapons duel across ancient lands.', 'otaku'],
  ['Pixel Quest', 'tv', 'Adventure', 'Two gamers get sucked into the retro game they were playing.', 'retro'],
  ['Saturday Morning Club', 'tv', 'Comedy', 'A Saturday morning variety block, rebuilt for the streaming era.', 'retro'],
  ['Midnight Express', 'movie', 'Thriller', 'One night, one train, one passenger who should not exist.'],
  ['The Last Monsoon', 'movie', 'Drama', 'A family reunites in their flooded ancestral village.'],
  ['Neon Racers', 'movie', 'Action', 'Illegal street racing in a cyberpunk Mumbai.'],
  ['Ocean Heart', 'movie', 'Romance', 'Two marine biologists fall in love while saving a reef.'],
  ['Deep Space 9000', 'movie', 'Sci-Fi', 'The last crew of a dying colony ship wakes up early.'],
  ['Haunted Haveli', 'movie', 'Horror', 'An inherited mansion comes with uninvited residents.'],
  ['Laugh Riot', 'movie', 'Comedy', 'A failed stand-up comic becomes an accidental politician.'],
  ['The Heist Code', 'movie', 'Thriller', 'Hackers plan to rob the most secure bank on Earth.'],
  ['Mountain King', 'movie', 'Adventure', 'A climber attempts the unclimbable northern face.'],
  ['Silent Witness', 'movie', 'Mystery', 'A deaf painter sketches the face of a killer.'],
  ['Kingdom of Ash', 'tv', 'Fantasy', 'Rival houses fight for a throne made of ash and fire.'],
  ['Code Red', 'tv', 'Thriller', 'An ER team handles one impossible night shift.'],
  ['Street Kitchen', 'tv', 'Documentary', 'The stories behind the best roadside food in Asia.'],
  ['The Lab Files', 'tv', 'Documentary', 'Real scientists recreate famous experiments.'],
]

const maturities = ['U', 'U/A 7+', 'U/A 13+', 'U/A 16+', 'A']

export function hash(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export const titles = raw.map(([name, type, genre, synopsis, channel], i) => {
  const h = hash(name)
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, ''),
    name, type, genre, synopsis, channel: channel || null,
    year: 1998 + (h % 27),
    maturity: channel ? maturities[h % 2] : maturities[2 + (h % 3)],
    match: 80 + (h % 19),
    seasons: type === 'tv' ? 1 + (h % 5) : 0,
    duration: type === 'movie' ? `${1 + (h % 2)}h ${10 + (h % 50)}m` : null,
    hue: h % 360,
    isNew: i % 6 === 0,
    videoUrl: SAMPLE,
  }
})

export const byId = Object.fromEntries(titles.map(t => [t.id, t]))

export function episodesFor(t) {
  if (t.type !== 'tv') return []
  return Array.from({ length: 6 }, (_, i) => ({
    n: i + 1, name: `Episode ${i + 1}`, minutes: 20 + ((hash(t.id) + i * 7) % 25),
    blurb: `${t.name}, part ${i + 1}. The story takes an unexpected turn.`,
  }))
}

const shuffle = (arr, seed) => [...arr].sort((a, b) => (hash(a.id + seed) % 100) - (hash(b.id + seed) % 100))

export function rowsFor(type) {
  const pool = type ? titles.filter(t => (type === 'new' ? t.isNew : t.type === type)) : titles
  const genres = [...new Set(pool.map(t => t.genre))]
  return [
    { title: 'Trending Now', items: shuffle(pool, 'trend') },
    { title: 'Top 10 Today', items: shuffle(pool, 'top').slice(0, 10), top10: true },
    { title: 'Nostalgia: 90s & 2000s Toons', items: pool.filter(t => t.channel) },
    { title: 'New Releases', items: shuffle(pool.filter(t => t.isNew), 'new') },
    ...genres.slice(0, 6).map(g => ({ title: `${g} Picks`, items: pool.filter(t => t.genre === g) })),
  ].filter(r => r.items.length)
}

export function search(q) {
  q = q.trim().toLowerCase()
  if (!q) return []
  return titles.filter(t => [t.name, t.genre, t.channel || ''].some(f => f.toLowerCase().includes(q)))
}
