export interface TMDBMovie {
  id: number
  title: string
  release_date: string
  poster_path: string
  vote_average: number
  overview: string
}

export interface TMDBSeries {
  id: number
  name: string
  first_air_date: string
  poster_path: string
  vote_average: number
  overview: string
}

export interface GoogleBook {
  id: string
  volumeInfo: {
    title: string
    authors?: string[]
    publishedDate?: string
    imageLinks?: {
      thumbnail?: string
      smallThumbnail?: string
    }
    averageRating?: number
    description?: string
    pageCount?: number
    categories?: string[]
    language?: string
    publisher?: string
    industryIdentifiers?: { type: string; identifier: string }[]
  }
}

class SearchService {
  private tmdbApiKey: string

  constructor() {
    this.tmdbApiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY || ""
  }

  async searchMovies(query: string): Promise<TMDBMovie[]> {
    if (!this.tmdbApiKey) {
      throw new Error("TMDB API key not configured")
    }

    const response = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=1`,
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  }

  async searchSeries(query: string): Promise<TMDBSeries[]> {
    if (!this.tmdbApiKey) {
      throw new Error("TMDB API key not configured")
    }

    const response = await fetch(
      `https://api.themoviedb.org/3/search/tv?api_key=${this.tmdbApiKey}&query=${encodeURIComponent(query)}&page=1`,
    )

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`)
    }

    const data = await response.json()
    return data.results || []
  }

  async searchBooks(query: string): Promise<GoogleBook[]> {
    // Google Books API doesn't require an API key for basic searches
    // Use more specific query parameters for better results
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query,
      )}&maxResults=20&printType=books&orderBy=relevance&fields=items(id,volumeInfo(title,authors,publishedDate,imageLinks,averageRating,description,pageCount,categories,language,publisher,industryIdentifiers))`,
    )

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  }

  async searchBooksDetailed(query: string): Promise<GoogleBook[]> {
    // More detailed search with better field selection for full descriptions
    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query,
      )}&maxResults=10&printType=books&orderBy=relevance&fields=items(id,volumeInfo(title,authors,publishedDate,imageLinks,averageRating,description,pageCount,categories,language,publisher,industryIdentifiers,subtitle,previewLink))`,
    )

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  }

  async getBookById(volumeId: string): Promise<GoogleBook | null> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes/${volumeId}?fields=id,volumeInfo(title,authors,publishedDate,imageLinks,averageRating,description,pageCount,categories,language,publisher,industryIdentifiers,subtitle,previewLink)`,
      )

      if (!response.ok) {
        throw new Error(`Google Books API error: ${response.status}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error("Error fetching book by ID:", error)
      return null
    }
  }

  async searchBooksByTitleAndAuthor(title: string, author?: string): Promise<GoogleBook[]> {
    // More specific search using title and author for better results
    let query = `intitle:"${title}"`
    if (author) {
      query += `+inauthor:"${author}"`
    }

    const response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
        query,
      )}&maxResults=5&printType=books&orderBy=relevance&fields=items(id,volumeInfo(title,authors,publishedDate,imageLinks,averageRating,description,pageCount,categories,language,publisher,industryIdentifiers,subtitle,previewLink))`,
    )

    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`)
    }

    const data = await response.json()
    return data.items || []
  }

  async searchMusic(query: string): Promise<any[]> {
    // Placeholder for music search - can be implemented with Spotify API later
    return []
  }
}

export const searchService = new SearchService()
