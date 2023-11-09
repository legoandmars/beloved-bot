import axios from 'axios'
import { type ImageService } from '../types/image-service.js'

export class BingImages implements ImageService {
  apiKey: string
  constructor (apiKey: string) {
    this.apiKey = apiKey
  }

  async getImagesPathsFromTextPrompt (inputText: string): Promise<string[] | undefined> {
    try {
      const response = await axios.get(`https://api.bing.microsoft.com/v7.0/images/search?safeSearch=moderate&q=${encodeURIComponent(inputText)}`, {
        headers: {
          'Ocp-Apim-Subscription-Key': process.env.BING_IMAGES_API_KEY
        }
      })

      // TODO: Sort and try to get a square-ish image so it doesn't look weird
      const images = []
      for (const image of response.data.value) {
        images.push(image.contentUrl)
      }
      return images
    } catch (ex) {
      // not sure if this will throw in practice. do some investigating later. could happen if API invalid
      console.log('Failed to request images from Bing API')
      console.log(ex)
      return undefined
    }
  }
}
