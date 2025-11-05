import { InsightError } from "./IInsightFacade";
import { Parsers } from "./Parsers";
import parse5 from "parse5";
import http from "http";

//AI was used to create the baseline signatures for this class: interface for room and parse's signatures
export interface Room {
	fullname: string;
	shortname: string;
	number: string;
	name: string;
	address: string;
	lat: number | undefined;
	lon: number | undefined;
	seats: number | undefined;
	type: string;
	furniture: string;
	href: string;
}
interface building {
	href: string;
	fullname: string;
	shortname: string;
	address: string;
	lat: number | undefined;
	lon: number | undefined;
}
interface GeoResponse {
	lat?: number;
	lon?: number;
	error?: string;
}
const buildingFields = [
	"views-field-field-building-image",
	"views-field-field-building-code",
	"views-field-title",
	"views-field-field-building-address",
	"views-field-nothing",
];
const roomFields = [
	"views-field-field-room-number",
	"views-field-field-room-capacity",
	"views-field-field-room-furniture",
	"views-field-field-room-type",
];

class RoomParser extends Parsers<Room> {
	constructor(directory: string) {
		super(directory);
	}

	public async parse(content: string): Promise<Room[]> {
		let zip = await this.unzip(content);
		const indexFilesB = zip.file(/^index\.htm$/i);
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
			if (room.length > 0) {
				rooms.push(...room);
			}
		}
		if (rooms.length === 0) {
			throw new InsightError("No valid Rooms)");
		}
		return rooms;
	}
	private findTable(parsedHTM: any, type: string[]): any {
		//debugged using AI
		let tables = this.findNodes(parsedHTM, "table");
		const t = tables.filter((table) => {
			const headings = this.findNodes(table, "th");
			const seen = new Set<string>();
			for (const heading of headings) {
				const cell = this.getAttr(heading, "class");
				for (const req of type) if (cell.includes(req)) seen.add(req);
			}
			return seen.size === type.length;
		});
		return t;
	}

	private async buildingList(parsedHTM: any): Promise<building[]> {
		const tableCheck = this.findTable(parsedHTM, buildingFields);
		if (tableCheck.length != 1) {
			throw new InsightError("rooms is invalid");
		}
		const buildings: building[] = [];
		let tables = this.findNodes(tableCheck[0], "tbody");
		for (const table of tables) {
			let tableRows = this.findNodes(table, "tr");
			for (const t of tableRows) {
				const b: building = { fullname: "", shortname: "", href: "", address: "", lat: undefined, lon: undefined };
				let rowsChild = this.findNodes(t, "td");
				for (const element of rowsChild) {
					const classAttributes = new Set((this.getAttr(element, "class") ?? "").split(/\s+/).filter(Boolean));
					switch (true) {
						case classAttributes.has("views-field-title"):
							const a = (element.childNodes ?? []).find((c: any) => c.tagName === "a");
							if (a) {
								b.fullname = this.getContent(a).trim();
								b.href = this.getAttr(a, "href").trim();
							}
							break;
						case classAttributes.has("views-field-field-building-address"):
							b.address = this.getContent(element).trim();
							const geo = await this.geolocator(b.address);
							if (geo.error) {
								break;
							}
							b.lat = geo.lat;
							b.lon = geo.lon;
							break;

						case classAttributes.has("views-field-field-building-code"):
							b.shortname = this.getContent(element).trim();
							break;

						default:
							break;
					}
				}
				if (
					b.fullname.length > 0 &&
					b.shortname.length > 0 &&
					b.address.length > 0 &&
					b.lat != undefined &&
					b.lon != undefined &&
					b.href.length > 0
				) {
					buildings.push(b);
				}
			}
		}
		return buildings;
	}

	private async roomBuilder(b: building, parsedHTM: any): Promise<Room[]> {
		if (this.findTable(parsedHTM, roomFields).length > 1) {
			throw new InsightError("rooms is invalid");
		}
		const rooms: Room[] = [];
		let tables = this.findNodes(parsedHTM, "tbody");
		for (const table of tables) {
			let tableRows = this.findNodes(table, "tr");
			for (const t of tableRows) {
				let room: Room = { ...b, number: "", name: "", seats: undefined, type: "", furniture: "" };
				let rowsChild = this.findNodes(t, "td");
				for (const element of rowsChild) {
					const classAttributes = new Set((this.getAttr(element, "class") ?? "").split(/\s+/).filter(Boolean));
					switch (true) {
						case classAttributes.has("views-field-field-room-number"):
							const a = (element.childNodes ?? []).find((c: any) => c.tagName === "a");
							if (a) {
								room.number = this.getContent(a).trim();
								room.href = this.getAttr(a, "href").trim();
							}
							break;

						case classAttributes.has("views-field-field-room-capacity"):
							room.seats = parseInt(this.getContent(element).trim(), 10);
							break;

						case classAttributes.has("views-field-field-room-furniture"):
							room.furniture = this.getContent(element).trim();
							break;

						case classAttributes.has("views-field-field-room-type"):
							room.type = this.getContent(element).trim();
							break;

						default:
							break;
					}
				}
				if (
					room.fullname.length > 0 &&
					room.shortname.length > 0 &&
					room.furniture.length > 0 &&
					room.type.length > 0 &&
					room.number.length > 0 &&
					room.address.length > 0 &&
					room.lat != undefined &&
					room.lon != undefined &&
					room.seats != undefined &&
					room.href.length > 0
				) {
					room.name = room.shortname + "_" + room.number;
					rooms.push(room);
				}
			}
		}
		return rooms;
	}

	private findNodes(parsed: any, value: string): any[] {
		let nodes: any[] = [];
		let queue: any[] = [parsed];
		while (queue.length > 0) {
			let currNodes = queue.shift();
			if (!currNodes) {
				continue;
			}
			if (currNodes.tagName === value) {
				nodes.push(currNodes);
				continue;
			}
			if (!Array.isArray(currNodes.childNodes)) {
				continue;
			}
			for (let child of currNodes.childNodes) {
				queue.push(child);
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
		const queue = [element];
		while (queue.length > 0) {
			const currNodes = queue.shift();
			if (currNodes.nodeName === "#text") {
				return (currNodes.value as string) ?? "";
			}
			if (!Array.isArray(currNodes.childNodes)) {
				continue;
			}
			for (let child of currNodes.childNodes) {
				queue.push(child);
			}
		}
		return "";
	}

	private geolocator(address: string): Promise<GeoResponse> {
		return new Promise<GeoResponse>((resolve, reject) => {
			const encoded = encodeURI(address);
			const fullAddress = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team133/${encoded}`;
			http
				.get(fullAddress, (res) => {
					//generated by gemini start
					let data = "";
					res.on("data", (chunk) => {
						data += chunk;
					});
					res.on("end", () => {
						//generated by gemini end
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

export default RoomParser;
