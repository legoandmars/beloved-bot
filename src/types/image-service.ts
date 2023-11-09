// this is implemented generically so people can feel free to implement other methods of image fetching/generation
export interface ImageService {
  // sorted by try priority. the first one will always be tried first. it is up to the service implementation to decide how to sort
  getImagesPathsFromTextPrompt: (inputText: string) => Promise<string[] | undefined>
}
