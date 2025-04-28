import { load } from "cheerio";
import { parse } from "date-fns";
import { getNumberFromString } from "../../utils/get-number-from-string";
import { rot13Cipher } from "../../utils/rot13";

/**
 * Base URL for the Hentai Haven website.
 */
export const HENTAI_HAVEN_URL = "http://hentaihaven.xxx";

/**
 * Client for interacting with the Hentai Haven website.
 */
export const HentaiHaven = class {
	/**
	 * Base URL for API requests.
	 */
	public BASE_URL = HENTAI_HAVEN_URL;

	/**
	 * Creates a new instance of the HentaiHaven client.
	 *
	 * @param {HentaiHavenOptions} options - Configuration options for the HentaiHaven client.
	 * @param {string} [options.baseUrl] - Custom base URL for the HentaiHaven website.
	 */
	constructor(options: HentaiHavenOptions) {
		this.BASE_URL = options.baseUrl || HENTAI_HAVEN_URL;
	}

	/**
	 * Searches for hentai videos on Hentai Haven based on the provided query.
	 *
	 * @param {string} query - The search query string.
	 * @returns {Promise<HHSearchResult[]>} A promise that resolves to an array of search results.
	 * @throws {TypeError} If the query is empty or not a string.
	 */
	public search = async (query: string) => {
		if (!query || typeof query !== "string") {
			throw new TypeError("Invalid query in search.");
		}

		const url = `${this.BASE_URL}/?s=${query}&post_type=wp-manga`;

		const response = await fetch(url);
		const data = await response.text();

		const $ = load(data);
		const results: HHSearchResult[] = [];

		$(".c-tabs-item__content").each((_i, el) => {
			const cover = $(el).find(".c-image-hover img").attr("src") || "";
			const id = $(el).find(".c-image-hover a").attr("href")?.split("/")[4] || "";
			const title = $(el).find(".post-title h3").text().trim();
			const alternative = $(el).find(".tab-summary .mg_alternative .summary-content").text().trim();
			const author = $(el).find(".tab-summary .mg_author .summary-content").text().trim();
			const released = Number(
				$(el).find(".tab-summary .mg_release .summary-content").text().trim(),
			);
			const totalEpisodes =
				getNumberFromString($(el).find(".tab-meta .latest-chap .chapter").text().trim()) || 0;
			const dateString = $(el).find(".tab-meta .post-on").text().trim();
			const parsedDate = parse(dateString, "MMM dd, yyyy", new Date());

			const rating = Number($(el).find(".tab-meta .rating .total_votes").text().trim());

			const genres: HHGenre[] = [];

			$(".tab-summary .mg_genres .summary-content a").each((_, element) => {
				genres.push({
					id: $(element).attr("href")?.split("/")[4] || "",
					url: $(element).attr("href") || "",
					name: $(element).text().trim().replaceAll(",", ""),
				});
			});

			results.push({
				id,
				title,
				cover: cover.replaceAll(" ", "%20"),
				rating,
				released,
				genres,
				totalEpisodes,
				date: {
					unparsed: dateString,
					parsed: parsedDate,
				},
				alternative,
				author,
			});
		});

		return results;
	};

	/**
	 * Retrieves detailed information about a hentai series by its ID.
	 *
	 * @param {string} id - The unique identifier of the hentai series.
	 * @param {HHEpisodesSort} [episodeSort="ASC"] - The sort order for episodes (ascending or descending).
	 * @returns {Promise<HHHentaiInfo>} A promise that resolves to detailed information about the hentai series.
	 * @throws {Error} If the ID is not provided or if there's an error fetching the data.
	 */
	public getInfo = async (id: string, episodeSort: HHEpisodesSort = "ASC") => {
		if (!id) {
			throw new Error("Id is required");
		}

		const url = `${this.BASE_URL}/watch/${id}`;

		const response = await fetch(url);
		const data = await response.text();

		if (data === "" || !data) {
			throw new Error("Error fetching data");
		}

		const $ = load(data);

		if ($("body").text().includes("webpage has been blocked")) {
			throw new Error(`The webpage is blocked. Consider using a CORS proxy. GET ${url}`);
		}

		const title = $(".post-title h1").text().trim();
		const cover = $(".summary_image img").attr("src") || "";
		const ratingCount = Number($('span[property="ratingCount"]').text().trim());
		const views = getNumberFromString(
			$(".post-content_item:nth-child(4) .summary-content").text(),
		) as number;
		const released = Number($(".post-status .summary-content a").text().trim());
		const summary = $(".description-summary p").text().trim();

		const genres: HHGenre[] = [];
		const episodes: HHHentaiEpisode[] = [];

		$(".genres-content a").each((_i, el) => {
			genres.push({
				id: $(el).attr("href")?.split("/")[4] || "",
				url: $(el).attr("href") || "",
				name: $(el).text().trim(),
			});
		});

		const episodesLength = $("li.wp-manga-chapter").length;

		$("li.wp-manga-chapter").each((i, el) => {
			const thumbnail = $(el).find("img").attr("src");
			const id = `${$(el).find("a").attr("href")?.split("/")[4]}/${
				$(el).find("a").attr("href")?.split("/")[5]
			}`;
			const title = $(el).find("a").text().trim();
			const number = episodesLength - i;
			const released = $(el).find(".chapter-release-date").text().trim();
			const releasedUTC = parse(released, "MMMM dd, yyyy", new Date());

			episodes.push({
				// Episode id spoofing cause the API doesn't return the episode id, it returns a path.
				id: btoa(id),
				title,
				thumbnail,
				number,
				releasedUTC,
				releasedRelative: released,
			});
		});

		this.sortEpisodes(episodes, episodeSort);

		return {
			id,
			title,
			cover: cover ? cover.replaceAll(" ", "%20") : "",
			summary,
			views,
			ratingCount,
			released,
			genres,
			totalEpisodes: episodesLength,
			episodes,
		} as HHHentaiInfo;
	};

	/**
	 * Retrieves streaming sources for a specific episode by its ID.
	 *
	 * @param {string} id - The encoded episode ID.
	 * @returns {Promise<HHHentaiSources>} A promise that resolves to the streaming sources for the episode.
	 * @throws {TypeError} If the ID is invalid or not provided.
	 * @throws {Error} If the episode ID is not properly encoded.
	 */
	public getEpisode = async (id: string) => {
		if (!id || typeof id !== "string") {
			throw new TypeError("Invalid identifier");
		}

		if (id?.includes("episode-")) {
			throw new Error("The Episode ID must be encoded.");
		}

		const pageUrl = `${this.BASE_URL}/watch/${atob(id)}`;

		const pageResponse = await fetch(pageUrl);
		const pageHtml = await pageResponse.text();

		const $page = load(pageHtml);
		const iframeSrc = $page(".player_logic_item > iframe").attr("src");

		const iframeResponse = await fetch(iframeSrc || "");
		const iframeHtml = await iframeResponse.text();

		const $iframe = load(iframeHtml);
		const secureToken = $iframe('meta[name="x-secure-token"]')
			.attr("content")
			?.replace("sha512-", "");

		const rotatedSha = rot13Cipher(secureToken || "");
		const firstDecode = atob(rotatedSha);
		const secondRotate = rot13Cipher(firstDecode);
		const secondDecode = atob(secondRotate);
		const thirdRotate = rot13Cipher(secondDecode);

		const decryptedData = JSON.parse(atob(thirdRotate)) as {
			en: string;
			iv: string;
			uri: string;
		};

		const formData = new FormData();
		formData.append("action", "zarat_get_data_player_ajax");
		formData.append("a", decryptedData.en);
		formData.append("b", decryptedData.iv);

		const apiUrl = `${
			decryptedData.uri || "https://hentaihaven.xxx/wp-content/plugins/player-logic/"
		}api.php`;
		const apiResponse = (await (
			await fetch(apiUrl, {
				method: "POST",
				body: formData,
				mode: "cors",
				cache: "default",
			})
		).json()) as {
			status: boolean;
			data: {
				image: string | null;
				sources: HHHentaiSource[];
			};
			authorization: {
				token: string;
				expiration: number;
				ip: string;
			};
		};

		const sources = apiResponse.data.sources;
		const thumbnail = apiResponse.data.image;

		return {
			sources,
			thumbnail,
		} as HHHentaiSources;
	};

	/**
	 * Sorts an array of episodes based on the specified sort order.
	 *
	 * @param {HHHentaiEpisode[]} episodes - The array of episodes to sort.
	 * @param {HHEpisodesSort} sortOrder - The sort order to apply ("ASC" for ascending, "DESC" for descending).
	 */
	public sortEpisodes(episodes: HHHentaiEpisode[], sortOrder: HHEpisodesSort) {
		episodes.sort((a, b) => {
			if (sortOrder === "ASC") {
				return a.number - b.number;
			}
			return b.number - a.number;
		});
	}
};

