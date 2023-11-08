import { type Message } from 'discord.js'
import { GenerationType } from '../types/generation-type'

export class MakesweetGeneration {
  message: Message
  generationType: GenerationType
  caption: string | undefined

  image: string | undefined

  constructor (message: Message) {
    this.message = message
    this.generationType = this.getMessageGenerationType()
    if (this.generationType != null) {
      this.caption = message.cleanContent
    }
  }

  async parseMessage (): Promise<void> {
    await this.parseMessageMentions()
  }

  getMessageGenerationType (): GenerationType {
    if (this.messageEndsWithSuffix(this.message, 'my beloved')) return GenerationType.Beloved
    else if (this.messageEndsWithSuffix(this.message, 'my behated')) return GenerationType.Behated
    else return GenerationType.None
  }

  async parseMessageMentions (): Promise<void> {
    this.message.mentions.members?.each(member => {
      this.caption = this.caption?.replace(member.displayName, member.user.username)
    })

    // add an image if there's only one mention (TODO: ADD more? somehow combine images?)

    if (this.message.mentions.members?.size === 1) {
      // TODO: Imamge Stuff
    }
  }

  messageEndsWithSuffix (message: Message, suffix: string): boolean {
    return message.cleanContent.toLowerCase().trim().endsWith(suffix)
  }
}
