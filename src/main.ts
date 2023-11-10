import { dirname, importx } from '@discordx/importer'
import type { Interaction, Message, MessageReaction, User } from 'discord.js'
import { IntentsBitField } from 'discord.js'
import { Client } from 'discordx'
import { promises as fs, writeFileSync } from 'fs'
import { BingImages } from './external/bing-images.js'
import { FFmpeg } from './external/ffmpeg.js'
import { GoogleCSEImages } from './external/google-cse-images.js'
import { Makesweet } from './external/makesweet.js'
import { GenerationType } from './types/generation-type.js'
import { type ImageService } from './types/image-service.js'
import { DELETE_IMAGES } from './utils/constants.js'
import { deleteImage } from './utils/image-utils.js'
import { MakesweetGeneration } from './utils/makesweet-generation.js'
import { loadGlobalFonts } from './utils/text-utils.js'

export const bot = new Client({
  // To use only guild command
  // botGuilds: [(client) => client.guilds.cache.map((guild) => guild.id)],

  // Discord intents
  intents: [
    IntentsBitField.Flags.Guilds,
    //     IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    // IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.MessageContent
  ],

  // Debug logs are disabled in silent mode
  silent: false,

  // Configuration for @SimpleCommand
  simpleCommand: {
    prefix: '!'
  }
})

// TODO make this actually gracefully handle the api key failing & add warnings when certain env variables missing
let imageService: ImageService
let backupImageService: ImageService | undefined

const makesweet: Makesweet = new Makesweet()
const ffmpeg: FFmpeg = new FFmpeg()

bot.once('ready', async () => {
  // Make sure all guilds are cached
  // await bot.guilds.fetch();

  // Synchronize applications commands with Discord
  // await bot.initApplicationCommands()

  // To clear all guild commands, uncomment this line,
  // This is useful when moving from guild commands to global commands
  // It must only be executed once
  //
  //  await bot.clearApplicationCommands(
  //    ...bot.guilds.cache.map((g) => g.id)
  //  );

  console.log('Bot started')
})

bot.on('interactionCreate', (interaction: Interaction) => {
  bot.executeInteraction(interaction)
})
let counter: any

bot.on('messageCreate', async (message: Message) => {
  // void bot.executeCommand(message)
  const generation = new MakesweetGeneration(message)
  if (generation.generationType === GenerationType.None) return

  void message.channel.sendTyping()
  // try do actually parse stuff
  const generationSuccess = await generation.generateImages(imageService, undefined)
  if (!generationSuccess) {
    // throw error
    return
  }

  // technically could also be mp4
  const belovedGif = await makesweet.generateWithErrorGif(generation)
  let finalPath: string
  // transcode if necessary
  if (!generation.failed && generation.needsTranscode() && generation.ffmpegExportPath !== undefined) {
    if (generationSuccess) finalPath = await ffmpeg.transcodeToGif(belovedGif, generation.ffmpegExportPath, generation.generationType)
    finalPath = await ffmpeg.transcodeToGif(belovedGif, generation.ffmpegExportPath, generation.generationType)
  } else {
    finalPath = belovedGif
  }

  const newFinalPath = finalPath.replace('.gif', '-2.gif')
  await fs.copyFile(finalPath, newFinalPath)
  finalPath = newFinalPath

  // do it all again
  if (generation.searched) generation.imagePath = undefined
  const generationSuccessTwo = await generation.generateImages(backupImageService as ImageService, undefined)
  if (!generationSuccessTwo) {
    // throw error
    return
  }

  // technically could also be mp4
  const belovedGifTwo = await makesweet.generateWithErrorGif(generation)
  let finalPathTwo: string
  // transcode if necessary
  if (!generation.failed && generation.needsTranscode() && generation.ffmpegExportPath !== undefined) {
    if (generationSuccessTwo) finalPathTwo = await ffmpeg.transcodeToGif(belovedGifTwo, generation.ffmpegExportPath, generation.generationType)
    finalPathTwo = await ffmpeg.transcodeToGif(belovedGifTwo, generation.ffmpegExportPath, generation.generationType)
  } else {
    finalPathTwo = belovedGifTwo
  }

  await message.reply({ content: 'This is a temporary API test. Please react for the GIF you like the most.', files: [finalPath, finalPathTwo] }).then(async (sentMessage) => {
    await sentMessage.react('1️⃣')
    await sentMessage.react('2️⃣')

    // Set up a reaction collector
    const filter = (reaction: MessageReaction, user: User): any => reaction.emoji.name !== null && ['1️⃣', '2️⃣'].includes(reaction.emoji.name) && !user.bot
    const collector = sentMessage.createReactionCollector({ filter, time: 150000, dispose: true })

    collector.on('collect', (reaction, user) => {
      // Update the counters based on reaction
      if (reaction.emoji.name === null) return
      if (reaction.emoji.name === '1️⃣') {
        counter.one += 1
        console.log('Vote for one')
      } else if (reaction.emoji.name === '2️⃣') {
        counter.two += 1
        console.log('Vote for two')
      } else {
        return
      }

      // Write the updated counter back to the file
      writeFileSync('./images/results.json', JSON.stringify(counter))
    })

    collector.on('remove', (reaction, user) => {
      // Update the counters based on reaction
      if (reaction.emoji.name === null) return
      if (reaction.emoji.name === '1️⃣') {
        counter.one -= 1
        console.log('Vote removed for one')
      } else if (reaction.emoji.name === '2️⃣') {
        counter.two -= 1
        console.log('Vote removed for two')
      } else {
        return
      }

      // Write the updated counter back to the file
      writeFileSync('./images/results.json', JSON.stringify(counter))
    })

    collector.on('end', collected => {
      console.log(`Collected ${collected.size} reactions`)
    })
  }).catch(() => {
    console.log('message failed to send.')
  })

  if (DELETE_IMAGES) {
    await generation.cleanup()
    await deleteImage(finalPath)
  }
})

