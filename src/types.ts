export interface PaginatedResult<T> {
	results?: T[];
	total?: number;
	page?: number;
	pages?: number;
	next?: number;
	previous?: number;
	hasNextPage?: boolean;
}
