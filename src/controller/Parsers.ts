import JSZip from "jszip";

import { InsightError } from "./IInsightFacade";

export abstract class Parsers<T> {
	protected readonly directory: string;

	constructor(directory: string) {
		this.directory = directory;
	}

	protected async unzip(content: string): Promise<JSZip> {
		try {
			return await JSZip.loadAsync(content, { base64: true });
		} catch {
			throw new InsightError(" wrong file type");
		}
	}

	public abstract parse(content: string): Promise<T[]>;
}
