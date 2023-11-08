import type {
  MessageActionRowComponentBuilder
} from 'discord.js'
import {
  ActionRowBuilder, StringSelectMenuBuilder,
  CommandInteraction,
  StringSelectMenuInteraction
} from 'discord.js'
import { Discord, SelectMenuComponent, Slash } from 'discordx'

const roles = [
  { label: 'Principal', value: 'principal' },
  { label: 'Teacher', value: 'teacher' },
  { label: 'Student', value: 'student' }
]

@Discord()
export class Example {
  @SelectMenuComponent({ id: 'role-menu' })
  async handle (interaction: StringSelectMenuInteraction): Promise<unknown> {
    await interaction.deferReply()

    // extract selected value by member
    const roleValue = interaction.values?.[0]

    // if value not found
    if (roleValue === null || roleValue === undefined || roleValue === '') {
      return await interaction.followUp('invalid role id, select again')
    }

    await interaction.followUp(
      `you have selected role: ${
        roles.find((r) => r.value === roleValue)?.label ?? 'unknown'
      }`
    )
  }

  @Slash({ description: 'roles menu', name: 'my_roles' })
  async myRoles (interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply()

    // create menu for roles
    const menu = new StringSelectMenuBuilder()
      .addOptions(roles)
      .setCustomId('role-menu')

    // create a row for message actions
    const buttonRow =
      new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
        menu
      )

    // send it
    void interaction.editReply({
      components: [buttonRow],
      content: 'select your role!'
    })
  }
}
