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
import type { Room } from "./RoomParser";
import type { Section } from "./SectionParser";
import Decimal from "decimal.js";

// interface Section {
// 	id: string;
// 	Course: string;
// 	Title: string;
// 	Professor: string;
// 	Subject: string;
// 	Year: number;
// 	Avg: number;
// 	Pass: number;
// 	Fail: number;
// 	Audit: number;
// }

interface Query {
	WHERE: any;
	OPTIONS: {
		COLUMNS: string[];
		ORDER?: string | { dir: string; keys: string[] };
	};
	TRANSFORMATIONS?: {
		GROUP: string[];
		APPLY: Array<{
			[applyKey: string]: {
				[token: string]: string;
			};
		}>;
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
				return p;
			} catch {}
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
        const kind = await this.getDatasetKind(datasetId);
        let data: any[];
    
        if (kind === InsightDatasetKind.Sections) {
            data = await this.loadDataset(datasetId);
        } else {
            data = await this.loadRoom(datasetId);
        }
    
        let filtered = this.applyFilters(data, validQuery.WHERE, kind);
    
        if (validQuery.TRANSFORMATIONS) {
            filtered = this.applyTransformations(filtered, validQuery.TRANSFORMATIONS, datasetId);
        } else {
            filtered = this.selectColumns(filtered, validQuery.OPTIONS.COLUMNS, datasetId);
        }
    
        if (filtered.length > 5000) {
            throw new ResultTooLargeError("Query result exceeds 5000 rows");
        }
    
        if (validQuery.OPTIONS.ORDER) {
            filtered = this.sortResults(filtered, validQuery.OPTIONS.ORDER);
        }
    