/**
 * Configuration options for the HentaiHaven client.
 */
interface HentaiHavenOptions {
	/**
	 * Custom base URL for the HentaiHaven website.
	 */
	baseUrl?: string;
}

/**
 * Sort order for episodes.
 */
export type HHEpisodesSort = "ASC" | "DESC";

/**
 * Represents a genre in Hentai Haven.
 */
export interface HHGenre {
	/**
	 * Unique identifier for the genre.
	 */
	id: string;
	/**
	 * URL to the genre page.
	 */
	url: string;
	/**
	 * Name of the genre.
	 */
	name: string;
}

/**
 * Represents an episode of a hentai series.
 */
export interface HHHentaiEpisode {
	/**
	 * Unique identifier for the episode.
	 */
	id: string;
	/**
	 * Title of the episode.
	 */
	title: string;
	/**
	 * URL to the episode thumbnail image.
	 */
	thumbnail?: string;
	/**
	 * Episode number.
	 */
	number: number;
	/**
	 * Release date in UTC.
	 */
	releasedUTC: Date;
	/**
	 * Relative time since release (e.g., "2 days ago").
	 */
	releasedRelative: string;
}

/**
 * Detailed information about a hentai series.
 */
export interface HHHentaiInfo {
	/**
	 * Unique identifier for the series.
	 */
	id: string;
	/**
	 * Title of the series.
	 */
	title: string;
	/**
	 * URL to the cover image.
	 */
	cover: string;
	/**
	 * Plot summary or description.
	 */
	summary: string;
	/**
	 * Number of views.
	 */
	views: number;
	/**
	 * Number of ratings received.
	 */
	ratingCount: number;
	/**
	 * Year of release.
	 */
	released: number;
	/**
	 * List of genres associated with the series.
	 */
	genres: HHGenre[];
	/**
	 * Total number of episodes in the series.
	 */
	totalEpisodes: number;
	/**
	 * List of episodes in the series.
	 */
	episodes: HHHentaiEpisode[];
}

