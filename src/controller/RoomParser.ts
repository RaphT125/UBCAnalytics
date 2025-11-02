import { InsightError } from "./IInsightFacade";
import { Parsers } from "./Parsers";
import parse5 from "parse5";

//AI was used to create the baseline for this class
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
