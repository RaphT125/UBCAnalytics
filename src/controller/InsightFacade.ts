import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightError, InsightResult } from "./IInsightFacade";
import JSZip from "jszip";
/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// TODO: Remove this once you implement the methods!
		try {
			const temp = await this.fileParser(content);
			if (temp.length == 0) {
				throw new InsightError("file parsing error");
			}
		} catch (e) {
			throw new InsightError("file parsing error" + e);
		}
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError(" id is invalid");
		}

		if (kind != "sections") {
			throw new InsightError(" kind is invalid");
		}
		throw new Error(
			`InsightFacadeImpl::addDataset() is unimplemented! - id=${id}; content=${content?.length}; kind=${kind}`
		);
	}

	private async fileParser(content: string) {
		let zip: JSZip;
		try {
			zip = await JSZip.loadAsync(content, { base64: true });
		} catch {
			throw new InsightError(" wrong file type");
		}
		const folder = zip.folder("courses");
		if (!folder) {
			throw new InsightError("invalid folder path");
		}
		const files = folder.file(/.*/);

		if (files.length == 0) {
			throw new InsightError("no files found");
		} else {
			const requiredFields = ["id", "Course", "Title", "Professor", "Subject", "Year", "Avg", "Pass", "Fail", "Audit"];
			const fileContent = files.map(async (file) => {
				const jsonContent = await file.async("text");
				const parsed = JSON.parse(jsonContent);

				if (!Array.isArray(parsed.result)) {
					return [];
				}

				// keep only valid entries with required fields
				return parsed.result
					.filter((entry: any) => requiredFields.every((key) => entry.hasOwnProperty(key)))
					.map((entry: any) => {
						const cleaned: any = {};
						for (const key of requiredFields) {
							cleaned[key] = entry[key];
						}
						return cleaned;
					});
			});
			try {
				const parsedFiles = await Promise.all(fileContent);
				return parsedFiles.flat();
			} catch (e) {
				throw new InsightError("invalid file entry");
			}
		}
	}
	public async removeDataset(id: string): Promise<string> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::removeDataset() is unimplemented! - id=${id};`);
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
	}
}
