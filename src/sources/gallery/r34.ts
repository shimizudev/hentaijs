import { load } from "cheerio";
import type { PaginatedResult } from "../../types";
import { Dimension } from "../../utils/Dimension";

/**
 * Base URL for the Rule34 website.
 */
export const RULE34_BASE_URL = "https://rule34.xxx";

/**
 * API URL for Rule34 autocomplete functionality.
 */
export const RULE34_API_URL = "https://ac.rule34.xxx";

/**
 * Class representing a Rule34 client for interacting with the Rule34 website.
 */
export const Rule34 = class {
	/**
	 * Base URL for the Rule34 website.
	 */
	public BASE_URL = RULE34_BASE_URL;

	/**
	 * API URL for Rule34 autocomplete functionality.
	 */
	public API_URL = RULE34_API_URL;

	/**
	 * Creates a new instance of the Rule34 client.
	 *
	 * @param {R34Options} [options] - Configuration options for the Rule34 client.
	 * @param {string} [options.baseUrl] - Custom base URL for the Rule34 website.
	 * @param {string} [options.apiUrl] - Custom API URL for Rule34 autocomplete functionality.
	 */
	constructor(options?: R34Options) {
		this.BASE_URL = options?.baseUrl || RULE34_BASE_URL;
		this.API_URL = options?.apiUrl || RULE34_API_URL;
	}

	/**
	 * Searches for autocomplete suggestions based on the provided query.
	 *
	 * @param {string} query - The search query string.
	 * @returns {Promise<Array<{completedQuery: string, label: string, type: string}>>} A promise that resolves to an array of autocomplete suggestions.
	 * @throws {TypeError} If the query is empty or not a string.
	 */
	searchAutocomplete = async (query: string) => {
		if (!query || typeof query !== "string") {
			throw new TypeError("Query invalid");
		}

		const url = `${this.API_URL}/autocomplete.php?q=${query}`;

		const response = await fetch(url);
		const data = (await response.json()) as { label: string; value: string; type: string }[];

		return data.map((item) => ({
			completedQuery: item.value,
			label: item.label,
			type: item.type,
		}));
	};

	/**
	 * Searches for images on Rule34 based on the provided query.
	 *
	 * @param {string} query - The search query string.
	 * @param {number} [page=1] - The page number to retrieve (default is 1).
	 * @param {number} [perPage=10] - The number of results per page (default is 10).
	 * @returns {Promise<R34SearchResult>} A promise that resolves to a paginated result of search results.
	 * @throws {TypeError} If the query is empty or not a string.
	 */
	search = async (query: string, page = 1, perPage = 10) => {
		if (!query || typeof query !== "string") {
			throw new TypeError("Query invalid");
		}

		const url = `${this.BASE_URL}/index.php?page=post&s=list&tags=${query}&pid=${(page - 1) * perPage}`;

		const response = await fetch(url);
		const data = await response.text();

		const $ = load(data);

		const results: R3SearchResult[] = [];

		$(".image-list span").each((_i, e) => {
			const $e = $(e);

			const id = $e.attr("id")?.replace("s", "") || "";
			const image = $e.find("img").attr("src") || "";
			const tags =
				$e
					.find("img")
					.attr("alt")
					?.trim()
					?.split(" ")
					.filter((tag) => tag !== "") || [];

			results.push({
				id: id,
				image: image,
				tags: tags,
				type: "preview",
			});
		});

		const pagination = $("#paginator .pagination");
		const totalPages =
			Number.parseInt(pagination.find("a:last").attr("href")?.split("pid=")[1] || "1", 10) /
				perPage +
			1;
		const currentPage = page;
		const nextPage = currentPage < totalPages ? currentPage + 1 : null;
		const previousPage = currentPage > 1 ? currentPage - 1 : null;
		const hasNextPage = nextPage !== null;
		const next = nextPage !== null ? nextPage * perPage : 0;
		const previous = previousPage !== null ? previousPage * perPage : 0;

		return {
			total: totalPages * perPage,
			next: next,
			previous: previous,
			pages: totalPages,
			page: currentPage,
			hasNextPage,
			results,
		} as R34SearchResult;
	};

	/**
	 * Gets detailed information about a specific image by its ID.
	 *
	 * @param {string} id - The ID of the image to retrieve information for.
	 * @returns {Promise<R34ImageInfo>} A promise that resolves to an object containing detailed information about the image.
	 */
	public getInfo = async (id: string): Promise<R34ImageInfo> => {
		const url = `${this.BASE_URL}/index.php?page=post&s=view&id=${id}`;

		const resizeCookies = {
			"resize-notification": 1,
			"resize-original": 1,
		};

		const [resizedResponse, nonResizedResponse] = await Promise.all([
			fetch(url),
			fetch(url, {
				headers: {
					cookie: Object.entries(resizeCookies)
						.map(([key, value]) => `${key}=${value}`)
						.join("; "),
				},
			}),
		]);

		const [resized, original] = await Promise.all([
			resizedResponse.text(),
			nonResizedResponse.text(),
		]);

		const $resized = load(resized);

		const resizedImageUrl = $resized("#image").attr("src");

		const $ = load(original);
		const fullImage = $("#image").attr("src");
		const tags = $("#image")
			.attr("alt")
			?.trim()
			?.split(" ")
			.filter((tag) => tag !== "");

		const stats = $("#stats ul");

		const postedData = stats.find("li:nth-child(2)").text().trim();
		const createdAt = new Date(postedData.split("Posted: ")[1].split("by")[0]).getTime();
		const publishedBy = postedData.split("by")[1].trim();
		const size = stats.find("li:nth-child(3)").text().trim().split("Size: ")[1];
		const rating = stats.find("li:contains('Rating:')").text().trim().split("Rating: ")[1];
		const dimension = Dimension.fromString(size);
		const comments = $("#comment-list div")
			.map((_i, el) => {
				const $el = $(el);
				const id = $el.attr("id")?.replace("c", "");
				const user = $el.find(".col1").text().trim().split("\n")[0];
				const comment = $el.find(".col2").text().trim();
				return {
					id,
					user,
					comment,
				};
			})
			.get()
			.filter(Boolean)
			.filter((comment) => comment.comment !== "");

		return {
			id,
			fullImage,
			resizedImageUrl,
			tags,
			createdAt,
			publishedBy,
			rating,
			sizes: {
				aspect: dimension?.getAspectRatio(),
				width: dimension?.getWidthInPx(),
				height: dimension?.getHeightInPx(),
				widthRem: dimension?.getWidthInRem(),
				heightRem: dimension?.getHeightInRem(),
				fullSize: dimension ? dimension.getWidthInPx() * dimension.getHeightInPx() : undefined,
				formatted: `${dimension?.getWidthInPx()}x${dimension?.getHeightInPx()}`,
			},
			comments,
		};
	};
};

