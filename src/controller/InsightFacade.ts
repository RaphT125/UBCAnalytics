import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
} from "./IInsightFacade";
import JSZip from "jszip";
import { promises as fsPromises } from "fs";
/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
const directory = "./data";
export default class InsightFacade implements IInsightFacade {
	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		try {
			const parsed = await Promise.all([this.fileParser(content), this.idAndSectionChecker(id, kind)]);
			await this.writeFile(id, parsed);
		} catch (e) {
			throw new InsightError("file parsing error" + e);
		}

		return await this.listID();
	}
	private async listID(): Promise<string[]> {
		try {
			return await fsPromises.readdir(directory + "/" + "sections");
		} catch (e) {
			throw new InsightError("failed to access data directory");
		}
	}

	private async writeFile(id: string, data: any[]): Promise<void> {
		try {
			const kindDirect = directory + "/" + "sections";
			const fileDirect = kindDirect + "/" + id;
			await fsPromises.mkdir(kindDirect, { recursive: true });
			await fsPromises.writeFile(fileDirect, JSON.stringify(data));
		} catch (e) {
			throw new InsightError("writeFile error");
		}
	}
	private async duplicateID(id: string): Promise<boolean> {
		const fileDirect = directory + "/" + "sections" + "/" + id;
		try {
			await fsPromises.access(fileDirect);
			return true;
		} catch (e) {
			return false;
		}
	}
	private async idAndSectionChecker(id: string, kind: InsightDatasetKind): Promise<void> {
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError(" id is invalid");
		}
		if (kind != "sections") {
			throw new InsightError(" kind is invalid");
		}
		if (await this.duplicateID(id)) {
			throw new InsightError(" id duplicate");
		}
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
			const numberFiled = ["Year", "Avg", "Pass", "Fail", "Audit"];
			const fileContent = files.map(async (file) => {
				const jsonContent = await file.async("text");
				let parsed: any;
				try {
					parsed = JSON.parse(jsonContent);
				} catch (e) {
					return [];
				}
				if (!Array.isArray(parsed.result)) {
					return [];
				}
				return parsed.result
					.filter((entry: any) => requiredFields.every((key) => entry.hasOwnProperty(key)))
					.map((entry: any) => {
						const cleaned: any = {};
						for (const key of requiredFields) {
							for (const numKey of numberFiled) {
								if (key == numKey) {
									const num = Number(entry[key]);
									if (Number.isFinite(num)) {
										cleaned[key] = num;
									} else {
										return [];
									}
								} else {
									cleaned[key] = entry[key];
								}
							}
						}
						return cleaned;
					});
			});
			try {
				const parsedFiles = await Promise.all(fileContent);
				if (parsedFiles.flat().length == 0) {
					throw new InsightError("file parsing error");
				} else {
					return parsedFiles.flat();
				}
			} catch (e) {
				throw new InsightError("invalid file entry");
			}
		}
	}
	public async removeDataset(id: string): Promise<string> {
		// TODO: Remove this once you implement the methods!
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError(" id is invalid");
		}
		const exists = await this.duplicateID(id);
		if (exists) {
			const path = directory + "/" + "sections" + "/" + id;
			try {
				await fsPromises.unlink(path);
				return id;
			} catch (e) {
				throw new InsightError("Error removing Dataset");
			}
		} else {
			throw new NotFoundError("dataset Not present");
		}
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		const fileDirect = directory + "/" + "sections";
		let list: InsightDataset[] = [];
		try {
			const files = await fsPromises.readdir(fileDirect);
			for (const id of files) {
				const path = fileDirect + "/" + id;
				const file = await fsPromises.readFile(path);
				list.push({ id, kind: InsightDatasetKind.Sections, numRows: file.length });
			}
			return list;
		} catch (e) {
			return [];
		}
	}
}