/**
 * Represents a video source for streaming.
 */
export interface HHHentaiSource {
	/**
	 * Label for the video quality or source.
	 */
	label: string;
	/**
	 * URL to the video source.
	 */
	src: string;
	/**
	 * MIME type of the video.
	 */
	type: string;
}

/**
 * Collection of video sources for a hentai episode.
 */
export interface HHHentaiSources {
	/**
	 * List of available video sources.
	 */
	sources: HHHentaiSource[];
	/**
	 * URL to the video thumbnail.
	 */
	thumbnail?: string;
}

/**
 * Represents a search result from Hentai Haven.
 */
export interface HHSearchResult {
	/**
	 * Unique identifier for the series.
	 */
	id: string;
	/**
	 * Title of the series.
	 */
	title: string;
	/**
	 * URL to the cover image.
	 */
	cover: string;
	/**
	 * Average rating of the series.
	 */
	rating: number;
	/**
	 * Year of release.
	 */
	released: number;
	/**
	 * List of genres associated with the series.
	 */
	genres: HHGenre[];
	/**
	 * Total number of episodes in the series.
	 */
	totalEpisodes: number;
	/**
	 * Date information.
	 */
	date: {
		/**
		 * Unparsed date string.
		 */
		unparsed: string;
		/**
		 * Parsed Date object.
		 */
		parsed: Date;
	};
	/**
	 * Alternative titles.
	 */
	alternative: string;
	/**
	 * Author or creator of the series.
	 */
	author: string;
}
