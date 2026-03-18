// This file has exports WITHOUT TSDoc - enforcer should catch these
export function noDocsFunction(x: number): number {
	return x * 2;
}

export interface NoDocsInterface {
	value: string;
}
