import { InsightError } from "./IInsightFacade";
import { Parsers } from "./Parsers";
import parse5 from "parse5";

/** Minimal room row type (extend as you implement more fields) */
export interface Room {}

export class RoomParser extends Parsers<Room> {
	constructor(directory: string) {
		super(directory);
	}

	public async parse(content: string): Promise<Room[]> {
		let zip = await this.unzip(content);
		const indexFiles = zip.file(/(^|\/)index\.htm(l)?$/i);
		if (indexFiles.length === 0) {
			throw new InsightError("invalid files path");
		}
		const indexContent = await indexFiles[0].async("text");
		const doc = parse5.parse(indexContent);

		return [];
	}
}
