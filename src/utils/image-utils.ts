import axios from 'axios'
import { promises as fs } from 'fs'
import sharp from 'sharp'
import { type DiscordImage } from '../types/discord-image.js'
import { MAX_IMAGE_RETRY_BEFORE_CANCELLING, STRETCH_IMAGES } from './constants.js'

export async function downloadImage (imageUrl: string): Promise<Buffer> {
  const imageResponse = await axios({ url: imageUrl, responseType: 'arraybuffer' })
  return Buffer.from(imageResponse.data, 'binary')
  // TODO: Resize/crop options (and a way to auto-detect the best one maybe?)
  // await saveResizedImageFromBuffer(buffer, exportPath, 256, 256)
}

export async function bufferFromDiscordImage (image: DiscordImage, index: number): Promise<Buffer | undefined> {
  // index 0 is buffer
  // index 1+ is backups
  let buffer: Buffer | undefined

  if (image.buffer !== undefined && index === 0) {
    buffer = image.buffer
  } else if (image.backups !== undefined && index > 0) {
    const backupIndex = index - 1
    if (image.backups.length <= backupIndex + 1) {
      const backup = image.backups[backupIndex]
      buffer = await tryDownloadImage(backup)
    }
  }

  return buffer
}

export async function saveResizedImageFromBuffer (buffer: Buffer, exportPath: string, width: number, height: number): Promise<void> {
  await sharp(buffer, {})
    .resize(width, height, { fit: STRETCH_IMAGES ? 'fill' : 'cover' })
    .png()
    .toFile(exportPath)
}

export async function saveImageFromBuffer (buffer: Buffer, exportPath: string): Promise<void> {
  await fs.writeFile(exportPath, buffer)
}

export async function tryDownloadImage (image: string, suppressErrors: boolean = false): Promise<Buffer | undefined> {
  return await tryDownloadImageFromArray([image], 0, MAX_IMAGE_RETRY_BEFORE_CANCELLING, suppressErrors)
}

// TODO: Add some sort of delay here just in case it starts spamming requests
export async function tryDownloadImageFromArray (images: string[], attempt: number = 0, maxTries: number = MAX_IMAGE_RETRY_BEFORE_CANCELLING, suppressErrors: boolean = false): Promise<Buffer | undefined> {
  if (attempt > maxTries || attempt === images.length) return undefined
  const image = images[attempt]

  if (image === undefined) return undefined
  // now actually attempt to download image
  try {
    const downloadedImage = await downloadImage(image)
    return downloadedImage
  } catch (ex) {
    if (!suppressErrors) {
      console.log(`Error while trying to download image ${image}`)
      console.log(ex)
    }
    return await tryDownloadImageFromArray(images, attempt + 1, maxTries)
  }
}

export async function deleteImage (path: string): Promise<void> {
  await fs.unlink(path).catch(err => {
    console.log('Failed to delete file:' + err)
  })
}
