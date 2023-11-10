import { promises as fs } from 'fs'
import { exec } from 'child_process'
import { promisify } from 'util'
import { BEHATED_ERROR_GIF_PATH, BELOVED_ERROR_GIF_PATH, HEART_TEMPLATE_PATH, MAKESWEET_PATH, TRANSCODE_FROM_MP4 } from '../utils/constants.js'
import { type MakesweetGeneration } from '../utils/makesweet-generation.js'
import { GenerationType } from '../types/generation-type.js'

const execAsync = promisify(exec)

export class Makesweet {
  executableExists?: boolean

  async generateWithErrorGif (generation: MakesweetGeneration): Promise<string> {
    const generated = await this.generate(generation)

    if (generated === undefined) {
      generation.failed = true
      return this.errorGifPathFromGenerationType(generation.generationType)
    }
    return generated
  }

  async generate (generation: MakesweetGeneration): Promise<string | undefined> {
    if (this.executableExists === undefined) {
      this.executableExists = await this.exists(MAKESWEET_PATH)
    }

    if (!this.executableExists) {
      console.log('Failed to start makesweet. Make sure you are inside of a docker container!')
      return undefined
    }

    const execString = this.execStringFromGeneration(generation)
    if (execString === undefined) return undefined

    const { stderr } = await execAsync(execString)
    if (stderr !== undefined && stderr !== null && stderr !== '') {
      console.log('Makesweet exec error')
      console.log(stderr)

      return undefined
    }

    return generation.exportPath
  }

  execStringFromGeneration (generation: MakesweetGeneration): string | undefined {
    const imagePath = generation.images.getPath()
    if (imagePath === undefined || generation.textImagePath === undefined || generation.exportPath === undefined) return undefined

    return `${MAKESWEET_PATH} --zip ${HEART_TEMPLATE_PATH} --in ${imagePath} ${generation.textImagePath} ${TRANSCODE_FROM_MP4 ? '--vid' : '--gif'} ${generation.exportPath}`
  }

  errorGifPathFromGenerationType (generationType: GenerationType): string {
    if (generationType === GenerationType.Behated) {
      return BEHATED_ERROR_GIF_PATH
    } else return BELOVED_ERROR_GIF_PATH
  }

  // ??
  async exists (path: string): Promise<boolean> {
    try {
      await fs.stat(path)
      return true
    } catch {
      return false
    }
  }
}
