import { type DiscordImage } from '../types/discord-image.js'
import { deleteImage } from './image-utils.js'

// helps sort images by their appearance in a message
// mostly only useful when emojis/pings are in play

export class ImageCollection {
  private readonly images: DiscordImage[] = []
  private readonly imagePath: string | undefined

  addImage (image: DiscordImage): void {
    this.images.push(image)
  }

  needsExternalImage (): boolean {
    return this.images.length === 0
  }

  getPath (): string {
    // TODO: Compile into one big canvas
    return this.images[0].path
  }

  async cleanup (): Promise<void> {
    for (const image of this.images) {
      if (image !== undefined) await deleteImage(image.path)
    }
  }
}
