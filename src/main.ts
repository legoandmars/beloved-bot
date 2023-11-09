import { dirname, importx } from '@discordx/importer'
import type { Interaction, Message } from 'discord.js'
import { IntentsBitField } from 'discord.js'
import { Client } from 'discordx'
import { BingImages } from './external/bing-images.js'
import { FFmpeg } from './external/ffmpeg.js'
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
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.GuildMessageReactions,
    IntentsBitField.Flags.GuildVoiceStates,
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
  if (generation.generationType === GenerationType.None) return

  void message.channel.sendTyping()
  // try do actually parse stuff
  const generationSuccess = await generation.generateImages(imageService)
  if (!generationSuccess) {
    // throw error
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

  if (process.env.BING_IMAGES_API_KEY === undefined) {
    throw Error('Could not find BING_IMAGES_API_KEY in your environment')
  }

  // Log in with your bot token
  await bot.login(process.env.BOT_TOKEN)

  // Pass token to ImageService
  imageService = new BingImages(process.env.BING_IMAGES_API_KEY)

  // load fonts
  loadGlobalFonts()
}

void run()

// applicable env variables:
// BING_IMAGES_API_KEY
// BOT_TOKEN
