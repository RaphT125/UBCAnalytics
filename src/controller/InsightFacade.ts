import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "./IInsightFacade";
import fsPromises from "fs-extra";
import { Parsers } from "./Parsers";
import { SectionParser } from "./SectionParser";
import { RoomParser } from "./RoomParser";

interface Section {
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

interface Query {
	WHERE: any;
	OPTIONS: {
		COLUMNS: string[];
		ORDER?: string;
	};
}
const directory = "./data";
export default class InsightFacade implements IInsightFacade {
	//AI was used to help debug
	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		try {
			const parser = this.getParser(kind);
			await this.validateId(id);
			const parsed = await parser.parse(content);
			await this.writeFile(id, parsed, kind);
		} catch (e) {
			throw new InsightError("file parsing error" + e);
		}

		return await this.listID();
	}
	private getParser(kind: InsightDatasetKind): Parsers<any> {
		switch (kind) {
			case InsightDatasetKind.Sections:
				return new SectionParser(directory);
			case InsightDatasetKind.Rooms:
				return new RoomParser(directory);
			default:
				throw new InsightError(" kind is invalid");
		}
	}

	private async listID(): Promise<string[]> {
		try {
			const kinds = Object.values(InsightDatasetKind);
			const results = await Promise.all(
				kinds.map(async (kind) => {
					const path = `${directory}/${kind}`;
					try {
						return await fsPromises.readdir(path);
					} catch (err: any) {
						return [];
					}
				})
			);
			return results.flat();
		} catch (e) {
			throw new InsightError("failed to access data directory");
		}
	}

	private async writeFile(id: string, data: any[], kind: InsightDatasetKind): Promise<void> {
		try {
			const kindDirect = directory + "/" + kind;
			const fileDirect = kindDirect + "/" + id;
			await fsPromises.mkdir(kindDirect, { recursive: true });
			await fsPromises.writeFile(fileDirect, JSON.stringify(data));
		} catch (e) {
			throw new InsightError("writeFileSections error");
		}
	}
	private async validateId(id: string): Promise<void> {
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError(" id is invalid");
		}