        return filtered;
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
            if (column.includes("_")) {
                this.validateColumnName(column);
            }
        }
    
        if (q.hasOwnProperty("TRANSFORMATIONS")) {
            const trans = q.TRANSFORMATIONS;
    
            if (!trans || typeof trans !== "object") {
                throw new InsightError("TRANSFORMATIONS must be an object");
            }
    
            if (!trans.hasOwnProperty("GROUP") || !trans.hasOwnProperty("APPLY")) {
                throw new InsightError("TRANSFORMATIONS must have GROUP and APPLY");
            }
    
            if (!Array.isArray(trans.GROUP)) {
                throw new InsightError("GROUP must be an array");
            }
    
            if (!Array.isArray(trans.APPLY)) {
                throw new InsightError("APPLY must be an array");
            }
    
            for (const key of trans.GROUP) {
                if (typeof key !== "string") {
                    throw new InsightError("GROUP keys must be strings");
                }
                this.validateColumnName(key);
            }
    
            const applyKeys = new Set<string>();
            for (const rule of trans.APPLY) {
                const applyKey = Object.keys(rule)[0];
    
                if (applyKeys.has(applyKey)) {
                    throw new InsightError("Duplicate applykey: " + applyKey);
                }
    
                if (applyKey.includes("_")) {
                    throw new InsightError("applykey cannot contain underscore");
                }
    
                applyKeys.add(applyKey);
    
                const applyBody = rule[applyKey];
                const token = Object.keys(applyBody)[0];
                const key = applyBody[token];
    
                const validTokens = ["MAX", "MIN", "AVG", "SUM", "COUNT"];
                if (!validTokens.includes(token)) {
                    throw new InsightError("Invalid APPLYTOKEN: " + token);
                }
    
                this.validateColumnName(key);
    
                if (["MAX", "MIN", "AVG", "SUM"].includes(token)) {
                    const fieldName = key.split("_")[1];
                    const numericFields = ["avg", "pass", "fail", "audit", "year", "lat", "lon", "seats"];
                    if (!numericFields.includes(fieldName)) {
                        throw new InsightError(`${token} can only be used with numeric fields`);
                    }
                }
            }
    
            for (const column of options.COLUMNS) {
                const isInGroup = trans.GROUP.includes(column);
                const isInApply = applyKeys.has(column);
    
                if (!isInGroup && !isInApply) {
                    throw new InsightError("COLUMNS key must be in GROUP or APPLY: " + column);
                }
            }
        }
    
        if (options.hasOwnProperty("ORDER")) {
            if (typeof options.ORDER === "string") {
                this.validateColumnName(options.ORDER);
                if (!options.COLUMNS.includes(options.ORDER)) {
                    throw new InsightError("ORDER key must be in COLUMNS");
                }
            } else if (typeof options.ORDER === "object") {
                const order = options.ORDER;
    
                if (!order.hasOwnProperty("dir") || !order.hasOwnProperty("keys")) {
                    throw new InsightError("ORDER object must have 'dir' and 'keys'");
                }
    
                if (order.dir !== "UP" && order.dir !== "DOWN") {
                    throw new InsightError("ORDER dir must be 'UP' or 'DOWN'");
                }
    
                if (!Array.isArray(order.keys) || order.keys.length === 0) {
                    throw new InsightError("ORDER keys must be a non-empty array");
                }
    
                for (const key of order.keys) {
                    if (!options.COLUMNS.includes(key)) {
                        throw new InsightError("ORDER key must be in COLUMNS: " + key);
                    }
                }
            } else {
                throw new InsightError("ORDER must be a string or object");
            }
        }
    
        return q as Query;
    }

	private validateColumnName(column: string): void {
        const parts = column.split("_");
        if (parts.length !== 2 || parts[0] === "" || parts[1] === "") {
            throw new InsightError(`Invalid column name: ${column}`);
        }
    
        const validFields = [
            "id",
            "course",
            "title",
            "instructor",
            "dept",
            "year",
            "avg",
            "pass",
            "fail",
            "audit",
            "fullname",
            "shortname",
            "number",
            "name",
            "address",
            "lat",
            "lon",
            "seats",
            "type",
            "furniture",
            "href",
        ];
        const fieldName = parts[1];
    
        if (!validFields.includes(fieldName)) {
            throw new InsightError(`Invalid column name: ${column}`);
        }
    }

	private extractDatasetId(query: Query): string {
        const firstColumn = query.OPTIONS.COLUMNS[0];
        let datasetId = "";
    
        if (firstColumn.includes("_")) {
            datasetId = firstColumn.split("_")[0];
        } else if (query.TRANSFORMATIONS) {
            if (query.TRANSFORMATIONS.GROUP.length > 0) {
                datasetId = query.TRANSFORMATIONS.GROUP[0].split("_")[0];
            } else if (query.TRANSFORMATIONS.APPLY.length > 0) {
                const firstApply = query.TRANSFORMATIONS.APPLY[0];
                const applyKey = Object.keys(firstApply)[0];
                const applyBody = firstApply[applyKey];
                const token = Object.keys(applyBody)[0];
                const key = applyBody[token];
                datasetId = key.split("_")[0];
            }
        }
    
        for (const column of query.OPTIONS.COLUMNS) {
            if (column.includes("_") && !column.startsWith(datasetId + "_")) {
                throw new InsightError("Query references multiple datasets");
            }
        }
    
        this.checkDatasetConsistency(query.WHERE, datasetId);
    
        if (query.TRANSFORMATIONS) {
            for (const groupKey of query.TRANSFORMATIONS.GROUP) {
                if (!groupKey.startsWith(datasetId + "_")) {
                    throw new InsightError("Query references multiple datasets");
                }
            }
    
            for (const applyRule of query.TRANSFORMATIONS.APPLY) {
                const applyKey = Object.keys(applyRule)[0];
                const applyBody = applyRule[applyKey];
                const token = Object.keys(applyBody)[0];
                const key = applyBody[token];
    
                if (!key.startsWith(datasetId + "_")) {
                    throw new InsightError("Query references multiple datasets");
                }
            }
        }
    
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

	private applyFilters(data: any[], where: any, kind: InsightDatasetKind): any[] {
        if (!where || Object.keys(where).length === 0) {
            return data;
        }
    
        return data.filter((item) => this.checkCondition(item, where));
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

	private selectColumns(data: any[], columns: string[], datasetId: string): InsightResult[] {
        return data.map((item) => {
            const result: InsightResult = {};
    
            for (const column of columns) {
                const fieldName = column.split("_")[1];
                const mappedField = this.getFieldName(fieldName);
                let value = (item as any)[mappedField];
    
                if (column.endsWith("_id")) {
                    value = String(value);
                }
    
                result[column] = value;
            }
    
            return result;
        });
    }

	private sortResults(results: InsightResult[], order: string | { dir: string; keys: string[] }): InsightResult[] {
        if (typeof order === "string") {
            return results.sort((a, b) => {
                const aVal = a[order];
                const bVal = b[order];
    
                if (typeof aVal === "number" && typeof bVal === "number") {
                    return aVal - bVal;
                }
                if (typeof aVal === "string" && typeof bVal === "string") {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                }
                return 0;
            });
        }
    
        const { dir, keys } = order;
        const direction = dir === "UP" ? 1 : -1;
    
        return results.sort((a, b) => {
            for (const key of keys) {
                const aVal = a[key];
                const bVal = b[key];
    
                let comparison = 0;
    
                if (typeof aVal === "number" && typeof bVal === "number") {
                    comparison = aVal - bVal;
                } else if (typeof aVal === "string" && typeof bVal === "string") {
                    comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                }
    
                if (comparison !== 0) {
                    return comparison * direction;
                }
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
            fullname: "fullname",
            shortname: "shortname",
            number: "number",
            name: "name",
            address: "address",
            lat: "lat",
            lon: "lon",
            seats: "seats",
            type: "type",
            furniture: "furniture",
            href: "href",
        };
    
        return fieldMap[fieldName] || fieldName;
    }

	public async listDatasets(): Promise<InsightDataset[]> {
		const fileDirectSection = directory + "/" + "sections";
		const fileDirectRooms = directory + "/" + "rooms";
		const list: InsightDataset[] = [];
		let sectionFiles: string[] = [];
		let roomFiles: string[] = [];
		try {
			sectionFiles = await fsPromises.readdir(fileDirectSection);
			for (const id of sectionFiles) {
				const file = await this.loadDataset(id);
				list.push({ id: id, kind: InsightDatasetKind.Sections, numRows: file.length });
			}
		} catch (e) {}
		try {
			roomFiles = await fsPromises.readdir(fileDirectRooms);
			for (const id of roomFiles) {
				const file = await this.loadRoom(id);
				list.push({ id: id, kind: InsightDatasetKind.Rooms, numRows: file.length });
			}
		} catch (e) {}
		return list;
	}

	private async loadRoom(datasetId: string): Promise<Room[]> {
		const filePath = directory + "/rooms/" + datasetId;

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
			return parsed as Room[];
		} catch (error) {
			throw new InsightError(`Dataset ${datasetId} not found`);
		}
	}

    private async getDatasetKind(id: string): Promise<InsightDatasetKind> {
        const sectionPath = `${directory}/sections/${id}`;
        const roomPath = `${directory}/rooms/${id}`;
    
        try {
            await fsPromises.access(sectionPath);
            return InsightDatasetKind.Sections;
        } catch {
            try {
                await fsPromises.access(roomPath);
                return InsightDatasetKind.Rooms;
            } catch {
                throw new InsightError(`Dataset ${id} not found`);
            }
        }
    }

    private applyTransformations(
        data: any[],
        transformations: { GROUP: string[]; APPLY: any[] },
        datasetId: string
    ): InsightResult[] {
        const { GROUP, APPLY } = transformations;
        const groups = new Map<string, any[]>();
    
        for (const item of data) {
            const groupKey = GROUP.map((key) => {
                const fieldName = key.split("_")[1];
                const mappedField = this.getFieldName(fieldName);
                return item[mappedField];
            }).join("|");
    
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            groups.get(groupKey)!.push(item);
        }
    
        const results: InsightResult[] = [];
    
        for (const [groupKey, groupItems] of groups) {
            const result: InsightResult = {};
    
            GROUP.forEach((key, index) => {
                const fieldName = key.split("_")[1];
                const mappedField = this.getFieldName(fieldName);
                result[key] = groupItems[0][mappedField];
            });
    
            for (const applyRule of APPLY) {
                const applyKey = Object.keys(applyRule)[0];
                const applyBody = applyRule[applyKey];
                const token = Object.keys(applyBody)[0];
                const key = applyBody[token];
    
                const fieldName = key.split("_")[1];
                const mappedField = this.getFieldName(fieldName);
    
                result[applyKey] = this.applyOperation(token, groupItems, mappedField);
            }
    
            results.push(result);
        }
    
        return results;
    }

    private applyOperation(token: string, items: any[], field: string): number {
        const values = items.map((item) => item[field]);
    
        switch (token) {
            case "MAX":
                return Math.max(...values);
    
            case "MIN":
                return Math.min(...values);
    
            case "AVG":
                let total = new Decimal(0);
    
                for (const val of values) {
                    total = total.add(new Decimal(val));
                }
    
                const avg = total.toNumber() / values.length;
                return Number(avg.toFixed(2));
    
            case "SUM":
                const sum = values.reduce((acc, val) => acc + val, 0);
                return Number(sum.toFixed(2));
    
            case "COUNT":
                const unique = new Set(values);
                return unique.size;
    
            default:
                throw new InsightError("Invalid APPLYTOKEN");
        }
    }
}