/**
 * Configuration options for the Rule34 client.
 */
export interface R34Options {
	/**
	 * Custom base URL for the Rule34 website.
	 */
	baseUrl?: string;

	/**
	 * Custom API URL for Rule34 autocomplete functionality.
	 */
	apiUrl?: string;
}

/**
 * Represents a single search result from Rule34.
 */
export interface R3SearchResult {
	/**
	 * The unique identifier of the image.
	 */
	id: string;

	/**
	 * The URL of the image.
	 */
	image: string;

	/**
	 * Array of tags associated with the image.
	 */
	tags: string[];

	/**
	 * The type of the result, always "preview" for search results.
	 */
	type: "preview";
}

/**
 * Represents a comment on a Rule34 image.
 */
export interface R34Comment {
	/**
	 * The unique identifier of the comment.
	 */
	id?: string;

	/**
	 * The username of the commenter.
	 */
	user: string;

	/**
	 * The content of the comment.
	 */
	comment: string;
}

/**
 * Represents size information for a Rule34 image.
 */
export interface R34ImageSizes {
	/**
	 * The aspect ratio of the image (e.g., "16:9").
	 */
	aspect?: string;

	/**
	 * The width of the image in pixels.
	 */
	width?: number;

	/**
	 * The height of the image in pixels.
	 */
	height?: number;

	/**
	 * The width of the image in rem units.
	 */
	widthRem?: number;

	/**
	 * The height of the image in rem units.
	 */
	heightRem?: number;

	/**
	 * The total number of pixels in the image (width × height).
	 */
	fullSize?: number;

	/**
	 * The formatted dimensions of the image (e.g., "1920x1080").
	 */
	formatted?: string;
}

/**
 * Represents detailed information about a Rule34 image.
 */
export interface R34ImageInfo {
	/**
	 * The unique identifier of the image.
	 */
	id: string;

	/**
	 * The URL of the full-size image.
	 */
	fullImage?: string;

	/**
	 * The URL of the resized image.
	 */
	resizedImageUrl?: string;

	/**
	 * Array of tags associated with the image.
	 */
	tags?: string[];

	/**
	 * The timestamp when the image was created/posted.
	 */
	createdAt: number;

	/**
	 * The username of the person who published the image.
	 */
	publishedBy: string;

	/**
	 * The content rating of the image (e.g., "Safe", "Questionable", "Explicit").
	 */
	rating: string;

	/**
	 * Size information about the image.
	 */
	sizes: R34ImageSizes;

	/**
	 * Array of comments on the image.
	 */
	comments: R34Comment[];
}

/**
 * Represents a paginated search result from Rule34.
 */
export type R34SearchResult = PaginatedResult<R3SearchResult>;
