import { type Message } from 'discord.js'
import path from 'path'
import { type Emote } from '../types/emote.js'
import { GenerationType } from '../types/generation-type.js'
import { type ImageService } from '../types/image-service.js'
import { BEHATED_SUFFIX, BELOVED_SUFFIX, IMAGE1_SUFFIX, IMAGE2_SUFFIX, IMAGE_DIRECTORY, ONLY_USE_AVATAR_IMAGE_WHEN_NO_OTHER_TEXT } from './constants.js'
import { downloadImage, saveImageFromBuffer, tryDownloadImageFromArray } from './image-utils.js'
import { getImageOfText } from './text-utils.js'

export class MakesweetGeneration {
  message: Message
  generationType: GenerationType
  // TODO: Probably worth abstracting caption a bit more so I don't have to keep doing getTrimmedCaption calls
  caption: string

  imagePath: string | undefined

  constructor (message: Message) {
    this.message = message
    this.generationType = this.getMessageGenerationType()
    if (this.generationType != null) {
      this.caption = message.cleanContent
    } else {
      // blank string used instead of null to make writing methods less painful
      this.caption = ''
    }
  }

  async generate (imageService: ImageService): Promise<string | undefined> {
    // try do actually parse stuff
    await this.parseMessage()
    await this.generateTextImage()

    if (this.imagePath == null) {
      // image has not been set by message parse, so we'll need to get one from the image service
      const images = await imageService.getImagesPathsFromTextPrompt(this.getTrimmedCaption())
      console.log(images)
      if (images === undefined || images?.length === 0) return undefined

      this.imagePath = this.getImagePathWithSuffix(IMAGE1_SUFFIX)

      const success = await tryDownloadImageFromArray(images, this.imagePath)
      if (!success) return undefined
    }

    // if we've made it to this point, both images exist 100%
    // so we can go ahead and do the makesweet generation
  }

  async parseMessage (): Promise<void> {
    if (this.caption === '') throw new Error('Failed trying to parse message without a caption')
    await this.parseMessageMentions()
    await this.parseEmoteMentions()
  }

  async generateTextImage (): Promise<void> {
    const textImageBuffer = getImageOfText(this.caption)
    const textImagePath = this.getImagePathWithSuffix(IMAGE2_SUFFIX)
    await saveImageFromBuffer(textImageBuffer, textImagePath)
  }

  async parseMessageMentions (): Promise<void> {
    this.message.mentions.members?.each(member => {
      this.caption = this.caption.replace(member.displayName, member.user.username)
    })

    if (this.imagePath !== undefined) return

    // add an image if there's only one mention
    // (TODO: ADD more? somehow combine images for many users?)
    if (this.message.mentions.members?.size === 1) {
      const firstMember = this.message.mentions.members.first()
      if (firstMember !== undefined && (!ONLY_USE_AVATAR_IMAGE_WHEN_NO_OTHER_TEXT || this.getTrimmedCaption() === `@${firstMember?.user.username}`)) {
        // replace first @ instance. this may break if USE_AVATAR_WHEN_MESSAGE_IS_MORE_THAN_PING is true. this should be fixed
        this.caption = this.caption.replace('@', '')
        this.imagePath = this.getImagePathWithSuffix(IMAGE1_SUFFIX)
        await downloadImage(`https://cdn.discordapp.com/avatars/${firstMember.id}/${firstMember.user.avatar}.png`, this.imagePath)
      }
    }
  }

  async parseEmoteMentions (): Promise<void> {
    // probably a way less gross way to do this now. don't wanna rewrite this too much rn tho
    // discord.js surely has an emoji class that would make this way less manual

    const emotes = this.caption.match(/(<:|<a:)([^>]*):\d{19}>|\d{17}>/g)
    const validEmotes: Emote[] = []

    if (emotes == null || emotes.length === 0) return

    for (let i = 0; i < emotes.length; i++) {
      const emote = emotes[i]
      if (!emote.includes(':')) continue // not an emote

      const emoteName = emote.substring(emote.indexOf(':') + 1, emote.lastIndexOf(':'))
      const emoteId = emote.substring(emote.lastIndexOf(':') + 1, emote.lastIndexOf('>'))
      this.caption = this.caption.replace(emote, emoteName)
      validEmotes.push({ name: emoteName, id: emoteId })
    }

    if (this.imagePath !== undefined) return

    if (validEmotes.length === 1 && (!ONLY_USE_AVATAR_IMAGE_WHEN_NO_OTHER_TEXT || this.getTrimmedCaption() === validEmotes[0].name)) {
      // replace first @ instance. this may break if USE_AVATAR_WHEN_MESSAGE_IS_MORE_THAN_PING is true. this should be fixed
      this.caption = this.caption.replace('@', '')
      this.imagePath = this.getImagePathWithSuffix(IMAGE1_SUFFIX)
      await downloadImage(`https://cdn.discordapp.com/emojis/${validEmotes[0].id}.png`, this.imagePath)
    }
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
