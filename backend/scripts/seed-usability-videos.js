// Fills the video library of the usability-test environment with many videos with realistic,
// unique names and a random availability (public, selective or private):
//   docker compose exec -e NODE_ENV=development api node scripts/seed-usability-videos.js [bigLoginCode] [total]
// Defaults: YONDER-SPORT-EN-BEWEGING and 500. About half of the videos go to the "big"
// organisation, the rest is spread evenly over all other active organisations. Selective videos
// are shared with 1 to 3 random other organisations. Running it again adds more videos; names
// stay unique, also compared with the videos already in the database.
// Development only: refuses to run with NODE_ENV=production. Like seed-videos.js, the rows point
// to placeholder files: a grey thumbnail and a video file that does not play.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../src/config/env.js'
import { db } from '../src/db/knex.js'
import * as videoStorage from '../src/lib/videoStorage.js'

// 64x32 grey JPEG, the same placeholder as seed-videos.js.
const PLACEHOLDER_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAgAAAQABAAD//gAQTGF2YzYyLjI4LjEwMgD/2wBDAAgQEBMQExYWFhYWFhoYGhsbGxoaGhobGxsdHR0iIiIdHR0bGx0dICAiIiUmJSMjIiMmJigoKDAwLi44ODpFRVP/xABMAAEBAAAAAAAAAAAAAAAAAAAABgEBAQAAAAAAAAAAAAAAAAAAAAQQAQAAAAAAAAAAAAAAAAAAAAARAQAAAAAAAAAAAAAAAAAAAAD/wAARCAAgAEADASIAAhEAAxEA/9oADAMBAAIRAxEAPwCnAWJQAAAAAAAAAAAAAH//2Q==',
  'base64',
)

const SCENARIOS = [
  'Drenkeling in het diepe',
  'Paniek bij de glijbaan',
  'Kind onder water',
  'Bewusteloze zwemmer',
  'Kramp tijdens baantjes trekken',
  'Duik in ondiep water',
  'Verdwaald kind',
  'Ruzie in het water',
  'Snorkelaar in nood',
  'Zwemmer met epilepsie-aanval',
  'Vermoeide zwemmer',
  'Onderkoeling na lang zwemmen',
  'Botsing op de duikplank',
  'Kind zonder zwemdiploma',
  'Spelende groep bij de touwen',
  'Ouder kijkt niet op',
  'Zwemmer raakt onwel na het eten',
  'Hoofdletsel bij de startblokken',
  'Stroming bij de golfslag',
  'Verdrinkingsgevaar bij het speeleiland',
  'Zwemles loopt uit de hand',
  'Valse alarmmelding',
]

const LOCATIONS = [
  'wedstrijdbad',
  'instructiebad',
  'peuterbad',
  'golfslagbad',
  'buitenbad',
  'recreatiebad',
  'duikbak',
  'wildwaterbaan',
  'whirlpool',
  'zwemvijver',
  'speelbad',
]

// Extra variants, so there are far more unique names than videos.
const VARIANTS = ['', ' (versie 2)', ' (kijkrichting links)', ' (met omstanders)', ' (avondsituatie)']

const DESCRIPTIONS = [
  'Oefensituatie voor toezichthouders: let op de signalen voordat het misgaat.',
  'Opgenomen tijdens een openbare zwemmiddag.',
  'Geschikt voor beginnende toezichthouders.',
  'Gebruik deze video in combinatie met de vragen over eerste hulp.',
  'Let op de positie van de toezichthouder in beeld.',
  'Situatie met veel bezoekers; het incident is niet meteen zichtbaar.',
  'Rustige situatie, goed om het scannen van het bad te oefenen.',
]

const VISIBILITIES = ['public', 'public', 'selective', 'selective', 'private']

const randomInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (list) => list[Math.floor(Math.random() * list.length)]

