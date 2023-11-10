import { dirname, importx } from '@discordx/importer'
import type { Interaction, Message } from 'discord.js'
import { IntentsBitField } from 'discord.js'
import { Client } from 'discordx'
import { BingImages } from './external/bing-images.js'
import { FFmpeg } from './external/ffmpeg.js'
import { GoogleCSEImages } from './external/google-cse-images.js'
import { Makesweet } from './external/makesweet.js'
import { GenerationType } from './types/generation-type.js'
import { type ImageService } from './types/image-service.js'
import { DELETE_IMAGES } from './utils/constants.js'
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
    //    IntentsBitField.Flags.GuildMessageReactions,
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

bot.on('messageCreate', async (message: Message) => {
  // void bot.executeCommand(message)
  const generation = new MakesweetGeneration(message)
  try {
    if (generation.generationType === GenerationType.None) return

    void message.channel.sendTyping()
    // try do actually parse stuff
    const generationSuccess = await generation.generateImages(imageService, backupImageService)
    if (!generationSuccess) {
      await error(message, generation)
      return
    }

    // technically could also be mp4
    const belovedGif = await makesweet.generateWithErrorGif(generation)
    let finalPath: string
    // transcode if necessary
    if (!generation.failed && generation.needsTranscode() && generation.ffmpegExportPath !== undefined) {
      finalPath = await ffmpeg.transcodeToGif(belovedGif, generation.ffmpegExportPath, generation.generationType)
    } else {
      finalPath = belovedGif
    }

    await message.reply({ files: [finalPath] }).catch(() => {
      console.log('message failed to send.')
    })

    if (DELETE_IMAGES) {
      await generation.cleanup()
    }
  } catch {
    await error(message, generation)
  }
})

async function error (message: Message, generation: MakesweetGeneration): Promise<void> {
  await message.reply({ files: [makesweet.errorGifPathFromGenerationType(generation.generationType)] }).catch(() => {
    console.log('message failed to send.')
  })
}

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

  // load fonts
  loadGlobalFonts()
}

void run()

// applicable env variables:
// BING_IMAGES_API_KEY
// BOT_TOKEN
// GOOGLE_CSE_ID
// GOOGLE_CSE_API_KEY
