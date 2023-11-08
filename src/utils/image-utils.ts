import axios from 'axios'
import sharp from 'sharp'

export async function downloadImage (imageUrl: string, exportPath: string): Promise<void> {
  const imageResponse = await axios({ url: imageUrl, responseType: 'arraybuffer' })
  const buffer = Buffer.from(imageResponse.data, 'binary')
  // TODO: Resize/crop options (and a way to auto-detect the best one maybe?)
  await sharp(buffer, {})
    .resize(256, 256)
    .png()
    .toFile(exportPath)
}
