import { createCanvas, Image, type SKRSContext2D } from '@napi-rs/canvas'
import { type DiscordImage } from '../types/discord-image.js'
import { MULTI_IMAGE_SUPPORT } from './constants.js'
import { bufferFromDiscordImage, deleteImage, saveImageFromBuffer, tryDownloadImage } from './image-utils.js'

// helps sort images by their appearance in a message
// mostly only useful when emojis/pings are in play

export class ImageCollection {
  private images: DiscordImage[] = []
  private readonly imagePath: string | undefined

  addImage (image: DiscordImage): void {
    this.images.push(image)
  }

  needsExternalImage (): boolean {
    return this.images.length === 0
  }

  async export (exportPath: string): Promise<boolean> {
    // TODO: Compile into one big canvas
    this.images = this.images.sort((a: DiscordImage, b: DiscordImage) => a.index - b.index)

    const buffer = await this.combineImages()
    if (buffer === undefined) return false

    await saveImageFromBuffer(buffer, exportPath)
    return true
  }

  async combineImages (width: number = 256, height: number = 256): Promise<Buffer | undefined> {
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    // overlay images
    const imageWidth = 256 / this.images.length
    for (let i = 0; i < this.images.length; i++) {
      const image = this.images[i]
      await this.attemptOverlayImageOnCanvas(image, ctx, i * imageWidth, 0, imageWidth, 256)
    }

    return await canvas.encode('png')
  }

  async attemptOverlayImageOnCanvas (image: DiscordImage, ctx: SKRSContext2D, x: number, y: number, width: number, height: number): Promise<boolean> {
    let attempts = -1
    const maxAttempts = image.backups === undefined ? 1 : 1 + image.backups.length
    // canvas image API is really weird. this is way too complex for what it needs to be
    // TODO: rewrite in sharp
    while (attempts < maxAttempts) {
      const buffer = await bufferFromDiscordImage(image, attempts)
      attempts++
      if (buffer === undefined) continue

      // attempt to write onto canvas
      try {
        const canvasImage = new Image()
        canvasImage.src = buffer
        ctx.drawImage(canvasImage, x, y, width, height) // idk if this will actually throw but it should ?
        return true
      } catch {
        continue
      }
    }

    return false
  }
}
