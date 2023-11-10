import axios from 'axios'
import { promises as fs } from 'fs'
import sharp from 'sharp'
import { MAX_IMAGE_RETRY_BEFORE_CANCELLING, STRETCH_IMAGES } from './constants.js'

export async function downloadImage (imageUrl: string, exportPath: string): Promise<void> {
  const imageResponse = await axios({ url: imageUrl, responseType: 'arraybuffer' })
  const buffer = Buffer.from(imageResponse.data, 'binary')
  // TODO: Resize/crop options (and a way to auto-detect the best one maybe?)
  await saveResizedImageFromBuffer(buffer, exportPath, 256, 256)
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

export async function tryDownloadImage (image: string, exportPath: string): Promise<boolean> {
  return await tryDownloadImageFromArray([image], exportPath)
}

// TODO: Add some sort of delay here just in case it starts spamming requests
export async function tryDownloadImageFromArray (images: string[], exportPath: string, attempt: number = 0, maxTries: number = MAX_IMAGE_RETRY_BEFORE_CANCELLING): Promise<boolean> {
  if (attempt > maxTries || attempt === images.length) return false
  const image = images[attempt]

  if (image === undefined) return false
  // now actually attempt to download image
  try {
    await downloadImage(image, exportPath)
    return true
  } catch (ex) {
    console.log(`Error while trying to download image ${image}`)
    console.log(ex)
    return await tryDownloadImageFromArray(images, exportPath, attempt + 1, maxTries)
  }
}

export async function deleteImage (path: string): Promise<void> {
  await fs.unlink(path).catch(err => {
    console.log('Failed to delete file:' + err)
  })
}