		if (await this.findDatasetPath(id)) {
			throw new InsightError(" id duplicate");
		}
	}

	private async findDatasetPath(id: string): Promise<string | null> {
		const kinds = Object.values(InsightDatasetKind);
		for (let i = 0; i < kinds.length; i++) {
			const p = `${directory}/${kinds[i]}/${id}`;
			try {
				await fsPromises.access(p);
				return p; // first match
			} catch {
				// keep searching
			}
		}
		return null;
	}

	public async removeDataset(id: string): Promise<string> {
		if (id.trim() === "" || id.includes("_")) {
			throw new InsightError(" id is invalid");
		}
		const path = await this.findDatasetPath(id);
		if (path) {
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
		const validQuery = this.validateQuery(query);
		const datasetId = this.extractDatasetId(validQuery);
		const sections = await this.loadDataset(datasetId);
		const filtered = this.applyFilters(sections, validQuery.WHERE);

		if (filtered.length > 5000) {
			throw new ResultTooLargeError("Query result exceeds 5000 rows");
		}

		let results = this.selectColumns(filtered, validQuery.OPTIONS.COLUMNS, datasetId);

		if (validQuery.OPTIONS.ORDER) {
			results = this.sortResults(results, validQuery.OPTIONS.ORDER);
		}

		return results;
	}

	private validateQuery(query: unknown): Query {
		if (!query || typeof query !== "object") {
			throw new InsightError("Query must be an object");
		}

		const q = query as any;

		if (!q.hasOwnProperty("WHERE")) {
			throw new InsightError("Query missing WHERE clause");
		}

		if (!q.hasOwnProperty("OPTIONS")) {
			throw new InsightError("Query missing OPTIONS clause");
		}

		const options = q.OPTIONS;
		if (!options || typeof options !== "object") {
			throw new InsightError("OPTIONS must be an object");
		}

		if (!options.hasOwnProperty("COLUMNS")) {
			throw new InsightError("OPTIONS missing COLUMNS");
		}

		if (!Array.isArray(options.COLUMNS)) {
			throw new InsightError("COLUMNS must be an array");
		}

		if (options.COLUMNS.length === 0) {
			throw new InsightError("COLUMNS cannot be empty");
		}

		for (const column of options.COLUMNS) {
			if (typeof column !== "string") {
				throw new InsightError("Column names must be strings");
			}
			this.validateColumnName(column);
		}

		if (options.hasOwnProperty("ORDER")) {
			if (typeof options.ORDER !== "string") {
				throw new InsightError("ORDER must be a string");
			}
			this.validateColumnName(options.ORDER);

			if (!options.COLUMNS.includes(options.ORDER)) {
				throw new InsightError("ORDER key must be in COLUMNS");
			}
		}

		return q as Query;
	}

	private validateColumnName(column: string): void {
		const parts = column.split("_");
		if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
			throw new InsightError(`Invalid column name: ${column}`);
		}

		const validFields = ["id", "course", "title", "instructor", "dept", "year", "avg", "pass", "fail", "audit"];
		const fieldName = parts[1];

		if (!validFields.includes(fieldName)) {
			throw new InsightError(`Invalid column name: ${column}`);
		}
	}

	private extractDatasetId(query: Query): string {
		const firstColumn = query.OPTIONS.COLUMNS[0];
		const datasetId = firstColumn.split("_")[0];

		for (const column of query.OPTIONS.COLUMNS) {
			if (!column.startsWith(datasetId + "_")) {
				throw new InsightError("Query references multiple datasets");
			}
		}

		this.checkDatasetConsistency(query.WHERE, datasetId);

		return datasetId;
	}

	private checkDatasetConsistency(where: any, datasetId: string): void {
		if (!where || typeof where !== "object") {
			return;
		}

		for (const [key, value] of Object.entries(where)) {
			if (key === "GT" || key === "LT" || key === "EQ" || key === "IS") {
				const compObj = value as any;
				for (const field of Object.keys(compObj)) {
					const parts = field.split("_");
					if (parts.length !== 2 || parts[0] !== datasetId || parts[1] === "") {
						throw new InsightError("Query references multiple datasets");
					}
				}
			} else if (key === "AND" || key === "OR") {
				const conditions = value as any[];
				for (const condition of conditions) {
					this.checkDatasetConsistency(condition, datasetId);
				}
			} else if (key === "NOT") {
				this.checkDatasetConsistency(value, datasetId);
			}
		}
	}

	private async loadDataset(datasetId: string): Promise<Section[]> {
		const filePath = directory + "/sections/" + datasetId;

		try {
			const data = await fsPromises.readFile(filePath, "utf8");
			let parsed = JSON.parse(data);

			while (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0])) {
				parsed = parsed[0];
			}

			if (Array.isArray(parsed) && parsed.length > 0) {
				if (Array.isArray(parsed[0])) {
					parsed = parsed.flat();
				}
			}

			return parsed as Section[];
		} catch (error) {
			throw new InsightError(`Dataset ${datasetId} not found`);
		}
	}

	private applyFilters(sections: Section[], where: any): Section[] {
		if (!where || Object.keys(where).length === 0) {
			return sections;
		}

		return sections.filter((section) => this.checkCondition(section, where));
	}

	private checkCondition(section: Section, condition: any): boolean {
		if (!condition || typeof condition !== "object") {
			return true;
		}

		const [operator, operand] = Object.entries(condition)[0];

		switch (operator) {
			case "GT":
				return this.doComparison(section, operand, ">");
			case "LT":
				return this.doComparison(section, operand, "<");
			case "EQ":
				return this.doComparison(section, operand, "=");
			case "IS":
				if (!operand || Object.keys(operand).length === 0) {
					throw new InsightError("IS cannot be empty");
				}
				return this.doStringMatch(section, operand);
			case "AND":
				if (!Array.isArray(operand) || operand.length === 0) {
					throw new InsightError("AND cannot be empty");
				}
				return operand.every((cond) => this.checkCondition(section, cond));
			case "OR":
				if (!Array.isArray(operand) || operand.length === 0) {
					throw new InsightError("OR cannot be empty");
				}
				return operand.some((cond) => this.checkCondition(section, cond));
			case "NOT":
				if (!operand || typeof operand !== "object" || Object.keys(operand).length === 0) {
					throw new InsightError("NOT cannot be empty");
				}
				return !this.checkCondition(section, operand);
			default:
				throw new InsightError(`Unknown operator: ${operator}`);
		}
	}

	private doComparison(section: Section, operand: any, operator: string): boolean {
		const [field, value] = Object.entries(operand)[0];
		const fieldName = field.split("_")[1];
		const sectionValue = (section as any)[this.getFieldName(fieldName)];

		if (typeof value !== "number" || typeof sectionValue !== "number") {
			throw new InsightError("Numeric comparison requires number values");
		}

		switch (operator) {
			case ">":
				return sectionValue > value;
			case "<":
				return sectionValue < value;
			case "=":
				return sectionValue === value;
			default:
				return false;
		}
	}

	private doStringMatch(section: Section, operand: any): boolean {
		const [field, pattern] = Object.entries(operand)[0] as [string, string];
		const fieldName = field.split("_")[1];
		const sectionValue = (section as any)[this.getFieldName(fieldName)];

		if (typeof pattern !== "string" || typeof sectionValue !== "string") {
			throw new InsightError("String comparison requires string values");
		}

		if (pattern.includes("*")) {
			const starCount = (pattern.match(/\*/g) || []).length;
			const firstStar = pattern.indexOf("*");
			const lastStar = pattern.lastIndexOf("*");

			if (
				starCount > 2 ||
				(starCount === 2 && firstStar !== 0) ||
				(starCount === 1 && firstStar !== 0 && firstStar !== pattern.length - 1)
			) {
				throw new InsightError("Invalid wildcard usage");
			}

			const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*");
			const regex = new RegExp("^" + escaped + "$");
			return regex.test(sectionValue);
		}

		return sectionValue === pattern;
	}

	private selectColumns(sections: Section[], columns: string[], datasetId: string): InsightResult[] {
		return sections.map((section) => {
			const result: InsightResult = {};

			for (const column of columns) {
				const fieldName = column.split("_")[1];
				const mappedField = this.getFieldName(fieldName);
				let value = (section as any)[mappedField];

				if (column === "sections_id") {
					value = String(value);
				}

				result[column] = value;
			}

			return result;
		});
	}

	private sortResults(results: InsightResult[], orderKey: string): InsightResult[] {
		return results.sort((a, b) => {
			const aVal = a[orderKey];
			const bVal = b[orderKey];

			if (typeof aVal === "number" && typeof bVal === "number") {
				const diff = aVal - bVal;
				if (diff !== 0) return diff;

				const aStr = JSON.stringify(a);
				const bStr = JSON.stringify(b);
				return aStr.localeCompare(bStr);
			}

			if (typeof aVal === "string" && typeof bVal === "string") {
				return aVal.localeCompare(bVal);
			}

			return 0;
		});
	}

	private getFieldName(fieldName: string): string {
		const fieldMap: { [key: string]: string } = {
			id: "Course",
			course: "Course",
			title: "Title",
			instructor: "Professor",
			dept: "Subject",
			year: "Year",
			avg: "Avg",
			pass: "Pass",
			fail: "Fail",
			audit: "Audit",
		};

		return fieldMap[fieldName] || fieldName;
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		const fileDirect = directory + "/" + "sections";
		const list: InsightDataset[] = [];
		try {
			const files = await fsPromises.readdir(fileDirect);
			for (const id of files) {
				//const path = fileDirect + "/" + id;
				const file = await this.loadDataset(id);
				list.push({ id, kind: InsightDatasetKind.Sections, numRows: file.length });
			}
			return list;
		} catch (e) {
			return [];
		}
	}
}