function shuffle(list) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** All possible names in random order, without the names already taken. */
function availableNames(taken) {
  const names = []
  for (const variant of VARIANTS) {
    for (const scenario of SCENARIOS) {
      for (const location of LOCATIONS) names.push(`${scenario} - ${location}${variant}`)
    }
  }
  return shuffle(names.filter((name) => !taken.has(name)))
}

async function writeStored(key, bytes) {
  const file = videoStorage.getPath(key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, bytes)
}

/** Divides `total` videos: about half to the big organisation, the rest evenly over the others. */
function distribute(total, bigId, otherIds) {
  const counts = new Map()
  const bigCount = otherIds.length === 0 ? total : Math.round(total / 2)
  counts.set(bigId, bigCount)
  const rest = total - bigCount
  otherIds.forEach((id, i) => {
    counts.set(id, Math.floor(rest / otherIds.length) + (i < rest % otherIds.length ? 1 : 0))
  })
  return counts
}

export async function seedUsabilityVideos(bigLoginCode, total) {
  if (config.NODE_ENV === 'production') throw new Error('seed-usability-videos must not run in production')

  const organisations = await db('Organisation').whereNull('deletedAt').select('id', 'name', 'loginCode')
  const big = organisations.find((o) => o.loginCode === String(bigLoginCode).trim().toUpperCase())
  if (!big) throw new Error(`No active organisation with code ${bigLoginCode}`)
  const others = organisations.filter((o) => o.id !== big.id)

  const taken = new Set((await db('Video').select('name')).map((v) => v.name))
  const names = availableNames(taken)
  if (names.length < total) throw new Error(`Only ${names.length} unique names left; choose a smaller total.`)

  const counts = distribute(total, big.id, others.map((o) => o.id))
  const summary = new Map()
  let nameIndex = 0

  await db.transaction(async (trx) => {
    for (const organisation of organisations) {
      const count = counts.get(organisation.id) ?? 0
      const perVisibility = { public: 0, selective: 0, private: 0 }
      for (let i = 0; i < count; i++) {
        const keys = videoStorage.newVideoKeys(organisation.id)
        await writeStored(keys.thumbnailStorageKey, PLACEHOLDER_JPEG)
        await writeStored(keys.storageKey, Buffer.from('placeholder'))

        // Selective needs another organisation to share with.
        const visibility = others.length > 0 ? pick(VISIBILITIES) : 'public'
        const [videoId] = await trx('Video').insert({
          ownerOrganisationId: organisation.id,
          name: names[nameIndex++],
          description: Math.random() < 0.5 ? pick(DESCRIPTIONS) : null,
          ...keys,
          fileSizeBytes: randomInt(150, 4000) * 1024 ** 2,
          durationSeconds: randomInt(20, 600),
          visibility,
          // Spread over the last year, so sorting on date shows a realistic mix.
          uploadedAt: new Date(Date.now() - randomInt(0, 365 * 24 * 60) * 60 * 1000),
        })
        perVisibility[visibility]++

        if (visibility === 'selective') {
          const candidates = organisations.filter((o) => o.id !== organisation.id)
          const chosen = shuffle(candidates).slice(0, randomInt(1, Math.min(3, candidates.length)))
          await trx('VideoAccess').insert(chosen.map((o) => ({ videoId, organisationId: o.id })))
        }
      }
      if (count > 0) summary.set(organisation.name, { count, ...perVisibility })
    }
  })
  return summary
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [bigLoginCode = 'YONDER-SPORT-EN-BEWEGING', rawTotal = '500'] = process.argv.slice(2)
  const total = Number(rawTotal)
  if (!Number.isInteger(total) || total <= 0) {
    console.error('Usage: node scripts/seed-usability-videos.js [bigLoginCode] [total]')
    process.exit(1)
  }
  try {
    const summary = await seedUsabilityVideos(bigLoginCode, total)
    console.log(`Created ${total} videos:`)
    for (const [name, s] of summary) {
      console.log(`  ${name}: ${s.count} (public ${s.public}, selective ${s.selective}, private ${s.private})`)
    }
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  } finally {
    await db.destroy()
  }
}
