import axios from 'axios'
import { promises as fs } from 'fs'
import sharp from 'sharp'

export async function downloadImage (imageUrl: string, exportPath: string): Promise<void> {
  const imageResponse = await axios({ url: imageUrl, responseType: 'arraybuffer' })
  const buffer = Buffer.from(imageResponse.data, 'binary')
  // TODO: Resize/crop options (and a way to auto-detect the best one maybe?)
  await saveResizedImageFromBuffer(buffer, exportPath, 256, 256)
}

export async function saveResizedImageFromBuffer (buffer: Buffer, exportPath: string, width: number, height: number): Promise<void> {
  await sharp(buffer, {})
    .resize(width, height)
    .png()
    .toFile(exportPath)
}

export async function saveImageFromBuffer (buffer: Buffer, exportPath: string): Promise<void> {
  await fs.writeFile(exportPath, buffer)
}
