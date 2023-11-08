import { CommandInteraction } from 'discord.js'
import type { Message } from 'discord.js'
import {
  SimpleCommandMessage,
  Discord,
  SimpleCommand,
  SimpleCommandOption,
  SimpleCommandOptionType,
  Slash
} from 'discordx'

@Discord()
export class Example {
  @SimpleCommand({ aliases: ['hi'] })
  hello (command: SimpleCommandMessage): void {
    if (command.message.member !== null) {
      void command.message.reply(`👋 ${command.message.member.toString()}`)
    }
  }

  @SimpleCommand({ argSplitter: '+' })
  sum (
    @SimpleCommandOption({ name: 'num1', type: SimpleCommandOptionType.Number })
      num1: number | undefined,
      @SimpleCommandOption({ name: 'num2', type: SimpleCommandOptionType.Number })
      num2: number | undefined,
      command: SimpleCommandMessage
  ): void {
    if (num1 === undefined || num2 === undefined) {
      void command.sendUsageSyntax()
      return
    }
    void command.message.reply(`total = ${num1 + num2}`)
  }

  // make single handler for simple and slash command
  likeIt (command: CommandInteraction | Message): void {
    void command.reply('I like it, Thanks')
  }

  @SimpleCommand({ name: 'like-it' })
  simpleLikeIt (command: SimpleCommandMessage): void {
    this.likeIt(command.message)
  }

  @Slash({ description: 'like-ite', name: 'like-it' })
  slashLikeIt (command: CommandInteraction): void {
    this.likeIt(command)
  }
}