async function run (): Promise<void> {
  // The following syntax should be used in the commonjs environment
  //
  // await importx(__dirname + "/{events,commands}/**/*.{ts,js}");

  // The following syntax should be used in the ECMAScript environment
  await importx(`${dirname(import.meta.url)}/{events,commands}/**/*.{ts,js}`)

  // Let's start the bot
  if (process.env.BOT_TOKEN === undefined) {
    throw Error('Could not find BOT_TOKEN in your environment')
  }

  const bingApiAvailable = process.env.BING_IMAGES_API_KEY !== undefined
  const googleApiAvailable = process.env.GOOGLE_CSE_ID !== undefined && process.env.GOOGLE_CSE_API_KEY !== undefined

  // todo rewrite/give the user priority choice
  // Pass tokens to ImageService
  if (bingApiAvailable && googleApiAvailable) {
    imageService = new GoogleCSEImages(process.env.GOOGLE_CSE_API_KEY as string, process.env.GOOGLE_CSE_ID as string)
    backupImageService = new BingImages(process.env.BING_IMAGES_API_KEY as string)
  } else if (bingApiAvailable) {
    imageService = new BingImages(process.env.BING_IMAGES_API_KEY as string)
    backupImageService = undefined
  } else if (googleApiAvailable) {
    imageService = new GoogleCSEImages(process.env.GOOGLE_CSE_API_KEY as string, process.env.GOOGLE_CSE_ID as string)
    backupImageService = undefined
  } else {
    throw Error('Could not find BING_IMAGES_API_KEY or (GOOGLE_CSE_ID and GOOGLE_CSE_API_KEY) in your environment')
  }

  // Log in with your bot token
  await bot.login(process.env.BOT_TOKEN)

  // attempt to init temporary counter
  try {
    const counterFile = await fs.readFile('./images/results.json', 'utf-8')
    counter = JSON.parse(counterFile)
  } catch {
    counter = { one: 0, two: 0 }
  }
  // load fonts
  loadGlobalFonts()
}

void run()

// applicable env variables:
// BING_IMAGES_API_KEY
// BOT_TOKEN
// GOOGLE_CSE_ID
// GOOGLE_CSE_API_KEY
