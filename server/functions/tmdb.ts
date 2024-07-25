/**
 * This file includes code derived from @movie-web/providers by movie-web.
 * @movie-web/providers is licensed under the MIT License.
 * 
 * The original source of @movie-web/providers is no longer available, unfortunately. You can find an actively maintained version on the following link:
 * https://github.com/sussy-code/providers
 * 
 * MIT License
 * 
 * Copyright (c) 2023 movie-web
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
import { MovieMedia, ShowMedia } from '@movie-web/providers';
import 'dotenv/config'

const TMDB_API_KEY = process.env.TMDB_API_KEY

// Define an interface that includes optional authorization property
export async function makeTMDBRequest(url: string, appendToResponse?: string): Promise<Response> {
  
    const headers: {
      accept: 'application/json';
      authorization?: string;
    } = {
      accept: 'application/json',
    };
  
    const requestURL = new URL(url);
  
    // * JWT keys always start with ey and are ONLY valid as a header.
    // * All other keys are ONLY valid as a query param.
    // * Thanks TMDB.
    if (TMDB_API_KEY.startsWith('ey')) {
      headers.authorization = `Bearer ${TMDB_API_KEY}`;
    } else {
      requestURL.searchParams.append('api_key', TMDB_API_KEY);
    }
  
    if (appendToResponse) {
      requestURL.searchParams.append('append_to_response', appendToResponse);
    }
  
    return fetch(requestURL, {
      method: 'GET',
      headers,
    });
  }
  
  export async function getMovieMediaDetails(id: string): Promise<MovieMedia> {
    const response = await makeTMDBRequest(`https://api.themoviedb.org/3/movie/${id}`, 'external_ids');
    const movie = await response.json();
  
    if (movie.success === false) {
      throw new Error(movie.status_message);
    }
  
    if (!movie.release_date) {
      throw new Error(`${movie.title} has no release_date. Assuming unreleased`);
    }
  
    return {
      type: 'movie',
      title: movie.title,
      releaseYear: Number(movie.release_date.split('-')[0]),
      tmdbId: id,
      imdbId: movie.imdb_id,
    };
  }
  
  export async function getShowMediaDetails(id: string, seasonNumber: string, episodeNumber: string): Promise<ShowMedia> {
    // * TV shows require the TMDB ID for the series, season, and episode
    // * and the name of the series. Needs multiple requests
    let response = await makeTMDBRequest(`https://api.themoviedb.org/3/tv/${id}`, 'external_ids');
    const series = await response.json();
  
    if (series.success === false) {
      throw new Error(series.status_message);
    }
  
    if (!series.first_air_date) {
      throw new Error(`${series.name} has no first_air_date. Assuming unaired`);
    }
  
    response = await makeTMDBRequest(`https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}`);
    const season = await response.json();
  
    if (season.success === false) {
      throw new Error(season.status_message);
    }
  
    response = await makeTMDBRequest(
      `https://api.themoviedb.org/3/tv/${id}/season/${seasonNumber}/episode/${episodeNumber}`,
    );
    const episode = await response.json();
  
    if (episode.success === false) {
      throw new Error(episode.status_message);
    }
  
    return {
      type: 'show',
      title: series.name,
      releaseYear: Number(series.first_air_date.split('-')[0]),
      tmdbId: id,
      episode: {
        number: episode.episode_number,
        tmdbId: episode.id,
      },
      season: {
        number: season.season_number,
        tmdbId: season.id,
      },
      imdbId: series.external_ids.imdb_id,
    };
  }

  export async function convertImdbIdToTmdbId(imdbId) {
    // TODO: Make it work with makeTMDBrequest
    const url = `https://api.themoviedb.org/3/find/${imdbId}?api_key=${TMDB_API_KEY}&external_source=imdb_id`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Network response was not ok: ${response.statusText}`);
        }

        const data = await response.json();
        const results = data.movie_results.length ? data.movie_results : data.tv_results;
        
        if (results.length) {
            return results[0].id;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching TMDb ID:', error);
        return null;
    }
}


export async function separateId(id) {
    const parts = id.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid ID format. Must be in the format id:season:episode');
    }
    const [idPart, seasonPart, episodePart] = parts;
    return {
        id: idPart,
        season: seasonPart,
        episode: episodePart
    };
}

export async function totalEpisodes(tmdbId, season, episode) {
  let totalEpisodes = 0;

  try {
      const seriesResponse = await makeTMDBRequest(`https://api.themoviedb.org/3/tv/${tmdbId}`);
      const seriesData = await seriesResponse.json();
      const totalSeasons = seriesData.number_of_seasons;

      for (let seasonNumber = 1; seasonNumber < season; seasonNumber++) {
          const seasonResponse = await makeTMDBRequest(`https://api.themoviedb.org/3/tv/${tmdbId}/season/${seasonNumber}`);
          const seasonData = await seasonResponse.json();
          totalEpisodes += seasonData.episodes.length;
      }

      totalEpisodes += episode;

      return totalEpisodes;
  } catch (error) {
      throw error;
  }
}

export async function getEpisodeIMDbID(tmdb, season, episode): Promise<{ imdb_id: string | null }> {
  const url = `https://api.themoviedb.org/3/tv/${tmdb}/season/${season}/episode/${episode}/external_ids`;

  try {
    const response = await makeTMDBRequest(url);

    const jsonResponse = await response.json();

    const imdbId = jsonResponse.imdb_id ? jsonResponse.imdb_id : null;

    return(imdbId);
  } catch (error) {
    console.error('Failed to get episode IMDb ID:', error);
    throw error;
  }
}
