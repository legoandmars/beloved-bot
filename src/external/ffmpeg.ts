import { exec } from 'child_process'
import { promisify } from 'util'
import { GenerationType } from '../types/generation-type.js'

const execAsync = promisify(exec)

export class FFmpeg {
  async transcodeToGif (belovedGif: string, exportPath: string, generationType: GenerationType): Promise<string> {
    const videoEffects = (generationType === GenerationType.Behated ? 'format=gray,reverse,' : '') + 'split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse'

    await execAsync(`ffmpeg -y -i ${belovedGif} -vf "${videoEffects}" ${exportPath}`)
    /* if (stderr !== undefined && stderr !== null && stderr !== '') {
      console.log('Makesweet exec error')
      console.log(stderr)

      return undefined
    } */
    // ffmpeg stderr is used as a normal output channel

    // TODO: Handle fail state somehow
    return exportPath
  }
}
