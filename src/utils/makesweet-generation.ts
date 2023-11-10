import { type Message } from 'discord.js'
import path from 'path'
import { type Emote } from '../types/emote.js'
import { GenerationType } from '../types/generation-type.js'
import { type ImageService } from '../types/image-service.js'
import { BEHATED_SUFFIX, BELOVED_SUFFIX, FFMPEG_EXPORT_SUFFIX, GIF_EXPORT_SUFFIX, IMAGE1_SUFFIX, IMAGE2_SUFFIX, IMAGE_DIRECTORY, MULTI_IMAGE_SUPPORT, TRANSCODE_FROM_MP4, VIDEO_EXPORT_SUFFIX } from './constants.js'
import { ImageCollection } from './image-collection.js'
import { deleteImage, saveImageFromBuffer, tryDownloadImage, tryDownloadImageFromArray } from './image-utils.js'
import { getImageOfText } from './text-utils.js'

export class MakesweetGeneration {
  message: Message
  generationType: GenerationType
  // TODO: Probably worth abstracting caption a bit more so I don't have to keep doing getTrimmedCaption calls
  caption: string

  images: ImageCollection
  imagePath: string | undefined
  textImagePath: string | undefined
  exportPath: string | undefined
  ffmpegExportPath: string | undefined

  failed: boolean = false

  constructor (message: Message) {
    this.images = new ImageCollection()
    this.message = message
    this.generationType = this.getMessageGenerationType()
    if (this.generationType != null) {
      this.caption = message.cleanContent
    } else {
      // blank string used instead of null to make writing methods less painful
      this.caption = ''
    }
  }

  async generateImages (imageService: ImageService, backupImageService: ImageService | undefined): Promise<boolean> {
    // try do actually parse stuff
    await this.parseMessage()
    await this.generateTextImage()

    if (this.images.needsExternalImage()) {
      const images = await this.getImageUrlsFromService(imageService, backupImageService)
      if (images === undefined) return false
      for (let i = 0; i < images.length; i++) {
        this.images.addImage({ backups: images, index: 99999 + i })
      }
    }

    this.imagePath = this.getImagePathWithSuffix(IMAGE1_SUFFIX)
    const exportedImageSuccess = await this.images.export(this.imagePath)
    if (!exportedImageSuccess) return false
    this.exportPath = this.getImagePathWithSuffix(TRANSCODE_FROM_MP4 ? VIDEO_EXPORT_SUFFIX : GIF_EXPORT_SUFFIX)
    this.ffmpegExportPath = this.getImagePathWithSuffix(FFMPEG_EXPORT_SUFFIX)
    // if we've made it to this point, both images exist 100%
    return true
  }

  async getImageUrlsFromService (imageService: ImageService, backupImageService: ImageService | undefined): Promise<string[] | undefined> {
    // image has not been set by message parse, so we'll need to get one from the image service
    let images = await this.tryGenerateImagesFromService(imageService)
    // try again with the backup image service if it exists
    if (images === undefined && backupImageService !== undefined) {
      console.log(`Main image failed for ${this.getTrimmedCaption()}. Attempting secondary image service`)
      images = await this.tryGenerateImagesFromService(backupImageService)
    }

    if (images === undefined) return undefined

    return images
  }

  async tryGenerateImagesFromService (imageService: ImageService): Promise<string[] | undefined> {
    const images = await imageService.getImagesPathsFromTextPrompt(this.getTrimmedCaption())
    // console.log(images)
    if (images === undefined || images?.length === 0) return undefined

    return images
  }

  async parseMessage (): Promise<void> {
    if (this.caption === '') throw new Error('Failed trying to parse message without a caption')
    await this.parseMessageMentions()
    await this.parseEmoteMentions()
  }

  async generateTextImage (): Promise<void> {
    const textImageBuffer = getImageOfText(this.caption)
    this.textImagePath = this.getImagePathWithSuffix(IMAGE2_SUFFIX)
    await saveImageFromBuffer(textImageBuffer, this.textImagePath)
  }

