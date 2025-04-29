import { load } from "cheerio";
import { parseDate } from "chrono-node";
import { getNumberFromString } from "../../utils/get-number-from-string";
import { normalize } from "../../utils/normalize";
import { removeNumberFromString } from "../../utils/remove-number-from-string";

export const HENTAI_STREAM_BASE_URL = "https://tube.hentaistream.com";

/**
 * HentaiStream class for interacting with the HentaiStream API
 */
export const HentaiStream = class {
	public BASE_URL = HENTAI_STREAM_BASE_URL;

	/**
	 * Creates a new HentaiStream instance
	 * @param options - Configuration options
	 */
	constructor(options?: HentaiStreamOptions) {
		this.BASE_URL = options?.baseUrl || HENTAI_STREAM_BASE_URL;
	}

	/**
	 * Search for anime on HentaiStream
	 * @param query - The search query
	 * @returns Promise resolving to an array of search results
	 * @throws {TypeError} If query is invalid
	 */
	public search = async (query: string): Promise<HStreamResult[]> => {
		if (!query || typeof query !== "string") {
			throw new TypeError("Invalid Query");
		}

		const url = `${this.BASE_URL}/?s=${encodeURIComponent(query)}`;

		const response = await fetch(url);
		const data = await response.text();

		const $ = load(data);

		const results: HStreamResult[] = [];

		$(".content .post").each((_i, e) => {
			const $e = $(e);

			const id = ($e.find("div.postimg a").attr("href") || "").split("/").pop() || "";
			const title = $e.find("p.posttitle ins").text().trim() || "";
			const image = $e.find("div.postimg img").attr("src");
			const views =
				Number.parseInt($e.find(".view").text().trim().split(" ")[0].replaceAll(",", "")) || 0;
			const releaseDate = parseDate($e.find(".dtcreated").text().trim().split("Added: ")[1].trim());

			results.push({
				id,
				image,
				title,
				views,
				releaseDate,
			});
		});

		return results;
	};

	/**
	 * Get information about a specific episode
	 * @param id - The episode ID
	 * @returns Promise resolving to episode information
	 * @throws {TypeError} If ID is invalid
	 */
	public getInfoEpisode = async (id: string): Promise<HStreamEpisodeInfo> => {
		if (!id || typeof id !== "string") {
			throw new TypeError("Invalid ID.");
		}

		const url = `${this.BASE_URL}/${id}`;

		const response = await fetch(url);
		const data = await response.text();

		const $ = load(data);

		const title = $(".videotitle").text().trim().replaceAll("¤", "").trim();
		const releasedDate = parseDate(
			$(".threebox p:nth-child(1)").text().trim().split("Added: ")[1].split(" @")[0].trim(),
		);
		const views = Number.parseInt(
			$(".threebox p:nth-child(2)").text().trim().split("Views: ")[1].replaceAll(",", ""),
		);
		const genres = $('div.videotags:contains("Genre(s)") a')
			.map((_i, e) => $(e).text().trim())
			.get();

		return {
			title,
			releasedDate,
			views,
			genres,
		};
	};

	/**
	 * Get detailed information about an anime series
	 * @param id - The anime ID or title
	 * @returns Promise resolving to anime information or null if not found
	 * @throws {TypeError} If ID is invalid
	 */
	public getInfo = async (id: string): Promise<HStreamAnimeInfo | null> => {
		if (!id || typeof id !== "string") {
			throw new TypeError("Invalid ID.");
		}

		const normalizedId = normalize(id);

		const searchData = await this.search(normalizedId);

		const matchingResults = searchData.filter((result) => {
			const normalizedTitle = normalize(result.title || "");
			return normalizedTitle.includes(normalizedId);
		});

		if (matchingResults.length === 0) {
			return null;
		}

		const firstResult = matchingResults[0];

		const episodes = await Promise.all(
			matchingResults.map(async (result) => {
				const episodeInfo = await this.getInfoEpisode(result.id);
				const episodeNumber = getNumberFromString(result.title || "");

				return {
					...result,
					...episodeInfo,
					episodeNumber,
				};
			}),
		);

		episodes.sort((a, b) => {
			const aNum = a.episodeNumber || 0;
			const bNum = b.episodeNumber || 0;
			return aNum - bNum;
		});

		const averageViews = Math.ceil(
			episodes.reduce((sum, episode) => sum + (episode.views || 0), 0) / episodes.length,
		);
		const genres = new Set(episodes.flatMap((episode) => episode.genres || []));

		return {
			title: (normalizedId.charAt(0).toUpperCase() + normalizedId.slice(1)).trim(),
			image: firstResult.image,
			genres: [...genres.values()],
			views: averageViews,
			episodes: episodes.map((ep) => ({
				id: btoa(ep.id),
				number: ep.episodeNumber,
				views: ep.views,
				releasedDate: ep.releaseDate,
				title: ep.title,
				image: ep.image,
			})),
			releasedDate: episodes[0].releaseDate,
		};
	};

	/**
	 * Get streaming information for a specific episode
	 * @param id - The encoded episode ID
	 * @returns Promise resolving to episode streaming information
	 * @throws {TypeError} If ID is invalid
	 * @throws {Error} If streams cannot be fetched
	 */
	public getEpisode = async (id: string): Promise<HStreamEpisodeStream> => {
		if (!id || typeof id !== "string") {
			throw new TypeError("Invalid ID.");
		}

		const url = `${this.BASE_URL}/${atob(id)}`;

		const response = await fetch(url);
		const data = await response.text();

		const $ = load(data);

		const frameUrl = $("iframe").attr("src");

		const title = $(".videotitle").text().trim().replaceAll("¤", "").trim();
		const releasedDate = parseDate(
			$(".threebox p:nth-child(1)").text().trim().split("Added: ")[1].split(" @")[0].trim(),
		);
		const views = Number.parseInt(
			$(".threebox p:nth-child(2)").text().trim().split("Views: ")[1].replaceAll(",", ""),
		);

		if (!frameUrl) {
			throw new Error("Failed to fetch streams");
		}

		const res = await fetch(frameUrl);
		const frameData = await res.text();

		const $$ = load(frameData);

		const $video = $$("video");

		const source = $video.find("source").attr("src");

		return {
			title,
			releasedDate,
			views,
			source,
		};
	};
};

/**
 * Configuration options for HentaiStream
 */
export interface HentaiStreamOptions {
	baseUrl?: string;
}

/**
 * Search result from HentaiStream
 */
export interface HStreamResult {
	id: string;
	title?: string;
	views?: number;
	image?: string;
	releaseDate?: Date | null;
}

/**
 * Episode information
 */
export interface HStreamEpisodeInfo {
	title?: string;
	releasedDate?: Date | null;
	views?: number;
	genres?: string[];
}

/**
 * Anime series information
 */
export interface HStreamAnimeInfo {
	title: string;
	image?: string;
	genres: string[];
	views: number;
	episodes: HStreamEpisodeListItem[];
	releasedDate?: Date | null;
}

/**
 * Episode list item
 */
export interface HStreamEpisodeListItem {
	id: string;
	number?: number | null;
	views?: number;
	releasedDate?: Date | null;
	title?: string;
	image?: string;
}

/**
 * Episode streaming information
 */
export interface HStreamEpisodeStream {
	title?: string;
	releasedDate?: Date | null;
	views?: number;
	source?: string;
}
