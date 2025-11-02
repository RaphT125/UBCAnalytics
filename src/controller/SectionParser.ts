import { InsightError, InsightDatasetKind } from "./IInsightFacade";
import { Parsers } from "./Parsers";

export interface Section {
	id: string;
	Course: string;
	Title: string;
	Professor: string;
	Subject: string;
	Year: number;
	Avg: number;
	Pass: number;
	Fail: number;
	Audit: number;
}

export class SectionParser extends Parsers<Section> {
	constructor(directory: string) {
		super(directory);
	}

	public async parse(content: string): Promise<Section[]> {
		let zip = await this.unzip(content);

		const folder = zip.folder("courses");
		if (!folder) {
			throw new InsightError("invalid folder path");
		}

		const files = folder.file(/.*/);
		if (files.length === 0) {
			throw new InsightError("no files found");
		}

		const required = ["id", "Course", "Title", "Professor", "Subject", "Year", "Avg", "Pass", "Fail", "Audit"];
		const numeric = new Set(["Year", "Avg", "Pass", "Fail", "Audit"]);

		const loaders = files.map(async (f) => {
			const raw = await f.async("text");
			let json: any;
			try {
				json = JSON.parse(raw);
			} catch {
				return [] as Section[];
			}
			if (!Array.isArray(json.result)) {
				return [] as Section[];
			}

			const rows: Section[] = [];
			for (const entry of json.result) {
				if (!required.every((k) => Object.prototype.hasOwnProperty.call(entry, k))) {
					continue;
				}
				const cleaned: any = {};
				let badNumber = false;
				for (const k of required) {
					if (numeric.has(k)) {
						const v = Number(entry[k]);
						if (!Number.isFinite(v)) {
							badNumber = true;
							break;
						}
						cleaned[k] = v;
					} else {
						cleaned[k] = entry[k];
					}
				}
				if (!badNumber) rows.push(cleaned as Section);
			}
			return rows;
		});

		const parsed = (await Promise.all(loaders)).flat();
		if (parsed.length === 0) {
			throw new InsightError("file parsing error");
		}
		return parsed;
	}
}