  async parseMessageMentions (): Promise<void> {
    this.message.mentions.members?.each(member => {
      this.caption = this.caption.replace(member.displayName, member.user.username)
    })

    if (!this.needsMoreImages() || this.message.mentions.members === null) return

    // a bit scuffed to work around .cleanContent - ideally in the future we would use message.content and just parse users ourselves
    // definitely not the ideal way to do this but i just need something that lets me get indexes for now
    for (const member of this.message.mentions.members) {
      if (!this.needsMoreImages()) break
      if (member[1].user?.username === null) continue
      const regex = new RegExp(`@${member[1].id}`, 'g') // doesn't need to be exact, just Good Enough to sort
      let match
      while ((match = regex.exec(this.message.content)) !== null) {
        if (!this.needsMoreImages()) break
        // download image
        this.caption = this.caption.replace(`@${member[1].user.username}`, member[1].user.username) // replace once for the single ping
        const image = await tryDownloadImage(`https://cdn.discordapp.com/avatars/${member[1].id}/${member[1].user.avatar}.png?size=256`)
        if (image === undefined) continue

        this.images.addImage({ buffer: image, index: match.index })
      }
    }
  }

  async parseEmoteMentions (): Promise<void> {
    // probably a way less gross way to do this now. don't wanna rewrite this too much rn tho
    // discord.js surely has an emoji class that would make this way less manual

    const emotes = this.caption.match(/(<:|<a:)([^>]*):\d{17,19}>/g)
    const validEmotes: Emote[] = []

    if (emotes == null || emotes.length === 0) return

    for (let i = 0; i < emotes.length; i++) {
      const emote = emotes[i]
      if (!emote.includes(':')) continue // not an emote

      const emoteName = emote.substring(emote.indexOf(':') + 1, emote.lastIndexOf(':'))
      const emoteId = emote.substring(emote.lastIndexOf(':') + 1, emote.lastIndexOf('>'))
      validEmotes.push({ name: emoteName, id: emoteId, index: this.caption.indexOf(emote) })
      this.caption = this.caption.replace(emote, emoteName)
    }

    if (!this.needsMoreImages()) return

    for (const emote of validEmotes) {
      if (!this.needsMoreImages()) break
      // download image
      const image = await tryDownloadImage(`https://cdn.discordapp.com/emojis/${emote.id}.png?size=256`)
      if (image === undefined) continue
      this.images.addImage({ buffer: image, index: emote.index })
    }
  }

  async cleanup (): Promise<void> {
    if (this.imagePath !== undefined) await deleteImage(this.imagePath)
    if (this.textImagePath !== undefined) await deleteImage(this.textImagePath)
    if (this.exportPath !== undefined) await deleteImage(this.exportPath)
    if (this.needsTranscode() && this.ffmpegExportPath !== undefined) await deleteImage(this.ffmpegExportPath)
  }

  needsTranscode (): boolean {
    // if TRANSCODE_FROM_MP4 OFF:
    // beloved exportPath
    // behated ffmpegExportPath
    // if TRANSCODE_FROM_MP4 ON:
    // beloved ffmpegExportPath
    // behated ffmpegExportPath
    if (!TRANSCODE_FROM_MP4) {
      return this.generationType === GenerationType.Behated
    }

    return true
  }

  needsMoreImages (): boolean {
    return MULTI_IMAGE_SUPPORT || this.images.needsExternalImage()
  }

  getImagePathWithSuffix (suffix: string): string {
    return path.join(IMAGE_DIRECTORY, this.message.id + suffix)
  }

  getMessageGenerationType (): GenerationType {
    if (this.messageEndsWithSuffix(this.message, this.textFromGenerationType(GenerationType.Beloved))) return GenerationType.Beloved
    else if (this.messageEndsWithSuffix(this.message, this.textFromGenerationType(GenerationType.Behated))) return GenerationType.Behated
    else return GenerationType.None
  }

  messageEndsWithSuffix (message: Message, suffix: string): boolean {
    return message.cleanContent.toLowerCase().trim().endsWith(suffix)
  }

  // low tech method used when checking for ONLY a certain type of text present (eg, only pinging a user)
  getTrimmedCaption (): string {
    // TODO Turn the generationtext-text conversions into a proper method
    const generationText = this.textFromGenerationType()
    return this.caption.substring(0, this.caption.lastIndexOf(generationText)).trim()
  }

  textFromGenerationType (generationType: GenerationType = this.generationType): string {
    if (generationType === GenerationType.Beloved) {
      return BELOVED_SUFFIX
    } else if (generationType === GenerationType.Behated) {
      return BEHATED_SUFFIX
    } else {
      return ''
    }
  }
}
