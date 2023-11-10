import axios from 'axios'
import { type ImageService } from '../types/image-service.js'

export class GoogleCSEImages implements ImageService {
  apiKey: string
  searchEngineId: string

  constructor (apiKey: string, searchEngineId: string) {
    this.apiKey = apiKey
    this.searchEngineId = searchEngineId
  }

  async getImagesPathsFromTextPrompt (inputText: string): Promise<string[] | undefined> {
    try {
      const response = await axios.get(`https://www.googleapis.com/customsearch/v1?key=${this.apiKey}&cx=${this.searchEngineId}&searchType=image&q=${encodeURIComponent(inputText)}`)

      // TODO: Sort and try to get a square-ish image so it doesn't look weird
      const images = []
      for (const image of response.data.items) {
        images.push(image.link)
      }
      return images
    } catch (ex) {
      // not sure if this will throw in practice. do some investigating later. could happen if API invalid
      console.log('Failed to request images from CSE API')
      console.log(ex)
      return undefined
    }
  }
}
