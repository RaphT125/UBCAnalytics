import { InsightError } from "./IInsightFacade";
import { Parsers } from "./Parsers";
import parse5 from "parse5";
import http from "http";

//AI was used to create the baseline signatures for this class
export interface Room {
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;
	lat: number;
	lon: number;
	seats: number;
	type: string;
	furniture: string;
	href: string;
}
interface building {
	href: string;
	fullname: string;
	shortname: string;
	address: string;
	lat: number;
	lon: number;
}
interface GeoResponse {
	lat?: number;
	lon?: number;
	error?: string;
}

export class RoomParser extends Parsers<Room> {
	constructor(directory: string) {
		super(directory);
	}

	public async parse(content: string): Promise<Room[]> {
		let zip = await this.unzip(content);
		const indexFilesB = zip.file(/index\.htm$/);
		if (indexFilesB.length === 0) {
			throw new InsightError("invalid files path");
		}
		const indexBuilding = await indexFilesB[0].async("text");
		const parsedHTMBuilding = parse5.parse(indexBuilding);
		const buildings = await this.buildingList(parsedHTMBuilding);
		if (buildings.length === 0) {
			throw new InsightError("No Buildings Found");
		}

		let rooms: Room[] = [];
		for (const b of buildings) {
			let href = b.href;
			href = b.href.slice(2);
			const file = zip.file(href);
			if (!file) {
				throw new InsightError("missing building file");
			}
			const indexRoom = await file.async("text");
			const parsedHTMRoom = parse5.parse(indexRoom);
			const room = await this.roomBuilder(b, parsedHTMRoom);
			rooms.concat(room);
		}
		return rooms;
	}

	private async buildingList(parsedHTM: any): Promise<building[]> {
		const buildings: building[] = [];
		let rows = this.findNodes(parsedHTM, (node) => node.tagName === "tr");
		if (rows.length === 0) return buildings;
		for (const row of rows) {
			const b: building = { fullname: "", shortname: "", href: "", address: "", lat: 0, lon: 0 };
			if (!row.childNodes) continue;
			for (const element of row.childNodes) {
				if (element.tagName === "td") {
					const classValue = this.getAttr(element, "class") ?? "";
					if (classValue.includes("views-field-title")) {
						const a = (element.childNodes ?? []).find((c: any) => c.tagName === "a");
						if (a) {
							b.fullname = this.getContent(a).trim() as string;
							b.href = this.getAttr(a, "href").trim();
						}
					} else if (classValue.includes("views-field-field-building-address")) {
						b.address = this.getContent(element).trim() as string;
						const geoLocaiton = await this.geolocator(b.address);
						if (geoLocaiton.error) {
							throw new InsightError("geoLocaiton error for: " + b.address);
						} else {
							b.lon = geoLocaiton.lon as number;
							b.lat = geoLocaiton.lat as number;
						}
					} else if (classValue.includes("views-field-field-building-code")) {
						b.shortname = this.getContent(element);
					}
				}
			}
			if (
				b.fullname.length > 0 &&
				b.shortname.length > 0 &&
				b.address.length > 0 &&
				// b.lat != 0 &&
				// b.lon != 0 &&
				b.href.length > 0
			) {
				buildings.push(b);
			}
		}
		return buildings;
	}

	private async roomBuilder(b: building, parsedHTM: any): Promise<Room[]> {
		const rooms: Room[] = [];
		let rows = this.findNodes(parsedHTM, (node) => node && node.tagName === "tr");
		if (rows.length === 0) return rooms;
		for (const row of rows) {
			let room: Room = { ...b, number: "", name: "", seats: 0, type: "", furniture: "" };
			if (row.childNodes.length === 0) continue;
			for (const element of row.childNodes) {
				if (element.tagName === "td") {
					const classValue = this.getAttr(element, "class") ?? "";
					if (classValue.includes("views-field-field-room-capacity")) {
						room.seats = parseInt(this.getContent(element));
					} else if (classValue.includes("views-field-field-room-number")) {
						const a = (element.childNodes ?? []).find((c: any) => c.tagName === "a");
						if (a) {
							room.number = this.getContent(a).trim() as string;
							room.href = this.getAttr(a, "href").trim();
						}
					} else if (classValue.includes("views-field-field-room-furniture")) {
						room.furniture = this.getContent(element).trim() as string;
					} else if (classValue.includes("views-field-field-room-type")) {
						room.type = this.getContent(element).trim() as string;
					}
				}
			}
			if (
				room.fullname.length > 0 &&
				room.shortname.length > 0 &&
				room.number.length > 0 &&
				room.address.length > 0 &&
				isFinite(room.lat) &&
				isFinite(room.lon) &&
				isFinite(room.seats) &&
				room.href.length > 0
			) {
				room.name = room.shortname + "_" + room.number;
				rooms.push(room);
			}
		}
		return rooms;
	}

	private findNodes(parsed: any, predicate: (node: any) => boolean): any[] {
		let nodes: any[] = [];
		if (predicate(parsed)) {
			nodes.push(parsed);
		} else {
			if (parsed.childNodes) {
				for (const child of parsed.childNodes) {
					nodes.push(...this.findNodes(child, predicate));
				}
			}
		}
		return nodes;
	}

	private getAttr(element: any, name: string): string {
		if (element && element.attrs) {
			for (const attr of element.attrs) {
				if (attr.name === name) {
					return attr.value ? attr.value : "";
				}
			}
		}
		return "";
	}

	private getContent(element: any): any {
		if (!element) return "";
		if (element.nodeName === "#text") return element.value ?? "";
		const kids = element.childNodes ?? [];
		return kids
			.map((c: any) => this.getContent(c))
			.join("")
			.trim();
	}

	private geolocator(address: string): Promise<GeoResponse> {
		return new Promise<GeoResponse>((resolve, reject) => {
			const encoded = encodeURI(address);
			const fullAddress = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team133/${encoded}`;
			http
				.get(fullAddress, (res) => {
					//generated by gemini
					let data = "";
					res.on("data", (chunk) => {
						data += chunk;
					});
					res.on("end", () => {
						try {
							resolve(JSON.parse(data) as GeoResponse);
						} catch (e) {
							reject("json returned not valid " + e);
						}
					});
				})
				.on("error", (e) => {
					reject("address not valid " + e);
				});
		});
	}
}
