import { load } from "cheerio";
import type { PaginatedResult } from "../../types";

export const HANIME_BASE_URL = "https://hanime.tv";
export const HANIME_SEARCH_URL = "https://search.htv-services.com";
export const HANIME_SIGNATURE_GENERATOR = () =>
	Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

export const HAnime = class {
	public BASE_URL = HANIME_BASE_URL;
	public SEARCH_URL = HANIME_BASE_URL;
	public generateSignature = HANIME_SIGNATURE_GENERATOR;

	/**
	 * Creates a new instance of the HAnime client.
	 *
	 * @param {HAnimeOptions} [options] - Configuration options for the HAnime client.
	 * @param {string} [options.baseUrl] - Custom base URL for the HAnime website.
	 * @param {string} [options.searchUrl] - Custom search API URL.
	 * @param {function(): string} [options.signatureGenerator] - Custom function to generate request signatures.
	 */
	constructor(options?: HAnimeOptions) {
		this.BASE_URL = options?.baseUrl || HANIME_BASE_URL;
		this.SEARCH_URL = options?.searchUrl || HANIME_SEARCH_URL;
		this.generateSignature = options?.signatureGenerator || HANIME_SIGNATURE_GENERATOR;
	}

	/**
	 * Searches for videos on Hanime.tv based on the provided query.
	 *
	 * @param {string} query - The search query string.
	 * @param {number} [page=1] - The page number to retrieve (default is 1).
	 * @param {number} [perPage=10] - The number of results per page (default is 10).
	 * @returns {Promise<PaginatedResult<HAnimeSearchResult>>} A promise that resolves to a paginated result of search results.
	 */
	public search = async (
		query: string,
		page = 1,
		perPage = 10,
	): Promise<PaginatedResult<HAnimeSearchResult>> => {
		if (!query) {
			throw new Error("Search query cannot be empty");
		}

		let validPage = page;
		if (validPage < 1) {
			validPage = 1;
		}

		let validPerPage = perPage;
		if (validPerPage < 1) {
			validPerPage = 10;
		}

		try {
			const response = await fetch(this.SEARCH_URL, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				body: JSON.stringify({
					blacklist: [],
					brands: [],
					order_by: "created_at_unix",
					page: validPage - 1,
					tags: [],
					search_text: query.trim(),
					tags_mode: "AND",
				}),
			});

			if (!response.ok) {
				throw new Error(`Search request failed with status: ${response.status}`);
			}

			const data = (await response.json()) as {
				page: number;
				nbPages: number;
				nbHits: number;
				hitsPerPage: number;
				hits: HAnimeRawSearchResult[];
			};

			if (!data.hits) {
				return {
					results: [],
					total: 0,
					page,
					pages: 0,
					hasNextPage: false,
				};
			}

			let allResults: HAnimeSearchResult[] = [];
			try {
				allResults = data.hits.map((result) => this.mapToSearchResult(result));
			} catch (error) {
				console.error("Failed to parse search results:", error);
				throw new Error("Failed to parse search results");
			}

			const totalResults = data.nbHits || 0;
			const totalPages = Math.max(1, Math.ceil(totalResults / validPerPage));

			const finalPage = Math.min(Math.max(1, validPage), totalPages);

			const startIndex = (finalPage - 1) * validPerPage;
			const endIndex = Math.min(startIndex + validPerPage, allResults.length);
			const results = allResults.slice(startIndex, endIndex);

			return {
				results,
				total: totalResults,
				page: finalPage,
				pages: totalPages,
				previous: finalPage > 1 ? finalPage - 1 : undefined,
				next: finalPage < totalPages ? finalPage + 1 : undefined,
				hasNextPage: finalPage < totalPages,
			};
		} catch (error) {
			console.error("Search error:", error);
			throw new Error(
				`Failed to search HAnime: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};

	/**
	 * Retrieves detailed information about a specific video by its slug.
	 *
	 * @param {string} slug - The unique slug identifier for the video.
	 * @returns {Promise<HAnimeVideoInfo>} A promise that resolves to detailed information about the video.
	 */
	public getInfo = async (slug: string): Promise<HAnimeVideoInfo> => {
		const path = `/videos/hentai/${slug}`;
		const url = `${this.BASE_URL}${path}`;

		const response = await fetch(url);
		const html = await response.text();

		const $ = load(html);

		const script = $('script:contains("window.__NUXT__")');
		const scriptHtml = script.html();
		const json = JSON.parse(
			scriptHtml?.replace("window.__NUXT__=", "").replaceAll(";", "") || "{}",
		) as HanimeResponse;

		const videoData = json.state.data.video;

		return {
			title: json.state.data.video.hentai_franchise.name,
			slug: json.state.data.video.hentai_franchise.slug,
			id: videoData.hentai_video.id,
			description: videoData.hentai_video.description,
			views: videoData.hentai_video.views,
			interests: videoData.hentai_video.interests,
			posterUrl: videoData.hentai_video.poster_url,
			coverUrl: videoData.hentai_video.cover_url,
			brand: {
				name: videoData.hentai_video.brand,
				id: videoData.hentai_video.brand_id,
			},
			durationMs: videoData.hentai_video.duration_in_ms,
			isCensored: videoData.hentai_video.is_censored,
			likes: videoData.hentai_video.likes,
			rating: videoData.hentai_video.rating,
			dislikes: videoData.hentai_video.dislikes,
			downloads: videoData.hentai_video.downloads,
			rankMonthly: videoData.hentai_video.monthly_rank,
			tags: videoData.hentai_tags,
			createdAt: videoData.hentai_video.created_at,
			releasedAt: videoData.hentai_video.released_at,
			episodes: {
				next: this.mapToEpisode(videoData.next_hentai_video),
				all: json.state.data.video.hentai_franchise_hentai_videos.map(this.mapToEpisode),
				random: this.mapToEpisode(videoData.next_random_hentai_video),
			},
		};
	};

	/**
	 * Retrieves stream information for a specific video episode by its slug.
	 *
	 * @param {string} slug - The unique slug identifier for the video episode.
	 * @returns {Promise<HAnimeStream[]>} A promise that resolves to an array of available video streams.
	 */
	public getEpisode = async (slug: string): Promise<HAnimeStream[]> => {
		const apiUrl = `${this.BASE_URL}/rapi/v7/videos_manifests/${slug}`;
		const signature = this.generateSignature();

		const response = await fetch(apiUrl, {
			headers: {
				"x-signature": signature,
				"x-time": Math.floor(Date.now() / 1000).toString(),
				"x-signature-version": "web2",
			},
		});

		const json = (await response.json()) as { videos_manifest: VideosManifest };

		const data = json.videos_manifest;
		const videos = data.servers.flatMap((server) => server.streams);

		const streams = videos
			.map((video) => ({
				id: video.id,
				serverId: video.server_id,
				kind: video.kind,
				extension: video.extension,
				mimeType: video.mime_type,
				width: video.width,
				height: video.height,
				durationInMs: video.duration_in_ms,
				filesizeMbs: video.filesize_mbs,
				filename: video.filename,
				url: video.url,
			}))
			.filter((video) => video.url && video.url !== "" && video.kind !== "premium_alert");

		return streams;
	};

	public mapToSearchResult = (raw: HAnimeRawSearchResult): HAnimeSearchResult => {
		return {
			id: raw.id,
			name: raw.name,
			titles: raw.titles,
			slug: raw.slug,
			description: raw.description,
			views: raw.views,
			interests: raw.interests,
			bannerImage: raw.poster_url,
			coverImage: raw.cover_url,
			brand: {
				name: raw.brand,
				id: raw.brand_id,
			},
			durationMs: raw.duration_in_ms,
			isCensored: raw.is_censored,
			likes: raw.likes,
			rating: raw.rating,
			dislikes: raw.dislikes,
			downloads: raw.downloads,
			rankMonthly: raw.monthly_rank,
			tags:
				typeof raw.tags === "object" && Array.isArray(raw.tags) ? raw.tags : JSON.parse(raw.tags),
			createdAt: raw.created_at,
			releasedAt: raw.released_at,
		};
	};

	public mapToEpisode = (raw: {
		id: number;
		name: string;
		slug: string;
		created_at: string;
		released_at: string;
		views: number;
		interests: number;
		poster_url: string;
		cover_url: string;
		is_hard_subtitled: boolean;
		brand: string;
		duration_in_ms: number;
		is_censored: boolean;
		rating: number;
		likes: number;
		dislikes: number;
		downloads: number;
		monthly_rank: number;
		brand_id: string;
		is_banned_in: string;
		preview_url: null;
		primary_color: null;
		created_at_unix: number;
		released_at_unix: number;
	}) => {
		return {
			id: raw.id,
			name: raw.name,
			slug: raw.slug,
			views: raw.views,
			interests: raw.interests,
			thumbnailUrl: raw.poster_url,
			coverUrl: raw.cover_url,
			isHardSubtitled: raw.is_hard_subtitled,
			brand: {
				name: raw.brand,
				id: raw.brand_id,
			},
			durationMs: raw.duration_in_ms,
			isCensored: raw.is_censored,
			likes: raw.likes,
			rating: raw.rating,
			dislikes: raw.dislikes,
			downloads: raw.downloads,
			rankMonthly: raw.monthly_rank,
			brandId: raw.brand_id,
			isBannedIn: raw.is_banned_in,
			previewUrl: raw.preview_url,
			color: raw.primary_color,
			createdAt: raw.created_at_unix,
			releasedAt: raw.released_at_unix,
		};
	};
};

export interface HAnimeOptions {
	baseUrl?: string;
	searchUrl?: string;
	signatureGenerator?: () => string;
}

export interface HAnimeVideoInfo {
	title: string;
	slug: string;
	id: number;
	description?: string;
	views: number;
	interests: number;
	posterUrl: string;
	coverUrl: string;
	brand: {
		name: string;
		id: string | number;
	};
	durationMs: number;
	isCensored: boolean;
	likes: number;
	rating: number;
	dislikes: number;
	downloads: number;
	rankMonthly: number;
	tags: HentaiTag[];
	createdAt: string;
	releasedAt: string;
	episodes: {
		next: HentaiVideoEpisode;
		all: HentaiVideoEpisode[];
		random: HentaiVideoEpisode;
	};
}

export interface HentaiVideoEpisode {
	id: number;
	name: string;
	slug: string;
	views: number;
	interests: number;
	thumbnailUrl: string;
	coverUrl: string;
	isHardSubtitled: boolean;
	brand: {
		name: string;
		id: string;
	};
	durationMs: number;
	isCensored: boolean;
	likes: number;
	rating: number;
	dislikes: number;
	downloads: number;
	rankMonthly: number;
	brandId: string;
	isBannedIn: string;
	previewUrl: null;
	color: null;
	createdAt: number;
	releasedAt: number;
}

export interface HAnimeStream {
	id: number;
	serverId: number;
	kind: string;
	extension: string;
	mimeType: string;
	width: number;
	height: string | number;
	durationInMs: number;
	filesizeMbs: number;
	filename: string;
	url: string;
}

export interface HanimeResponse {
	layout: string;
	data: unknown[];
	error: null;
	serverRendered: boolean;
	state: State;
	videos_manifest?: VideosManifest;
	pr?: boolean;
}

export interface State {
	scrollY: number;
	version: number;
	is_new_version: boolean;
	r: null;
	country_code: null;
	page_name: string;
	user_agent: string;
	ip: null;
	referrer: null;
	geo: null;
	is_dev: boolean;
	is_wasm_supported: boolean;
	is_mounted: boolean;
	is_loading: boolean;
	is_searching: boolean;
	browser_width: number;
	browser_height: number;
	system_msg: string;
	data: Data;
	auth_claim: null;
	session_token: string;
	session_token_expire_time_unix: number;
	env: Env;
	user: null;
	user_setting: null;
	playlists: null;
	shuffle: boolean;
	account_dialog: AccountDialog;
	contact_us_dialog: ContactUsDialog;
	general_confirmation_dialog: GeneralConfirmationDialog;
	snackbar: Snackbar;
	search: Search;
}

export interface Data {
	video: Video;
}

export interface Video {
	player_base_url: string;
	hentai_video: HentaiVideo;
	hentai_tags: HentaiTag[];
	hentai_franchise: HentaiFranchise;
	hentai_franchise_hentai_videos: HentaiVideo[];
	hentai_video_storyboards: HentaiVideoStoryboard[];
	brand: Brand;
	watch_later_playlist_hentai_videos: null;
	like_dislike_playlist_hentai_videos: null;
	playlist_hentai_videos: null;
	similar_playlists_data: null;
	next_hentai_video: HentaiVideo;
	next_random_hentai_video: HentaiVideo;
	videos_manifest?: VideosManifest;
	user_license: null;
	bs: Bs;
	ap: number;
	pre: string;
	encrypted_user_license: null;
	host: string;
}

export interface HentaiVideo {
	id: number;
	is_visible: boolean;
	name: string;
	slug: string;
	created_at: string;
	released_at: string;
	description?: string;
	views: number;
	interests: number;
	poster_url: string;
	cover_url: string;
	is_hard_subtitled: boolean;
	brand: string;
	duration_in_ms: number;
	is_censored: boolean;
	rating: number;
	likes: number;
	dislikes: number;
	downloads: number;
	monthly_rank: number;
	brand_id: string;
	is_banned_in: string;
	preview_url: null;
	primary_color: null;
	created_at_unix: number;
	released_at_unix: number;
	hentai_tags?: HentaiTag[];
	titles?: unknown[];
}

export interface HentaiTag {
	id: number;
	text: string;
	count?: number;
	description?: string;
	wide_image_url?: string;
	tall_image_url?: string;
}

export interface HentaiFranchise {
	id: number;
	name: string;
	slug: string;
	title: string;
}

export interface HentaiVideoStoryboard {
	id: number;
	num_total_storyboards: number;
	sequence: number;
	url: string;
	frame_width: number;
	frame_height: number;
	num_total_frames: number;
	num_horizontal_frames: number;
	num_vertical_frames: number;
}

export interface Brand {
	id: number;
	title: string;
	slug: string;
	website_url: null;
	logo_url: null;
	email: null;
	count: number;
}

export interface VideosManifest {
	servers: Server[];
}

export interface Server {
	id: number;
	name: string;
	slug: string;
	na_rating: number;
	eu_rating: number;
	asia_rating: number;
	sequence: number;
	is_permanent: boolean;
	streams: Stream[];
}

export interface Stream {
	id: number;
	server_id: number;
	slug: string;
	kind: string;
	extension: string;
	mime_type: string;
	width: number;
	height: string;
	duration_in_ms: number;
	filesize_mbs: number;
	filename: string;
	url: string;
	is_guest_allowed: boolean;
	is_member_allowed: boolean;
	is_premium_allowed: boolean;
	is_downloadable: boolean;
	compatibility: string;
	hv_id: number;
	server_sequence: number;
	video_stream_group_id: string;
	extra2: null;
}

export interface Bs {
	ntv_1: Ntv1;
	ntv_2: Ntv2;
	footer_0: Footer0;
	native_1: Native1;
	native_0: Native0;
	ntv_0: Ntv0;
}

export interface Ntv1 {
	desktop: DesktopAd;
}

export interface Ntv2 {
	desktop: DesktopAd;
}

export interface Footer0 {
	mobile: MobileAd;
	desktop: DesktopAd;
}

export interface Native1 {
	mobile: NativeAd;
}

export interface Native0 {
	mobile: NativeAd;
}

export interface Ntv0 {
	desktop: DesktopAd;
}

export interface DesktopAd {
	id: number;
	ad_id: string;
	ad_type: string;
	placement: string;
	image_url: null;
	iframe_url: string;
	click_url: null | string;
	width: number;
	height: number;
	page: string;
	form_factor: string;
	video_url: null;
	impressions: number;
	clicks: number;
	seconds: number;
	placement_x: null;
}

export interface MobileAd {
	id: number;
	ad_id: string;
	ad_type: string;
	placement: string;
	image_url: null;
	iframe_url: string;
	click_url: null;
	width: number;
	height: number;
	page: string;
	form_factor: string;
	video_url: null;
	impressions: number;
	clicks: number;
	seconds: number;
	placement_x: null;
}

export interface NativeAd {
	id: number;
	ad_id: string;
	ad_type: string;
	placement: string;
	image_url: string;
	iframe_url: null;
	click_url: string;
	width: number;
	height: number;
	page: string;
	form_factor: string;
	video_url: null;
	impressions: number;
	clicks: number;
	seconds: number;
	placement_x: string;
}

export interface Env {
	vhtv_version: number;
	premium_coin_cost: number;
	mobile_apps: MobileApps;
}

export interface MobileApps {
	code_name: string;
	_build_number: number;
	_semver: string;
	_md5: string;
	_url: string;
}

export interface AccountDialog {
	is_visible: boolean;
	active_tab_id: string;
	tabs: Tab[];
}

export interface Tab {
	id: string;
	icon: string;
	title: string;
}

export interface ContactUsDialog {
	is_visible: boolean;
	is_video_report: boolean;
	subject: string;
	email: string;
	message: string;
	is_sent: boolean;
}

export interface GeneralConfirmationDialog {
	is_visible: boolean;
	is_persistent: boolean;
	is_mini_close_button_visible: boolean;
	is_cancel_button_visible: boolean;
	cancel_button_text: string;
	title: string;
	body: string;
	confirm_button_text: string;
	confirmation_callback: null;
}

export interface Snackbar {
	timeout: number;
	context: string;
	mode: string;
	y: string;
	x: string;
	is_visible: boolean;
	text: string;
}

export interface Search {
	cache_sorting_config: unknown[];
	cache_tags_filter: null;
	cache_active_brands: null;
	cache_blacklisted_tags_filter: null;
	search_text: string;
	search_response_payload: null;
	total_search_results_count: number;
	order_by: string;
	ordering: string;
	tags_match: string;
	page_size: number;
	offset: number;
	page: number;
	number_of_pages: number;
	tags: unknown[];
	active_tags_count: number;
	brands: unknown[];
	active_brands_count: number;
	blacklisted_tags: unknown[];
	active_blacklisted_tags_count: number;
	is_using_preferences: boolean;
}

export interface HAnimeSearchResult {
	id: number;
	name: string;
	titles: string[];
	slug: string;
	description: string;
	views: number;
	interests: number;
	bannerImage: string;
	coverImage: string;
	brand: {
		name: string;
		id: number;
	};
	durationMs: number;
	isCensored: boolean;
	likes: number;
	rating: number;
	dislikes: number;
	downloads: number;
	rankMonthly: number;
	tags: string[];
	createdAt: number;
	releasedAt: number;
}

export interface HAnimeRawSearchResult {
	id: number;
	name: string;
	titles: string[];
	slug: string;
	description: string;
	views: number;
	interests: number;
	poster_url: string;
	cover_url: string;
	brand: string;
	brand_id: number;
	duration_in_ms: number;
	is_censored: boolean;
	likes: number;
	rating: number;
	dislikes: number;
	downloads: number;
	monthly_rank: number;
	tags: string[] | string;
	created_at: number;
	released_at: number;
}

const _hanime = new HAnime();
